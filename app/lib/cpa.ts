/**
 * Códigos postales argentinos.
 *
 * Desde 1998 rige el CPA: una letra de provincia, cuatro dígitos y tres letras
 * de manzana (`C1043ABC`). El código viejo de cuatro dígitos (`1043`) sigue
 * siendo válido y es lo que suele tener cargado OpenStreetMap. Como los datos
 * llegan de OSM con formatos mezclados (`c1043 aay`, `B-1648`), se normalizan
 * antes de mostrarlos y de deduplicar resultados.
 */

/** Deja el código en mayúsculas y sin separadores. Devuelve `null` si queda vacío. */
export function normalizePostcode(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return cleaned.length > 0 ? cleaned : null;
}
