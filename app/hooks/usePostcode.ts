"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  AddressSuggestion,
  ApiErrorBody,
  PostcodeResult,
} from "@/app/lib/types";

export type PostcodeState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; result: PostcodeResult }
  | { status: "error"; message: string };

export type UsePostcode = {
  state: PostcodeState;
  resolve: (address: AddressSuggestion) => Promise<void>;
  reset: () => void;
};

/** Resuelve el código postal de una dirección ya elegida. */
export function usePostcode(): UsePostcode {
  const [state, setState] = useState<PostcodeState>({ status: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const resolve = useCallback(async (address: AddressSuggestion) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ status: "loading" });

    try {
      const params = new URLSearchParams({
        street: address.street,
        province: address.province,
        locality: address.locality,
        department: address.department,
        lat: String(address.lat),
        lon: String(address.lon),
      });
      if (address.number !== null) params.set("number", String(address.number));

      const response = await fetch(`/api/postcode?${params.toString()}`, {
        signal: controller.signal,
      });

      const payload: unknown = await response.json();
      if (controller.signal.aborted) return;

      if (!response.ok) {
        setState({
          status: "error",
          message:
            (payload as ApiErrorBody)?.error?.message ??
            "No pudimos obtener el código postal.",
        });
        return;
      }

      setState({ status: "success", result: payload as PostcodeResult });
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof Error && error.name === "AbortError") return;

      setState({
        status: "error",
        message: "No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.",
      });
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState({ status: "idle" });
  }, []);

  return { state, resolve, reset };
}
