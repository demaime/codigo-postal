"use client";

import { useCallback, useRef, useState } from "react";

import type { Coordinates } from "@/app/lib/types";

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 8000,
  maximumAge: 5 * 60 * 1000,
};

export type UseUserLocation = {
  coords: Coordinates | null;
  /** Pide la ubicación. Resuelve `null` si el usuario la niega o falla. */
  request: () => Promise<Coordinates | null>;
};

/**
 * Geolocalización del navegador, promisificada.
 *
 * Se pide al buscar y en silencio: si el usuario la concede, los resultados se
 * ordenan por cercanía; si no, no se usa y no se le insiste. Por eso el hook no
 * expone estados de permiso — nadie los muestra.
 *
 * `getCurrentPosition` es callback-based, y esa es exactamente la razón por la
 * que el orden por cercanía no funcionaba antes: se disparaba el callback y se
 * seguía de largo calculando distancias contra el estado viejo. Acá la posición
 * se devuelve como promesa y nunca se lee de un closure.
 */
export function useUserLocation(): UseUserLocation {
  const [coords, setCoords] = useState<Coordinates | null>(null);

  const coordsRef = useRef<Coordinates | null>(null);
  const inFlightRef = useRef<Promise<Coordinates | null> | null>(null);

  const request = useCallback(async (): Promise<Coordinates | null> => {
    // Ya la tenemos: no se vuelve a molestar al GPS ni al usuario.
    if (coordsRef.current) return coordsRef.current;
    // Dos búsquedas seguidas no abren dos prompts.
    if (inFlightRef.current) return inFlightRef.current;

    if (typeof navigator === "undefined" || !navigator.geolocation) return null;

    const pending = new Promise<Coordinates | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const next: Coordinates = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            // Puede venir NaN o ausente en implementaciones viejas: sin dato,
            // se asume lo peor y las distancias se muestran con reservas.
            accuracyMeters: Number.isFinite(position.coords.accuracy)
              ? position.coords.accuracy
              : Number.POSITIVE_INFINITY,
          };
          coordsRef.current = next;
          setCoords(next);
          resolve(next);
        },
        // Negada, vencida o no disponible: se sigue sin ella.
        () => resolve(null),
        GEO_OPTIONS,
      );
    }).finally(() => {
      inFlightRef.current = null;
    });

    inFlightRef.current = pending;
    return pending;
  }, []);

  return { coords, request };
}
