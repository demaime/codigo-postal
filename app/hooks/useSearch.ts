"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { MIN_QUERY_LENGTH } from "@/app/lib/nominatim";
import type { ApiErrorBody, PostalResult, SearchSuccess } from "@/app/lib/types";

export type SearchState =
  | { status: "idle" }
  | { status: "loading"; query: string }
  | { status: "success"; query: string; results: PostalResult[] }
  | { status: "empty"; query: string }
  | {
      status: "error";
      query: string;
      message: string;
      /** `validation` se muestra pegado al input; `request` como panel con reintento. */
      kind: "validation" | "request";
    };

export type UseSearch = {
  state: SearchState;
  search: (query: string) => Promise<void>;
  retry: () => void;
  reset: () => void;
};

/**
 * Búsqueda contra nuestro propio endpoint (`/api/search`), que es el que habla
 * con Nominatim con el User-Agent y el caché puestos.
 *
 * Guarda los resultados **sin ordenar por distancia** a propósito: el orden por
 * cercanía se deriva de la ubicación en el componente, así conceder el permiso
 * más tarde reordena la lista sin volver a pedir nada a la red.
 */
export function useSearch(): UseSearch {
  const [state, setState] = useState<SearchState>({ status: "idle" });

  const abortRef = useRef<AbortController | null>(null);
  const lastQueryRef = useRef("");

  useEffect(() => () => abortRef.current?.abort(), []);

  const search = useCallback(async (rawQuery: string) => {
    const query = rawQuery.trim();
    lastQueryRef.current = query;

    if (query.length < MIN_QUERY_LENGTH) {
      setState({
        status: "error",
        query,
        kind: "validation",
        message: `Escribí al menos ${MIN_QUERY_LENGTH} caracteres.`,
      });
      return;
    }

    // Una búsqueda nueva invalida la anterior: la respuesta vieja no puede
    // llegar tarde y pisar a la nueva.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ status: "loading", query });

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      });

      const payload: unknown = await response.json();

      if (controller.signal.aborted) return;

      if (!response.ok) {
        const message =
          (payload as ApiErrorBody)?.error?.message ??
          "No pudimos completar la búsqueda. Intentá de nuevo.";
        setState({ status: "error", query, kind: "request", message });
        return;
      }

      const results = (payload as SearchSuccess).results ?? [];

      setState(
        results.length > 0
          ? { status: "success", query, results }
          : { status: "empty", query },
      );
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof Error && error.name === "AbortError") return;

      setState({
        status: "error",
        query,
        kind: "request",
        message: "No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.",
      });
    }
  }, []);

  const retry = useCallback(() => {
    void search(lastQueryRef.current);
  }, [search]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    lastQueryRef.current = "";
    setState({ status: "idle" });
  }, []);

  return { state, search, retry, reset };
}
