"use client";

import { describeDistance } from "@/app/lib/distance";

export type Alternative = {
  id: string;
  label: string;
  area: string;
  distanceKm: number | null;
};

type AlternativeResultsProps = {
  alternatives: Alternative[];
  onSelect: (id: string) => void;
  /** Margen de error de la ubicación del navegador, en metros. */
  accuracyMeters: number | null;
};

/** Las otras coincidencias, por si la primera no era la buscada. */
export default function AlternativeResults({
  alternatives,
  onSelect,
  accuracyMeters,
}: AlternativeResultsProps) {
  if (alternatives.length === 0) return null;

  return (
    <section className="mt-5">
      <h2 className="text-xs tracking-wide text-mist-500 uppercase">
        ¿No era esta?
      </h2>

      <ul className="mt-3 flex flex-wrap gap-2">
        {alternatives.map((alternative) => (
          <li key={alternative.id}>
            <button
              type="button"
              onClick={() => onSelect(alternative.id)}
              className="rounded-xl bg-ink-900/70 px-3.5 py-2.5 text-left transition-colors duration-150 hover:bg-ink-700"
            >
              <span className="block text-sm text-mist-50">
                {alternative.label}
              </span>
              <span className="block text-xs text-mist-500">
                {alternative.area}
                {alternative.distanceKm !== null && (
                  <span className="text-beak-300">
                    {" · "}{describeDistance(alternative.distanceKm, accuracyMeters)}
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
