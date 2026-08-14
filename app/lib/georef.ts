import type {
  AddressSuggestion,
  GeorefDireccion,
  GeorefDireccionesResponse,
  PlaceEntry,
} from "./types";

/**
 * Cliente del Servicio de Normalización de Datos Geográficos (georef-ar),
 * la API oficial del Estado argentino sobre datos del INDEC.
 *
 * Es el que entiende direcciones argentinas de verdad: resuelve la altura
 * (Nominatim en modo libre la descarta), corrige el nombre de la calle
 * —"balcarse 50" devuelve BALCARCE 50— y da coordenadas exactas. Es
 * gratuito, sin API key, y sin el límite de 1 req/s de Nominatim, así que
 * banca el autocompletado mientras se tipea.
 *
 * Lo que NO da es el código postal: eso lo resuelve `nominatim.ts`.
 */

const GEOREF_ENDPOINT = "https://apis.datos.gob.ar/georef/api";

/** Una sola llamada trae todos los candidatos del país: 78 KB en ~90 ms. */
export const GEOREF_MAX = 500;
/** La lista es scrolleable, así que puede ofrecer bastantes más de las que entran. */
export const MAX_SUGGESTIONS = 25;
/** Un día: las direcciones no se mudan. */
export const GEOREF_CACHE_SECONDS = 60 * 60 * 24;

export class GeorefError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "GeorefError";
    this.status = status;
  }
}

/** ¿El texto ya trae altura? Sin número, un código postal es adivinanza. */
export function hasHouseNumber(query: string): boolean {
  return /\d/.test(query);
}

const LOWERCASE_PARTICLES = new Set([
  "de",
  "del",
  "la",
  "las",
  "los",
  "y",
  "el",
  "e",
]);

/**
 * georef devuelve todo en mayúsculas ("AV DEL BALCARCEOR"). Gritar en la
 * interfaz queda mal, así que se pasa a capitalización de título respetando
 * las partículas.
 */
export function toTitleCase(value: string): string {
  return value
    .toLocaleLowerCase("es-AR")
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      if (index > 0 && LOWERCASE_PARTICLES.has(word)) return word;
      return word.charAt(0).toLocaleUpperCase("es-AR") + word.slice(1);
    })
    .join(" ");
}

/**
 * Saca la numeración municipal del nombre de la calle.
 *
 * Varios partidos del conurbano numeran sus calles además de nombrarlas, y el
 * registro del INDEC guarda las dos cosas juntas: en Tres de Febrero el 73% de
 * las calles arranca con número, en San Miguel el 50%. OpenStreetMap no conoce
 * esos códigos, así que buscar "2889 4150 San Lorenzo" no devuelve nada y la
 * dirección termina resuelta por interpolación, con el punto corrido ~190 m.
 *
 * Solo se usa para consultar; en pantalla el nombre se muestra como figura en
 * el registro.
 *
 * La excepción son las fechas —25 de Mayo, 9 de Julio, 12 de Octubre—, donde el
 * número es parte del nombre de verdad. Se reconocen porque después del número
 * viene "de".
 */
export function stripStreetCode(street: string): string {
  const withoutCode = street.replace(/^(?:calle\s+)?\d+\s+(?!de\s)/i, "");

  // Si no queda nada, el número era todo el nombre ("Calle 91").
  return withoutCode.trim() === "" ? street : withoutCode.trim();
}

type SearchOptions = {
  /** Acota la búsqueda a una provincia, departamento o localidad. */
  place?: PlaceEntry | null;
  max?: number;
};

/**
 * `place` viaja en su propio parámetro (`provincia`, `departamento` o
 * `localidad`) y no dentro de `direccion`: georef parsea ahí solo calle y
 * altura, y lo que sobra lo descarta en silencio. Mandar
 * "san lorenzo 2889 san miguel" junto devuelve 24 resultados de todo el país;
 * separado, devuelve el correcto.
 */
export function buildAddressesUrl(
  query: string,
  { place, max = GEOREF_MAX }: SearchOptions = {},
): string {
  const params = new URLSearchParams({
    direccion: query,
    max: String(max),
  });

  if (place) params.set(place.kind, place.id);

  return `${GEOREF_ENDPOINT}/direcciones?${params.toString()}`;
}

