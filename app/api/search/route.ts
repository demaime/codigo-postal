import { NextResponse } from "next/server";

import {
  CDN_CACHE_HEADERS,
  NOMINATIM_USER_AGENT,
  SITE_REFERER,
  fail,
  isAbort,
} from "@/app/lib/api";
import {
  MAX_QUERY_LENGTH,
  MIN_QUERY_LENGTH,
  NominatimError,
  searchAddresses,
} from "@/app/lib/nominatim";
import { createRateLimiter, getClientKey } from "@/app/lib/rate-limit";
import type { SearchSuccess } from "@/app/lib/types";

export const runtime = "nodejs";

/**
 * São Paulo: es la región de Vercel más cercana a Argentina, donde están tanto
 * los usuarios como los dos servicios que se consultan (georef y Nominatim).
 * Por defecto desplegaría en Estados Unidos y cada búsqueda pagaría el viaje
 * de ida y vuelta.
 */
export const preferredRegion = "gru1";

const limiter = createRateLimiter({ capacity: 10, refillPerSecond: 1 });

/**
 * Búsqueda libre contra Nominatim.
 *
 * Ya no es el camino principal —las direcciones las resuelve `/api/suggest`
 * con georef, que sí respeta la altura— pero sigue siendo el que responde por
 * lo que no es una dirección con número: "Obelisco", "Aeroparque", un barrio.
 */
export async function GET(request: Request) {
  const query = (new URL(request.url).searchParams.get("q") ?? "").trim();

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
    const results = await searchAddresses(query, {
      userAgent: NOMINATIM_USER_AGENT,
      referer: SITE_REFERER,
      signal: request.signal,
    });

    return NextResponse.json<SearchSuccess>(
      { results },
      { headers: CDN_CACHE_HEADERS },
    );
  } catch (error) {
    if (isAbort(error)) return new Response(null, { status: 499 });

    if (error instanceof NominatimError && error.status === 429) {
      return fail(
        "UPSTREAM_RATE_LIMITED",
        "El servicio de mapas está recibiendo demasiados pedidos. Probá en unos segundos.",
        429,
      );
    }

    console.error("[api/search]", error);

    return fail(
      "UPSTREAM_ERROR",
      "No pudimos consultar el servicio de mapas. Intentá de nuevo.",
      502,
    );
  }
}
