import type { PlaceEntry, PlaceIndex, PlaceKind } from "./types";

/**
 * Catálogo de lugares de la Argentina, para reconocer cuándo lo que el usuario
 * escribió después de la altura es una ciudad y no parte de la calle.
 *
 * Sin este catálogo el parser sería una adivinanza: "san lorenzo 2889 san
 * miguel" y "san miguel 1234" se verían igual. Validando contra nombres reales,
 * el segundo no dispara ningún filtro porque después del número no queda nada.
 *
 * Vive únicamente en el servidor: son ~193 KB que nunca viajan al navegador.
 */

const GEOREF_ENDPOINT = "https://apis.datos.gob.ar/georef/api";
/** Tope que impone georef. Alcanza: la lista más larga son 4037 localidades. */
const CATALOG_MAX = 5000;
/** Los límites administrativos no cambian de un día para el otro. */
const CATALOG_CACHE_SECONDS = 60 * 60 * 24 * 30;

/**
 * Cómo la gente nombra lugares que en el registro figuran de otra forma.
 * Sin esto, `corrientes 1234 caba` no matchea nada.
 */
const ALIASES: Record<string, string> = {
  caba: "ciudad autonoma de buenos aires",
  capital: "ciudad autonoma de buenos aires",
  "capital federal": "ciudad autonoma de buenos aires",
  "ciudad de buenos aires": "ciudad autonoma de buenos aires",
  "bs as": "buenos aires",
  "bsas": "buenos aires",
  "pcia de buenos aires": "buenos aires",
  "provincia de buenos aires": "buenos aires",
};

/** Marcas de acento que quedan sueltas después de `normalize("NFD")`. */
const DIACRITICS = /[̀-ͯ]/g;

/** Minúsculas, sin acentos, sin puntuación, espacios colapsados. */
export function normalizePlaceName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

type CatalogResponse = {
  provincias?: { id?: string; nombre?: string }[];
  departamentos?: { id?: string; nombre?: string }[];
  localidades?: { id?: string; nombre?: string }[];
};

/**
 * Arma el índice a partir de las tres listas.
 *
 * El orden importa: se indexa provincia, después departamento y por último
 * localidad, y el primero en entrar gana. Ante un nombre repetido queda el
 * filtro más amplio, que es el que nunca deja afuera la respuesta correcta.
 */
export function buildPlaceIndex(catalogs: {
  provincias: { id?: string; nombre?: string }[];
  departamentos: { id?: string; nombre?: string }[];
  localidades: { id?: string; nombre?: string }[];
}): PlaceIndex {
  const index: PlaceIndex = new Map();

  const add = (kind: PlaceKind) => (item: { id?: string; nombre?: string }) => {
    if (!item.id || !item.nombre) return;

    const key = normalizePlaceName(item.nombre);
    if (!key || index.has(key)) return;

    index.set(key, { kind, id: item.id, name: item.nombre });
  };

  catalogs.provincias.forEach(add("provincia"));
  catalogs.departamentos.forEach(add("departamento"));
  catalogs.localidades.forEach(add("localidad"));

  return index;
}

/** Resuelve un texto ya normalizado contra el índice, pasando por los alias. */
export function lookupPlace(
  index: PlaceIndex,
  normalized: string,
): PlaceEntry | null {
  if (!normalized) return null;
  return index.get(ALIASES[normalized] ?? normalized) ?? null;
}

async function fetchCatalog(
  resource: "provincias" | "departamentos" | "localidades",
  fetchImpl: typeof fetch,
): Promise<{ id?: string; nombre?: string }[]> {
  const url = `${GEOREF_ENDPOINT}/${resource}?max=${CATALOG_MAX}&campos=id,nombre`;

  const response = await fetchImpl(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: CATALOG_CACHE_SECONDS },
  } as RequestInit);

  if (!response.ok) {
    throw new Error(`georef ${resource} respondió ${response.status}`);
  }

  const payload = (await response.json()) as CatalogResponse;
  return payload[resource] ?? [];
}

/** El índice se arma una sola vez por instancia y queda memoizado. */
let cached: Promise<PlaceIndex> | null = null;

export function getPlaceIndex(fetchImpl: typeof fetch = fetch): Promise<PlaceIndex> {
  cached ??= (async () => {
    const [provincias, departamentos, localidades] = await Promise.all([
      fetchCatalog("provincias", fetchImpl),
      fetchCatalog("departamentos", fetchImpl),
      fetchCatalog("localidades", fetchImpl),
    ]);

    return buildPlaceIndex({ provincias, departamentos, localidades });
  })().catch((error) => {
    // Si falla, no se cachea el fallo: el próximo pedido reintenta.
    cached = null;
    throw error;
  });

  return cached;
}

/** Para los tests: descarta el índice memoizado. */
export function resetPlaceIndex() {
  cached = null;
}
