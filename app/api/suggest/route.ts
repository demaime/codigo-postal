import { NextResponse } from "next/server";

import { CDN_CACHE_HEADERS, fail, isAbort, readCoordinates } from "@/app/lib/api";
import { getGeoDistance } from "@/app/lib/distance";
import {
  GeorefError,
  MAX_SUGGESTIONS,
  fetchAddresses,
  sortByPlace,
} from "@/app/lib/georef";
import { MAX_QUERY_LENGTH, MIN_QUERY_LENGTH } from "@/app/lib/nominatim";
import { getPlaceIndex } from "@/app/lib/places";
import { parseQuery } from "@/app/lib/query";
import { createRateLimiter, getClientKey } from "@/app/lib/rate-limit";
import type { SuggestResponse, SuggestionWithDistance } from "@/app/lib/types";

export const runtime = "nodejs";

/**
 * São Paulo: es la región de Vercel más cercana a Argentina, donde están tanto
 * los usuarios como los dos servicios que se consultan (georef y Nominatim).
 * Por defecto desplegaría en Estados Unidos y cada búsqueda pagaría el viaje
 * de ida y vuelta.
 */
export const preferredRegion = "gru1";

// El autocompletado dispara más seguido que una búsqueda, pero georef aguanta:
// el límite acá protege nuestro propio servidor, no al de ellos.
const limiter = createRateLimiter({ capacity: 30, refillPerSecond: 3 });

/**
 * Sugerencias de direcciones argentinas normalizadas.
 *
 * Cuando llegan `lat`/`lon`, **todos** los candidatos del país se ordenan por
 * distancia antes de recortar. Eso es lo que reemplaza al dato que el usuario
 * no quiere escribir: entre las 85 "Balcarce 50" que existen en Argentina,
 * la suya es la más cercana.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").trim();

  if (query.length < MIN_QUERY_LENGTH) {
    return fail(
      "INVALID_QUERY",
      `Escribí al menos ${MIN_QUERY_LENGTH} caracteres para buscar.`,
      400,
    );
  }

  if (query.length > MAX_QUERY_LENGTH) {
    return fail("INVALID_QUERY", "La dirección es demasiado larga.", 400);
  }

  if (!limiter.take(getClientKey(request))) {
    return fail(
      "RATE_LIMITED",
      "Demasiadas búsquedas seguidas. Esperá unos segundos y probá de nuevo.",
      429,
    );
  }

  try {
    // Si el texto trae una ciudad reconocible, se separa y viaja como filtro
    // propio. Mandarla dentro de `direccion` no acota nada: georef la descarta.
    const { address, place } = parseQuery(query, await getPlaceIndex());

    let { suggestions, total } = await fetchAddresses(address, {
      place,
      signal: request.signal,
    });

    // La ciudad existe pero esa dirección no está ahí: antes que dejar la
    // pantalla vacía, se amplía la búsqueda y se avisa.
    let widenedFrom: string | null = null;
    if (place && total === 0) {
      widenedFrom = place.name;
      ({ suggestions, total } = await fetchAddresses(address, {
        signal: request.signal,
      }));
    }

    const coords = readCoordinates(params);

    // Sin coordenadas el orden pasa a ser alfabético por provincia: una lista
    // que se puede recorrer, en vez del orden arbitrario de georef.
    const ordered = coords ? suggestions : sortByPlace(suggestions);

    const measured: SuggestionWithDistance[] = ordered.map((suggestion) => ({
      ...suggestion,
      distanceKm: coords
        ? getGeoDistance(suggestion.lat, suggestion.lon, coords.lat, coords.lon)
        : null,
    }));

    if (coords) {
      measured.sort(
        (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity),
      );
    }

    return NextResponse.json<SuggestResponse>(
      { suggestions: measured.slice(0, MAX_SUGGESTIONS), total, widenedFrom },
      { headers: CDN_CACHE_HEADERS },
    );
  } catch (error) {
    if (isAbort(error)) return new Response(null, { status: 499 });

    if (error instanceof GeorefError && error.status === 429) {
      return fail(
        "UPSTREAM_RATE_LIMITED",
        "El servicio de direcciones está saturado. Probá en unos segundos.",
        429,
      );
    }

    console.error("[api/suggest]", error);

    return fail(
      "UPSTREAM_ERROR",
      "No pudimos consultar el servicio de direcciones. Intentá de nuevo.",
      502,
    );
  }
}
