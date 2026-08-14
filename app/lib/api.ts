import { NextResponse } from "next/server";

import type { ApiErrorBody, ApiErrorCode } from "./types";

/** El `User-Agent` que la política de uso de Nominatim exige. */
export const NOMINATIM_USER_AGENT =
  process.env.NOMINATIM_USER_AGENT ??
  "codigo-postal/1.0 (https://github.com/demaime/codigo-postal)";

export const SITE_REFERER = process.env.NEXT_PUBLIC_SITE_URL;

/** El navegador no cachea; el CDN sí. Dos personas buscando la misma
 *  dirección pegan una sola vez contra el servicio de origen. */
export const CDN_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=0, s-maxage=86400",
};

export function fail(code: ApiErrorCode, message: string, status: number) {
  return NextResponse.json<ApiErrorBody>(
    { error: { code, message } },
    { status },
  );
}

/** El usuario cambió de búsqueda antes de que llegara esta: no es un error. */
export function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/** Lee un par lat/lon de la query string. Devuelve `null` si falta o no sirve. */
export function readCoordinates(
  params: URLSearchParams,
): { lat: number; lon: number } | null {
  const lat = Number.parseFloat(params.get("lat") ?? "");
  const lon = Number.parseFloat(params.get("lon") ?? "");

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;

  return { lat, lon };
}
