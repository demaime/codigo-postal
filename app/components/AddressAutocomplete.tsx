"use client";

import { useId, useRef, useState } from "react";
import { MdClose, MdSearch } from "react-icons/md";

import { describeDistance } from "@/app/lib/distance";
import { MIN_QUERY_LENGTH } from "@/app/lib/nominatim";
import type { SuggestionWithDistance } from "@/app/lib/types";

type AddressAutocompleteProps = {
  value: string;
  onChange: (value: string) => void;
  /** Se elige una dirección con altura: hay que resolverle el código postal. */
  onSelect: (suggestion: SuggestionWithDistance) => void;
  /** Enter: buscar lo que está escrito, sin importar qué muestre la lista. */
  onSubmit: (query: string) => void;
  suggestions: SuggestionWithDistance[];
  /** Coincidencias totales antes de recortar, para poder avisar que hay más. */
  total: number;
  /** Ciudad detectada que no tenía la dirección buscada. */
  widenedFrom: string | null;
  isLoading: boolean;
  isBusy: boolean;
  /** Margen de error de la ubicación del navegador, en metros. */
  accuracyMeters: number | null;
};

/**
 * Combobox de direcciones según el patrón ARIA: el input mantiene el foco
 * siempre y la opción activa se comunica con `aria-activedescendant`, así el
 * teclado y los lectores de pantalla funcionan sin trucos.
 */