export function buildLocationUrl(lat: number, lon: number): string {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    campos: "provincia",
  });

  return `${GEOREF_ENDPOINT}/ubicacion?${params.toString()}`;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Crudo de georef -> DTO plano. Las coordenadas pasan a number una sola vez. */
export function normalizeAddress(
  raw: GeorefDireccion,
): AddressSuggestion | null {
  const lat = raw.ubicacion?.lat;
  const lon = raw.ubicacion?.lon;

  // Sin coordenadas no se puede medir la distancia ni ubicar el mapa.
  if (typeof lat !== "number" || typeof lon !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const streetName = raw.calle?.nombre;
  if (!streetName) return null;

  const street = toTitleCase(streetName);
  const number = readNumber(raw.altura?.valor);
  const streetId = String(raw.calle?.id ?? "");

  return {
    id: number === null ? streetId : `${streetId}-${number}`,
    label: number === null ? street : `${street} ${number}`,
    street,
    number,
    locality: toTitleCase(raw.localidad_censal?.nombre ?? ""),
    department: toTitleCase(raw.departamento?.nombre ?? ""),
    province: raw.provincia?.nombre ?? "",
    provinceId: raw.provincia?.id ?? "",
    lat,
    lon,
  };
}

/**
 * georef devuelve una entrada por tramo de calle, así que la misma dirección
 * aparece repetida. Con altura se agrupa por calle+altura; sin altura, por
 * calle+localidad, que es lo que distingue una sugerencia de otra.
 */
export function dedupeSuggestions(
  suggestions: AddressSuggestion[],
): AddressSuggestion[] {
  const seen = new Set<string>();

  return suggestions.filter((suggestion) => {
    const key =
      suggestion.number === null
        ? `${suggestion.id}|${suggestion.locality}`.toLowerCase()
        : suggestion.id.toLowerCase();

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Sin ubicación no hay con qué desempatar, así que el orden pasa a ser
 * alfabético por provincia y partido: una lista predecible que se puede
 * recorrer buscando la propia, en vez del orden arbitrario de georef.
 */
export function sortByPlace(
  suggestions: AddressSuggestion[],
): AddressSuggestion[] {
  return [...suggestions].sort(
    (a, b) =>
      a.province.localeCompare(b.province, "es-AR") ||
      a.department.localeCompare(b.department, "es-AR") ||
      a.label.localeCompare(b.label, "es-AR"),
  );
}

type FetchOptions = SearchOptions & {
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
};

async function getJson<T>(
  url: string,
  { signal, fetchImpl = fetch }: Pick<FetchOptions, "signal" | "fetchImpl">,
): Promise<T> {
  const response = await fetchImpl(url, {
    signal,
    headers: { Accept: "application/json" },
    next: { revalidate: GEOREF_CACHE_SECONDS },
  } as RequestInit);

  if (!response.ok) {
    throw new GeorefError(`georef respondió ${response.status}`, response.status);
  }

  return (await response.json()) as T;
}

/** Busca direcciones normalizadas. Devuelve también el total sin recortar. */
export async function fetchAddresses(
  query: string,
  { place, max, signal, fetchImpl }: FetchOptions = {},
): Promise<{ suggestions: AddressSuggestion[]; total: number }> {
  const payload = await getJson<GeorefDireccionesResponse>(
    buildAddressesUrl(query, { place, max }),
    { signal, fetchImpl },
  );

  const raw = Array.isArray(payload?.direcciones) ? payload.direcciones : [];
  const upstreamTotal = payload?.total ?? raw.length;

  const suggestions = dedupeSuggestions(
    raw
      .map(normalizeAddress)
      .filter((item): item is AddressSuggestion => item !== null),
  );

  /**
   * El total es el de direcciones **distintas**, no el crudo de georef, que
   * cuenta una vez por tramo de calle: para "san lorenzo 2889" informa 24
   * cuando en realidad hay 20 direcciones y 4 repetidas. Comparar el crudo
   * contra la lista deduplicada hacía decir "mostrando 20 de 24" y sonaba a
   * que se estaban escondiendo cuatro.
   *
   * La única excepción es que georef haya recortado por su propio tope: ahí sí
   * hay más de las que llegaron, y su número es el que vale.
   */
  const total =
    raw.length < upstreamTotal ? upstreamTotal : suggestions.length;

  return { suggestions, total };
}
