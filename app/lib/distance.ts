/**
 * Distancia en km entre dos puntos sobre la esfera terrestre (Haversine).
 */
export function getGeoDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Radio de la Tierra en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Distancia legible en es-AR: metros redondeados de a 10 abajo del kilómetro,
 * un decimal hasta 10 km, y entero de ahí en adelante.
 *
 *   0.32  -> "320 m"
 *   2.43  -> "2,4 km"
 *   145.2 -> "145 km"
 */
export function formatDistance(km: number): string {
  if (!Number.isFinite(km) || km < 0) return "";

  if (km < 1) {
    const meters = Math.round((km * 1000) / 10) * 10;
    // 0,995 km redondea a 1000 m: mejor decirlo en km.
    if (meters >= 1000) return "1 km";
    return `${meters} m`;
  }

  if (km < 10) {
    return `${km.toLocaleString("es-AR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} km`;
  }

  return `${Math.round(km).toLocaleString("es-AR")} km`;
}

/**
 * Distancia con el margen de error del navegador puesto encima.
 *
 * Si la dirección cae dentro del radio de incertidumbre de tu propia posición,
 * el número calculado no significa nada: podés estar parado justo ahí. En una
 * desktop, que se ubica por WiFi e IP, ese radio suele ser de kilómetros, y
 * anunciar "a 1,6 km" de algo que tenés enfrente es inventar precisión.
 *
 * El orden por cercanía sí sobrevive a un radio grande —alcanza para separar tu
 * ciudad de una a 300 km—, así que se sigue ordenando igual: lo único que se
 * deja de afirmar es la cifra exacta.
 */
/**
 * Techo de lo que puede llamarse "cerca tuyo", sin importar cuán impreciso sea
 * el navegador. Un margen de error enorme no convierte a Lanús en tu cuadra.
 */
const MAX_NEARBY_KM = 3;

export function isWithinAccuracy(
  km: number,
  accuracyMeters: number | null,
): boolean {
  // Sin un margen conocido y finito no se suprime nada: se muestra el número.
  // Al revés —dar por infinito el margen— cualquier distancia entra dentro de
  // él y hasta Rosario pasaría por estar al lado.
  if (accuracyMeters === null || !Number.isFinite(accuracyMeters)) return false;
  if (!Number.isFinite(km)) return false;
  if (km > MAX_NEARBY_KM) return false;

  return km * 1000 <= accuracyMeters;
}

export function describeDistance(
  km: number,
  accuracyMeters: number | null,
): string {
  if (!Number.isFinite(km) || km < 0) return "";
  if (isWithinAccuracy(km, accuracyMeters)) return "cerca tuyo";

  return `a ${formatDistance(km)}`;
}