export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  onSubmit,
  suggestions,
  total,
  widenedFrom,
  isLoading,
  isBusy,
  accuracyMeters,
}: AddressAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const optionId = (index: number) => `${baseId}-option-${index}`;

  const isTooShort = value.trim().length < MIN_QUERY_LENGTH;
  const showList = isOpen && !isTooShort && suggestions.length > 0;

  // Si cambian las sugerencias, la opción resaltada vuelve al principio. Se
  // ajusta durante el render y no en un efecto: así no hay un frame pintado
  // con el índice viejo apuntando a otra dirección.
  const [renderedSuggestions, setRenderedSuggestions] = useState(suggestions);
  if (renderedSuggestions !== suggestions) {
    setRenderedSuggestions(suggestions);
    setActiveIndex(-1);
  }

  /**
   * Se buscó: el desplegable se va y el campo suelta el foco. Si no, la lista
   * queda flotando encima del resultado que se acaba de pedir.
   */
  function dismiss() {
    setIsOpen(false);
    setActiveIndex(-1);
    inputRef.current?.blur();
  }

  function choose(suggestion: SuggestionWithDistance) {
    // Sin altura no hay código postal posible: se completa la calle y se
    // devuelve el cursor para que el usuario escriba el número.
    if (suggestion.number === null) {
      onChange(`${suggestion.label} `);
      inputRef.current?.focus();
      return;
    }

    onChange(suggestion.label);
    dismiss();
    onSelect(suggestion);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) =>
        suggestions.length === 0 ? -1 : (current + 1) % suggestions.length,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        suggestions.length === 0
          ? -1
          : (current - 1 + suggestions.length) % suggestions.length,
      );
      return;
    }

    if (event.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
    // Enter lo maneja el submit del formulario.
  }

  return (
    <form
      role="search"
      className="relative w-full"
      onSubmit={(event) => {
        event.preventDefault();

        // Solo gana la lista si el usuario bajó a propósito con las flechas.
        if (showList && activeIndex >= 0) {
          choose(suggestions[activeIndex]);
          return;
        }

        // Si no, Enter significa "buscá lo que escribí". Antes tomaba la
        // primera sugerencia, y escribiendo rápido esa lista todavía era la
        // del texto anterior: elegía una calle sin altura y el atajo de
        // autocompletar borraba el número recién tipeado.
        dismiss();
        onSubmit(value);
      }}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
        <div className="relative flex-1">
          <label htmlFor={`${baseId}-input`} className="sr-only">
            Dirección a buscar
          </label>

          <MdSearch
            className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-mist-500"
            aria-hidden="true"
          />

          <input
            id={`${baseId}-input`}
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={
              activeIndex >= 0 ? optionId(activeIndex) : undefined
            }
            aria-busy={isBusy}
            autoComplete="off"
            enterKeyHint="search"
            placeholder="Balcarce 50"
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
              setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsOpen(true)}
            // El cierre se demora para que el click en una opción llegue antes.
            onBlur={() => setTimeout(() => setIsOpen(false), 150)}
            className="h-13 w-full rounded-xl border border-ink-700 bg-ink-900 pr-11 pl-11 text-mist-50 placeholder:text-mist-500 focus:border-beak-500 focus:outline-none sm:h-14"
          />

          {value.length > 0 && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                inputRef.current?.focus();
              }}
              aria-label="Limpiar la búsqueda"
              className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-1 text-mist-500 transition-colors hover:text-mist-50"
            >
              <MdClose className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={isBusy || isTooShort}
          className="h-13 shrink-0 rounded-xl bg-beak-500 px-7 font-semibold text-ink-950 transition-colors hover:bg-beak-300 disabled:cursor-not-allowed disabled:bg-ink-700 disabled:text-mist-500 sm:h-14"
        >
          {isBusy ? "Buscando…" : "Buscar"}
        </button>
      </div>

    <div
      hidden={!showList}
      className="absolute top-full right-0 left-0 z-30 mt-2 overflow-hidden rounded-xl border border-ink-700 bg-ink-900 shadow-2xl shadow-ink-950/60 sm:right-32"
    >
      <ul
        id={listboxId}
        role="listbox"
        aria-label="Direcciones sugeridas"
        // Scrolleable: entran muchas más de las que caben en pantalla.
        className="max-h-[min(22rem,50vh)] overflow-y-auto"
      >
        {suggestions.map((suggestion, index) => (
          <li
            key={suggestion.id}
            id={optionId(index)}
            role="option"
            aria-selected={index === activeIndex}
            onMouseDown={(event) => {
              // Antes del blur, para no perder el click.
              event.preventDefault();
              choose(suggestion);
            }}
            onMouseEnter={() => setActiveIndex(index)}
            className={`flex cursor-pointer items-baseline gap-3 px-4 py-2.5 ${
              index === activeIndex ? "bg-ink-800" : ""
            }`}
          >
            <span className="min-w-0 flex-1 truncate text-mist-50">
              {suggestion.label}
            </span>

            {/* La provincia al lado, que es lo que distingue una de otra.
                En CABA el departamento repite el nombre de la provincia
                ("Comuna 1" vs "Ciudad Autónoma…"), así que se filtra el
                duplicado en vez de escribirlo dos veces. */}
            <span className="min-w-0 shrink truncate text-right text-xs text-mist-500">
              {[suggestion.department, suggestion.province]
                .filter(Boolean)
                .filter((part, index, parts) => parts.indexOf(part) === index)
                .join(" · ")}
            </span>

            {suggestion.distanceKm !== null && (
              <span className="shrink-0 text-xs whitespace-nowrap text-beak-300">
                {describeDistance(suggestion.distanceKm, accuracyMeters)}
              </span>
            )}
          </li>
        ))}
        </ul>

        {/* La detección de ciudad es silenciosa cuando acierta —se ve en los
            resultados—. Solo se habla si hubo que ampliar la búsqueda. */}
        {widenedFrom ? (
          <p className="border-t border-ink-700 px-4 py-2 text-xs text-beak-300">
            No hay ninguna en {widenedFrom}. Estas son de otras ciudades.
          </p>
        ) : (
          total > suggestions.length && (
            <p className="border-t border-ink-700 px-4 py-2 text-xs text-mist-500">
              Mostrando {suggestions.length} de {total}. Agregá la localidad para
              afinar la búsqueda.
            </p>
          )
        )}
      </div>

      {isLoading && !showList && (
        <span className="sr-only" role="status" aria-live="polite">
          Buscando direcciones
        </span>
      )}
    </form>
  );
}
