"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { MIN_QUERY_LENGTH } from "@/app/lib/nominatim";
import type {
  ApiErrorBody,
  Coordinates,
  SuggestResponse,
  SuggestionWithDistance,
} from "@/app/lib/types";

/** Se busca cuando dejás de tipear, no en cada tecla. */
const DEBOUNCE_MS = 300;

export type SuggestionsState = {
  suggestions: SuggestionWithDistance[];
  total: number;
  /** Ciudad detectada que no tenía la dirección: se buscó en todo el país. */
  widenedFrom: string | null;
  isLoading: boolean;
  error: string | null;
};

export type UseSuggestions = SuggestionsState & {
  /**
   * Busca ya, sin esperar el debounce, y devuelve las sugerencias de ese
   * texto. Es lo que hace Enter: quien lo llama necesita la lista fresca en
   * la mano, porque el estado de React todavía no se actualizó.
   */
  refresh: () => Promise<SuggestionWithDistance[]>;
};

const EMPTY: SuggestionsState = {
  suggestions: [],
  total: 0,
  widenedFrom: null,
  isLoading: false,
  error: null,
};

type UseSuggestionsOptions = {
  query: string;
  coords: Coordinates | null;
  /** Se apaga mientras hay un resultado en pantalla. */
  enabled?: boolean;
};

/**
 * Sugerencias de direcciones mientras se escribe.
 *
 * El estado nunca se limpia al acortar la query: de eso se encarga el
 * componente decidiendo cuándo mostrar la lista. Así el hook no necesita
 * llamar a `setState` de forma síncrona dentro del efecto.
 */
export function useSuggestions({
  query,
  coords,
  enabled = true,
}: UseSuggestionsOptions): UseSuggestions {
  const [state, setState] = useState<SuggestionsState>(EMPTY);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lat = coords?.lat ?? null;
  const lon = coords?.lon ?? null;

  useEffect(() => () => abortRef.current?.abort(), []);

  const run = useCallback(
    async (trimmed: string): Promise<SuggestionWithDistance[]> => {
      // Cada búsqueda invalida la anterior: una respuesta vieja no puede
      // llegar tarde y pisar a la nueva.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setState((current) => ({ ...current, isLoading: true, error: null }));

      try {
        const params = new URLSearchParams({ q: trimmed });
        if (lat !== null && lon !== null) {
          params.set("lat", String(lat));
          params.set("lon", String(lon));
        }

        const response = await fetch(`/api/suggest?${params.toString()}`, {
          signal: controller.signal,
        });

        const payload: unknown = await response.json();
        if (controller.signal.aborted) return [];

        if (!response.ok) {
          setState({
            ...EMPTY,
            error:
              (payload as ApiErrorBody)?.error?.message ??
              "No pudimos buscar direcciones.",
          });
          return [];
        }

        const data = payload as SuggestResponse;
        const suggestions = data.suggestions ?? [];

        setState({
          suggestions,
          total: data.total ?? 0,
          widenedFrom: data.widenedFrom ?? null,
          isLoading: false,
          error: null,
        });

        return suggestions;
      } catch (error) {
        if (controller.signal.aborted) return [];
        if (error instanceof Error && error.name === "AbortError") return [];

        setState({ ...EMPTY, error: "No pudimos buscar direcciones." });
        return [];
      }
    },
    [lat, lon],
  );

  useEffect(() => {
    const trimmed = query.trim();
    if (!enabled || trimmed.length < MIN_QUERY_LENGTH) return;

    timerRef.current = setTimeout(() => void run(trimmed), DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, enabled, run]);

  /**
   * Enter no espera. Se cancela el debounce pendiente para no disparar dos
   * veces la misma consulta.
   */
  const refresh = useCallback(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) return Promise.resolve([]);

    if (timerRef.current) clearTimeout(timerRef.current);
    return run(trimmed);
  }, [query, run]);

  return { ...state, refresh };
}
