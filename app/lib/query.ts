import { lookupPlace, normalizePlaceName } from "./places";
import type { PlaceEntry, PlaceIndex } from "./types";

export type ParsedQuery = {
  /** Lo que se manda a georef como `direccion`: calle + altura. */
  address: string;
  /** La ciudad detectada, si el texto sobrante coincide con un lugar real. */
  place: PlaceEntry | null;
};

/**
 * Parte el texto libre en dirección y lugar.
 *
 * La regla es cortar por el **último** número, no el primero: así
 * `av 9 de julio 1000` y `calle 91 san lorenzo 2889` quedan enteros como
 * dirección, en vez de partirse por el número que forma parte del nombre.
 *
 * Y el sobrante solo cuenta si coincide con un lugar del registro. Eso es lo
 * que distingue `san lorenzo 2889 san miguel` —donde San Miguel es la ciudad—
 * de `san miguel 1234`, donde San Miguel es la calle y después del número no
 * queda nada. Mientras se está tipeando ("san mig") tampoco coincide, así que
 * el filtro recién entra cuando el nombre está completo.
 */
export function parseQuery(text: string, index: PlaceIndex): ParsedQuery {
  const trimmed = text.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);

  let lastNumber = -1;
  words.forEach((word, position) => {
    if (/^\d+$/.test(word)) lastNumber = position;
  });

  // Sin número, o con el número al final, no hay nada que separar.
  if (lastNumber === -1 || lastNumber === words.length - 1) {
    return { address: trimmed, place: null };
  }

  const candidate = normalizePlaceName(words.slice(lastNumber + 1).join(" "));
  const place = lookupPlace(index, candidate);

  // El sobrante no es un lugar conocido: puede ser parte de la dirección
  // ("belgrano 500 piso 3"), así que se busca el texto completo.
  if (!place) return { address: trimmed, place: null };

  return { address: words.slice(0, lastNumber + 1).join(" "), place };
}
