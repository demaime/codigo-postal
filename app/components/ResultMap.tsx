"use client";

import { useEffect, useRef, useState } from "react";
import { Map, Marker, ZoomControl } from "pigeon-maps";
import { MdClose, MdOpenInFull } from "react-icons/md";

import { useInView } from "@/app/hooks/useInView";

type ResultMapProps = {
  lat: number;
  lon: number;
  /** Para el `aria-label` del botón y el encabezado del modal. */
  label: string;
  postcode?: string | null;
};

const MARKER_COLOR = "#ee843c";

/**
 * Mapa de la tarjeta. Se monta recién cuando entra al viewport, así una
 * búsqueda no dispara la descarga de tiles antes de tiempo.
 *
 * El de la tarjeta es inerte a propósito —no secuestra el scroll de la página—
 * y explorar se hace en el modal, que es una superficie dedicada donde arrastrar
 * y hacer zoom no compite con nada.
 */
export default function ResultMap({
  lat,
  lon,
  label,
  postcode,
}: ResultMapProps) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  // `<dialog>` nativo: Escape, el foco atrapado y el fondo bloqueado vienen
  // resueltos por el navegador. El evento `close` cubre las tres formas de
  // cerrarlo (Escape, el botón y el backdrop).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => setIsOpen(false);
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, []);

  return (
    <>
      <div
        ref={ref}
        className="relative h-56 w-full overflow-hidden rounded-xl bg-ink-800 sm:h-72"
      >
        {inView ? (
          <>
            <Map
              defaultCenter={[lat, lon]}
              defaultZoom={16}
              animate
              mouseEvents={false}
              touchEvents={false}
            >
              <Marker width={38} anchor={[lat, lon]} color={MARKER_COLOR} />
            </Map>

            <button
              type="button"
              onClick={() => {
                setIsOpen(true);
                dialogRef.current?.showModal();
              }}
              aria-label={`Ver el mapa de ${label} en pantalla completa`}
              className="absolute top-2 right-2 z-10 rounded-lg bg-ink-950/70 p-2 text-mist-300 backdrop-blur-sm transition-colors hover:text-beak-300"
            >
              <MdOpenInFull className="h-4 w-4" aria-hidden="true" />
            </button>
          </>
        ) : (
          <div className="skeleton h-full w-full" />
        )}
      </div>

      <dialog
        ref={dialogRef}
        aria-label={`Mapa de ${label}`}
        // `m-auto` no es decorativo: el navegador centra el diálogo con
        // `margin: auto`, y el preflight de Tailwind lo pisa con `margin: 0`.
        // Sin esto queda pegado arriba a la izquierda.
        className="m-auto h-[90vh] w-[92vw] max-w-5xl overflow-hidden rounded-2xl border border-ink-600 bg-ink-900 p-0 text-mist-50 shadow-2xl shadow-black/60 backdrop:bg-ink-950/70 backdrop:backdrop-blur-sm"
      >
        {/* Solo se monta abierto: cerrado no baja tiles. */}
        {isOpen && (
          <div className="flex h-full flex-col">
            {/* Tono propio, más oscuro que el cuerpo, y una línea naranja que
                lo separa del mapa: sin eso el header se confundía con el fondo
                de la app que se ve por detrás. */}
            <header className="flex shrink-0 items-center justify-between gap-4 border-b-2 border-beak-500 bg-ink-950 px-4 py-3">
              <p className="min-w-0 truncate">
                {postcode && (
                  <span className="tabular font-semibold text-beak-500">
                    {postcode}
                  </span>
                )}
                {postcode && <span className="text-mist-500"> · </span>}
                <span className="text-mist-300">{label}</span>
              </p>

              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                aria-label="Cerrar el mapa"
                className="shrink-0 rounded-lg p-2 text-mist-500 transition-colors hover:bg-ink-800 hover:text-mist-50"
              >
                <MdClose className="h-5 w-5" aria-hidden="true" />
              </button>
            </header>

            <div className="relative min-h-0 flex-1">
              <Map defaultCenter={[lat, lon]} defaultZoom={16} animate>
                <ZoomControl />
                <Marker width={48} anchor={[lat, lon]} color={MARKER_COLOR} />
              </Map>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
