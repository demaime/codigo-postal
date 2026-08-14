import { normalizePostcode } from "./cpa";
import type { NominatimAddress, NominatimPlace, PostalResult } from "./types";

export const MIN_QUERY_LENGTH = 3;
export const MAX_QUERY_LENGTH = 120;
export const SEARCH_LIMIT = 25;
/** Las direcciones no se mudan: un día de caché es conservador. */
export const SEARCH_CACHE_SECONDS = 60 * 60 * 24;

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_REVERSE_ENDPOINT =
  "https://nominatim.openstreetmap.org/reverse";

export class NominatimError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "NominatimError";
    this.status = status;
  }
}

/**
 * Arma la URL de búsqueda.
 *
 * Dos cosas importan acá: la query va **encodeada** (antes se interpolaba
 * cruda, así que un `&` en la dirección rompía el pedido) y el filtro de país
 * viaja en `countrycodes`. Filtrar en el origen y no en el cliente evita pedir
 * 25 resultados para después tirar la mitad.
 */
export function buildSearchUrl(query: string, limit = SEARCH_LIMIT): string {
  const params = new URLSearchParams({
    q: query,
    countrycodes: "ar",
    addressdetails: "1",
    format: "jsonv2",
    limit: String(limit),
    "accept-language": "es",
  });

  return `${NOMINATIM_ENDPOINT}?${params.toString()}`;
}

/**
 * Búsqueda **estructurada**: cada componente de la dirección viaja en su propio
 * parámetro en vez de en un `q` libre.
 *
 * Esta es la diferencia que decide todo. En modo libre Nominatim descarta la
 * altura y devuelve tramos sueltos de la calle, cada uno con su código postal;
 * en modo estructurado `street="50 Balcarce"` + `state="Ciudad Autónoma de
 * Buenos Aires"` devuelve un único resultado con el código postal correcto.
 * La altura va **antes** del nombre de la calle: así lo espera Nominatim.
 */
export function buildStructuredSearchUrl(
  street: string,
  houseNumber: number | null,
  province: string,
  /** Partido o comuna. Sin esto, una calle homónima de otro distrito puede ganar. */
  county?: string,
): string {
  const params = new URLSearchParams({
    street: houseNumber === null ? street : `${houseNumber} ${street}`,
    country: "Argentina",
    addressdetails: "1",
    format: "jsonv2",
    limit: "1",
    "accept-language": "es",
  });

  if (province) params.set("state", province);
  if (county) params.set("county", county);

  return `${NOMINATIM_ENDPOINT}?${params.toString()}`;
}

export function buildReverseUrl(lat: number, lon: number): string {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    format: "jsonv2",
    addressdetails: "1",
    "accept-language": "es",
    // 18 = nivel de edificio: el más fino que ofrece.
    zoom: "18",
  });

  return `${NOMINATIM_REVERSE_ENDPOINT}?${params.toString()}`;
}

/** La localidad tiene muchos nombres en OSM según cómo esté mapeada la zona. */
function pickLocality(address: NominatimAddress): string | null {
  return (
    address.city ??
    address.town ??
    address.village ??
    address.hamlet ??
    address.suburb ??
    address.neighbourhood ??
    null
  );
}

function pickDistrict(address: NominatimAddress): string | null {
  return (
    address.state_district ??
    address.county ??
    address.municipality ??
    address.city_district ??
    null
  );
}

function pickStreet(address: NominatimAddress): string | null {
  if (!address.road) return null;
  return address.house_number
    ? `${address.road} ${address.house_number}`
    : address.road;
}

/** Crudo de Nominatim -> DTO de la UI. Acá `lat`/`lon` pasan a number una sola vez. */
export function normalizePlace(place: NominatimPlace): PostalResult | null {
  const lat = Number.parseFloat(place.lat);
  const lon = Number.parseFloat(place.lon);

  // Sin coordenadas no hay mapa ni distancia: el resultado no sirve.
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const address = place.address ?? {};

  return {
    id: String(place.place_id),
    postcode: normalizePostcode(address.postcode),
    street: pickStreet(address),
    locality: pickLocality(address),
    district: pickDistrict(address),
    province: address.state ?? null,
    lat,
    lon,
    displayName: place.display_name ?? "",
  };
}

/**
 * Nominatim suele devolver varias entradas para el mismo lugar (el portal, el
 * edificio, el nodo de la esquina). Para el usuario son el mismo resultado.
 */
export function dedupe(results: PostalResult[]): PostalResult[] {
  const seen = new Set<string>();

  return results.filter((result) => {
    const key = [
      result.postcode ?? "",
      result.locality ?? "",
      result.street ?? "",
    ]
      .join("|")
      .toLowerCase();

    // Sin ningún dato identificatorio no se puede deduplicar: se deja pasar.
    if (key === "||") return true;
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

export function normalizeResults(places: NominatimPlace[]): PostalResult[] {
  return dedupe(
    places
      .map(normalizePlace)
      .filter((result): result is PostalResult => result !== null),
  );
}

type SearchOptions = {
  userAgent: string;
  referer?: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
};

/**
 * Pide un JSON a Nominatim.
 *
 * El `User-Agent` identificatorio no es opcional: la política de uso de
 * Nominatim lo exige y sin él terminan bloqueando el tráfico.
 */
async function requestJson<T>(
  url: string,
  { userAgent, referer, signal, fetchImpl = fetch }: SearchOptions,
): Promise<T> {
  const headers: Record<string, string> = {
    "User-Agent": userAgent,
    "Accept-Language": "es-AR,es;q=0.9",
  };
  if (referer) headers.Referer = referer;

  const response = await fetchImpl(url, {
    headers,
    signal,
    next: { revalidate: SEARCH_CACHE_SECONDS },
  } as RequestInit);

  if (!response.ok) {
    throw new NominatimError(
      `Nominatim respondió ${response.status}`,
      response.status,
    );
  }

  return (await response.json()) as T;
}

/** Búsqueda libre. Queda para lo que no es una dirección con altura. */
export async function searchAddresses(
  query: string,
  options: SearchOptions,
): Promise<PostalResult[]> {
  const payload = await requestJson<unknown>(buildSearchUrl(query), options);

  if (!Array.isArray(payload)) {
    throw new NominatimError("Respuesta inesperada de Nominatim", 502);
  }

  return normalizeResults(payload as NominatimPlace[]);
}

/** Búsqueda estructurada: devuelve la dirección exacta, con su código postal. */
export async function searchStructured(
  street: string,
  houseNumber: number | null,
  province: string,
  county: string,
  options: SearchOptions,
): Promise<PostalResult | null> {
  const payload = await requestJson<unknown>(
    buildStructuredSearchUrl(street, houseNumber, province, county),
    options,
  );

  if (!Array.isArray(payload) || payload.length === 0) return null;

  return normalizePlace(payload[0] as NominatimPlace);
}

/**
 * Geocodificación inversa. Último recurso: a 15 metros de distancia puede
 * devolver el código postal de la cuadra de al lado, así que lo que salga de
 * acá se marca como aproximado.
 */
export async function reverseLookup(
  lat: number,
  lon: number,
  options: SearchOptions,
): Promise<PostalResult | null> {
  const payload = await requestJson<NominatimPlace | { error?: unknown }>(
    buildReverseUrl(lat, lon),
    options,
  );

  if (!payload || "error" in payload) return null;

  return normalizePlace(payload as NominatimPlace);
}
