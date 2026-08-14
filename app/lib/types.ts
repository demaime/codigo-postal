/** Los campos de `address` que Nominatim devuelve con `addressdetails=1`.
 *  Casi todos son opcionales: dependen de cómo esté mapeada la zona en OSM. */
export type NominatimAddress = {
  house_number?: string;
  road?: string;
  neighbourhood?: string;
  city?: string;
  city_district?: string;
  state_district?: string;
  town?: string;
  suburb?: string;
  village?: string;
  hamlet?: string;
  municipality?: string;
  county?: string;
  state?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
};

/** La forma cruda de un resultado de Nominatim. `lat`/`lon` vienen como string. */
export type NominatimPlace = {
  place_id: number;
  osm_id?: number;
  lat: string;
  lon: string;
  display_name?: string;
  address?: NominatimAddress;
};

/** El DTO que consume la UI. Ya normalizado: nada de `parseFloat` disperso
 *  por los componentes ni fallbacks de localidad escritos dentro del JSX. */
export type PostalResult = {
  id: string;
  /** Código postal informado por OSM. `null` cuando la zona no lo tiene mapeado. */
  postcode: string | null;
  street: string | null;
  locality: string | null;
  /** Partido / departamento. */
  district: string | null;
  province: string | null;
  lat: number;
  lon: number;
  displayName: string;
};

/** Un resultado ya medido contra la ubicación del usuario.
 *  `distanceKm` es `null` cuando no hay ubicación disponible. */
export type ResultWithDistance = PostalResult & {
  distanceKm: number | null;
};

export type SearchSuccess = {
  results: PostalResult[];
};

export type ApiErrorCode =
  | "INVALID_QUERY"
  | "RATE_LIMITED"
  | "UPSTREAM_RATE_LIMITED"
  | "UPSTREAM_ERROR";

export type ApiErrorBody = {
  error: {
    code: ApiErrorCode;
    message: string;
  };
};

/** Coordenadas del usuario. */
export type Coordinates = {
  lat: number;
  lon: number;
  /**
   * Radio de incertidumbre en metros que informa el navegador (95% de
   * confianza). Con GPS son decenas de metros; por WiFi o IP —una desktop, por
   * ejemplo— pueden ser miles. Sin este dato no hay forma de saber si una
   * distancia calculada significa algo.
   */
  accuracyMeters: number;
};

/* ---------------------------------------------------------------------------
   georef-ar (INDEC) — resuelve la dirección
   --------------------------------------------------------------------------- */

type GeorefNamed = { id?: string; nombre?: string };

export type GeorefDireccion = {
  altura?: { unidad: string | null; valor: number | string | null };
  calle?: { id?: string | number; nombre?: string; categoria?: string | null };
  departamento?: GeorefNamed;
  localidad_censal?: GeorefNamed;
  provincia?: GeorefNamed;
  nomenclatura?: string;
  ubicacion?: { lat: number | null; lon: number | null };
};

export type GeorefDireccionesResponse = {
  cantidad?: number;
  total?: number;
  direcciones?: GeorefDireccion[];
};

export type GeorefUbicacionResponse = {
  ubicacion?: { provincia?: GeorefNamed };
};

/* ---------------------------------------------------------------------------
   Lugares — para reconocer la ciudad dentro del texto libre
   --------------------------------------------------------------------------- */

/** Qué tan amplio es el filtro. Se mapea al parámetro homónimo de georef. */
export type PlaceKind = "provincia" | "departamento" | "localidad";

export type PlaceEntry = {
  kind: PlaceKind;
  id: string;
  /** El nombre tal cual lo escribe el registro, para mostrarlo si hace falta. */
  name: string;
};

/** Nombre normalizado -> lugar. */
export type PlaceIndex = Map<string, PlaceEntry>;

/** Una dirección normalizada, lista para ofrecer en el autocompletado. */
export type AddressSuggestion = {
  id: string;
  /** "Balcarce 50", o solo "Balcarce" si todavía no se escribió la altura. */
  label: string;
  street: string;
  number: number | null;
  locality: string;
  /** Partido / comuna: "Comuna 1". */
  department: string;
  province: string;
  provinceId: string;
  lat: number;
  lon: number;
};

export type SuggestionWithDistance = AddressSuggestion & {
  distanceKm: number | null;
};

export type SuggestResponse = {
  suggestions: SuggestionWithDistance[];
  /** Coincidencias totales antes de recortar, para saber si hay ambigüedad. */
  total: number;
  /**
   * Nombre de la ciudad que se detectó en el texto pero no tenía la dirección.
   * Cuando viene, estos resultados son de otras ciudades.
   */
  widenedFrom: string | null;
};

/* ---------------------------------------------------------------------------
   Resolución del código postal
   --------------------------------------------------------------------------- */

/**
 * `exact`: el código postal salió de la coincidencia estructurada de la
 * dirección completa. `approx`: salió de geocodificación inversa sobre las
 * coordenadas, que a 15 metros ya puede cambiar de cuadra — la interfaz lo
 * aclara cuando pasa.
 */
export type PostcodePrecision = "exact" | "approx";

export type PostcodeResult = {
  postcode: string | null;
  precision: PostcodePrecision;
  street: string;
  locality: string;
  province: string;
  lat: number;
  lon: number;
};

/**
 * Lo que finalmente se muestra en pantalla, venga de una dirección elegida en
 * el autocompletado o del buscador libre. Tener una sola forma evita mantener
 * dos interfaces de resultado en paralelo.
 */
export type ResolvedPlace = {
  id: string;
  postcode: string | null;
  precision: PostcodePrecision;
  /** "Balcarce 50" */
  label: string;
  /** "Comuna 1 · Ciudad Autónoma de Buenos Aires" */
  area: string;
  lat: number;
  lon: number;
  distanceKm: number | null;
};
