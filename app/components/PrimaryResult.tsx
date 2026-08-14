"use client";

import { motion } from "motion/react";

import CopyButton from "./CopyButton";
import ResultMap from "./ResultMap";
import { formatDistance, isWithinAccuracy } from "@/app/lib/distance";
import type { ResolvedPlace } from "@/app/lib/types";

type PrimaryResultProps = {
  place: ResolvedPlace;
  /** Margen de error de la ubicación del navegador, en metros. */
  accuracyMeters: number | null;
};

export default function PrimaryResult({
  place,
  accuracyMeters,
}: PrimaryResultProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="grid gap-6 rounded-2xl bg-ink-900/70 p-6 sm:grid-cols-[1fr_1.15fr] sm:items-center sm:gap-8 sm:p-8"
    >
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          {place.postcode ? (
            <p className="tabular truncate text-6xl leading-none font-semibold text-beak-500 sm:text-7xl">
              {place.postcode}
            </p>
          ) : (
            <p className="text-3xl leading-tight text-mist-500">
              Sin código postal
            </p>
          )}

          {place.postcode && (
            <CopyButton value={place.postcode} context={place.label} />
          )}
        </div>

        <p className="mt-6 truncate text-2xl font-medium text-mist-50">
          {place.label}
        </p>
        <p className="truncate text-base text-mist-300">{place.area}</p>

        {place.distanceKm !== null && (
          <p className="mt-1.5 text-sm text-beak-300">
            {isWithinAccuracy(place.distanceKm, accuracyMeters)
              ? // Dentro del margen de error de tu propia posición: afirmar una
                // cifra sería inventar precisión que el navegador no tiene.
                "cerca tuyo"
              : `a ${formatDistance(place.distanceKm)} de vos`}
          </p>
        )}

        {place.postcode && place.precision === "approx" && (
          // El código postal salió de la inversa, que se engancha al objeto
          // mapeado más cercano y puede ser de otra cuadra. Se dice.
          <p className="mt-4 text-xs text-mist-500">
            Código postal aproximado: corresponde a la cuadra, no a la puerta.
          </p>
        )}

        {!place.postcode && (
          <p className="mt-4 text-xs text-mist-500">
            OpenStreetMap no tiene cargado el código postal de esta dirección.
          </p>
        )}
      </div>

      <ResultMap
        lat={place.lat}
        lon={place.lon}
        label={place.label}
        postcode={place.postcode}
      />
    </motion.div>
  );
}
