"use client";

import { useEffect } from "react";
import { MdErrorOutline, MdRefresh } from "react-icons/md";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <MdErrorOutline className="h-10 w-10 text-beak-500" aria-hidden="true" />

      <h1 className="text-2xl font-bold text-mist-50">Algo se rompió</h1>
      <p className="max-w-md text-sm text-mist-300">
        Tuvimos un problema inesperado al mostrar esta página. Podés intentar de
        nuevo.
      </p>

      <button
        type="button"
        onClick={reset}
        className="mt-2 inline-flex items-center gap-2 rounded-lg bg-beak-500 px-4 py-2 text-sm font-semibold text-ink-950 transition-colors hover:bg-beak-300"
      >
        <MdRefresh className="h-4 w-4" aria-hidden="true" />
        Reintentar
      </button>
    </main>
  );
}
