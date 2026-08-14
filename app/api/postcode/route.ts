import { NextResponse } from "next/server";

import {
  CDN_CACHE_HEADERS,
  NOMINATIM_USER_AGENT,
  SITE_REFERER,
  fail,
  isAbort,
  readCoordinates,
} from "@/app/lib/api";
import { stripStreetCode } from "@/app/lib/georef";
import {
  NominatimError,
  reverseLookup,
  searchStructured,
} from "@/app/lib/nominatim";
import { createRateLimiter, getClientKey } from "@/app/lib/rate-limit";
import type { PostcodeResult } from "@/app/lib/types";

export const runtime = "nodejs";

/**
 * São Paulo: es la región de Vercel más cercana a Argentina, donde están tanto
 * los usuarios como los dos servicios que se consultan (georef y Nominatim).
 * Por defecto desplegaría en Estados Unidos y cada búsqueda pagaría el viaje
 * de ida y vuelta.
 */
export const preferredRegion = "gru1";

// Cada pedido acá pega contra Nominatim, que admite 1 req/s.
const limiter = createRateLimiter({ capacity: 10, refillPerSecond: 1 });

/**
 * Resuelve el código postal de una dirección ya elegida en el autocompletado.
 *
 * Primero por búsqueda estructurada, que es la única forma de que Nominatim
 * respete la altura: `street="50 Balcarce"` + `state="Ciudad Autónoma de
 * Buenos Aires"` devuelve el código postal de esa puerta y no el de un tramo
 * cualquiera de la calle.
 *
 * Si esa dirección no está en OSM, se cae a geocodificación inversa sobre las
 * coordenadas de georef y el resultado se marca como aproximado: la inversa se
 * engancha al objeto mapeado más cercano, que puede estar en otra calle. Medido
 * sobre Av. Corrientes, tres puntos en 300 metros devuelven Corrientes 1383
 * (C1043ABA), Paraná (1017) y Sarmiento 1526 (C1037ADA).
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  const street = (params.get("street") ?? "").trim();
  const province = (params.get("province") ?? "").trim();
  const locality = (params.get("locality") ?? "").trim();
  const department = (params.get("department") ?? "").trim();
  const rawNumber = params.get("number");
  const coords = readCoordinates(params);

  if (!street) {
    return fail("INVALID_QUERY", "Falta la calle.", 400);
  }

  if (!coords) {
    return fail("INVALID_QUERY", "Faltan las coordenadas de la dirección.", 400);
  }

  const houseNumber = rawNumber ? Number.parseInt(rawNumber, 10) : null;

  if (!limiter.take(getClientKey(request))) {
    return fail(
      "RATE_LIMITED",
      "Demasiadas consultas seguidas. Esperá unos segundos.",
      429,
    );
  }

  const nominatimOptions = {
    userAgent: NOMINATIM_USER_AGENT,
    referer: SITE_REFERER,
    signal: request.signal,
  };

  function respond(result: PostcodeResult) {
    return NextResponse.json<PostcodeResult>(result, {
      headers: CDN_CACHE_HEADERS,
    });
  }

  try {
    const exact = await searchStructured(
      // Sin la numeración municipal: OSM no la conoce y el match falla.
      stripStreetCode(street),
      Number.isFinite(houseNumber) ? houseNumber : null,
      province,
      department,
      nominatimOptions,
    );

    if (exact?.postcode) {
      return respond({
        postcode: exact.postcode,
        precision: "exact",
        street: exact.street ?? street,
        locality: exact.locality ?? locality,
        province: exact.province ?? province,
        lat: exact.lat,
        lon: exact.lon,
      });
    }

    const approximate = await reverseLookup(
      coords.lat,
      coords.lon,
      nominatimOptions,
    );

    return respond({
      postcode: approximate?.postcode ?? null,
      precision: "approx",
      street: approximate?.street ?? street,
      locality: approximate?.locality ?? locality,
      province: approximate?.province ?? province,
      lat: coords.lat,
      lon: coords.lon,
    });
  } catch (error) {
    if (isAbort(error)) return new Response(null, { status: 499 });

    if (error instanceof NominatimError && error.status === 429) {
      return fail(
        "UPSTREAM_RATE_LIMITED",
        "El servicio de mapas está recibiendo demasiados pedidos. Probá en unos segundos.",
        429,
      );
    }

    console.error("[api/postcode]", error);

    return fail(
      "UPSTREAM_ERROR",
      "No pudimos obtener el código postal. Intentá de nuevo.",
      502,
    );
  }
}
