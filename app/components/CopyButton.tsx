"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MdCheck, MdContentCopy } from "react-icons/md";

type CopyButtonProps = {
  value: string;
  /** Contexto para el lector de pantalla: "Av. Corrientes 1234". */
  context?: string;
};

type CopyState = "idle" | "copied" | "failed";

/**
 * Botón real, no un `div` con `onClick`.
 *
 * La confirmación vive dentro del botón y se anuncia con `aria-live`, en lugar
 * de un toast global (antes se montaba un `ToastContainer` por tarjeta, y su
 * CSS ni siquiera estaba importado).
 */
export default function CopyButton({ value, context }: CopyButtonProps) {
  const [state, setState] = useState<CopyState>("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  const handleCopy = useCallback(async () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      // Contexto no seguro o permiso denegado: se avisa en vez de fallar mudo.
      setState("failed");
    }

    timeoutRef.current = setTimeout(() => setState("idle"), 2000);
  }, [value]);

  return (
    <>
      <button
        type="button"
        onClick={handleCopy}
        title={state === "failed" ? "No se pudo copiar" : "Copiar"}
        aria-label={
          context
            ? `Copiar el código postal ${value} de ${context}`
            : `Copiar el código postal ${value}`
        }
        className={`shrink-0 rounded-lg p-2 transition-colors ${
          state === "copied"
            ? "text-beak-300"
            : "text-mist-500 hover:bg-ink-800 hover:text-mist-50"
        }`}
      >
        {state === "copied" ? (
          <MdCheck className="h-5 w-5" aria-hidden="true" />
        ) : (
          <MdContentCopy className="h-5 w-5" aria-hidden="true" />
        )}
      </button>

      <span role="status" aria-live="polite" className="sr-only">
        {state === "copied"
          ? `Código postal ${value} copiado al portapapeles`
          : state === "failed"
            ? "No se pudo copiar el código postal"
            : ""}
      </span>
    </>
  );
}
