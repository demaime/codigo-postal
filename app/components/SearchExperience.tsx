"use client";

import { useCallback, useMemo, useState } from "react";
import { motion } from "motion/react";

import AddressAutocomplete from "./AddressAutocomplete";
import AlternativeResults, { type Alternative } from "./AlternativeResults";
import BrandHeader from "./BrandHeader";
import PrimaryResult from "./PrimaryResult";
import ErrorState from "./states/ErrorState";
import NoResults from "./states/NoResults";
import PrimarySkeleton from "./states/PrimarySkeleton";
import { usePostcode } from "@/app/hooks/usePostcode";
import { useSearch } from "@/app/hooks/useSearch";
import { useSuggestions } from "@/app/hooks/useSuggestions";
import { useUserLocation } from "@/app/hooks/useUserLocation";
import { getGeoDistance } from "@/app/lib/distance";
import { hasHouseNumber } from "@/app/lib/georef";
import { MIN_QUERY_LENGTH } from "@/app/lib/nominatim";
import type {
  PostalResult,
  PostcodeResult,
  ResolvedPlace,
  SuggestionWithDistance,
} from "@/app/lib/types";

const LAYOUT_TRANSITION = {
  duration: 0.8,
  ease: [0.16, 1, 0.3, 1] as const,
};

const MAX_ALTERNATIVES = 5;

function areaOf(parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(" · ");
}

function toAlternative(place: {
  id: string;
  label: string;
  area: string;
  distanceKm: number | null;
}): Alternative {
  return place;
}

export default function SearchExperience() {
  const { coords, request: requestLocation } = useUserLocation();
  const postcode = usePostcode();
  const freeText = useSearch();

  const [query, setQuery] = useState("");
  /** Mientras hay un resultado en pantalla no se piden más sugerencias. */
  const [isTyping, setIsTyping] = useState(true);
  const [selected, setSelected] = useState<SuggestionWithDistance | null>(null);
  /** Las sugerencias vigentes al elegir: de ahí salen las alternativas. */
  const [candidates, setCandidates] = useState<SuggestionWithDistance[]>([]);
  const [activeFreeTextId, setActiveFreeTextId] = useState<string | null>(null);

  const suggest = useSuggestions({ query, coords, enabled: isTyping });

  const hasOutput =
    postcode.state.status !== "idle" || freeText.state.status !== "idle";

  const resetOutput = useCallback(() => {
    postcode.reset();
    freeText.reset();
    setSelected(null);
    setCandidates([]);
    setActiveFreeTextId(null);
  }, [postcode, freeText]);

  const handleChange = useCallback(
    (value: string) => {
      setQuery(value);
      setIsTyping(true);

      // Se pide apenas hay algo que buscar, no al elegir. Si se esperara a la
      // selección, la primera búsqueda de la sesión saldría sin coordenadas y
      // volvería ordenada alfabéticamente en vez de por cercanía —justo la
      // búsqueda en la que el usuario todavía no sabe si la app sirve—. El
      // hook cachea la posición y deduplica, así que llamarlo en cada tecla
      // abre un solo prompt.
      if (value.trim().length >= MIN_QUERY_LENGTH) void requestLocation();

      if (value.trim() === "") resetOutput();
    },
    [requestLocation, resetOutput],
  );

  const handleSelect = useCallback(
    (
      suggestion: SuggestionWithDistance,
      /** De dónde salen las alternativas. Enter pasa su lista recién traída,
       *  porque el estado de React todavía tiene la anterior. */
      pool?: SuggestionWithDistance[],
    ) => {
      // La ubicación se pide en silencio: sirve para ordenar las sugerencias
      // siguientes por cercanía.
      void requestLocation();
      freeText.reset();
      setActiveFreeTextId(null);
      setCandidates(pool ?? suggest.suggestions);
      setSelected(suggestion);
      setIsTyping(false);
      void postcode.resolve(suggestion);
    },
    [freeText, postcode, requestLocation, suggest.suggestions],
  );

  const searchFreeText = useCallback(
    (value: string) => {
      postcode.reset();
      setSelected(null);
      setCandidates([]);
      setActiveFreeTextId(null);
      setIsTyping(false);
      void freeText.search(value);
    },
    [freeText, postcode],
  );

  /**
   * Enter: resolver lo que está escrito, sin mirar lo que muestra la lista.
   *
   * Se vuelve a pedir a georef salteando el debounce —escribiendo rápido la
   * lista en pantalla todavía es la del texto anterior— y recién con esas
   * sugerencias en la mano se resuelve la primera con altura. Antes tomaba la
   * primera de la lista vieja, que solía ser una calle sin número, y el atajo
   * de autocompletar borraba lo recién tipeado.
   */
  const handleSubmit = useCallback(
    async (value: string) => {
      void requestLocation();

      if (hasHouseNumber(value)) {
        const fresh = await suggest.refresh();
        const best = fresh.find((item) => item.number !== null);

        if (best) {
          handleSelect(best, fresh);
          return;
        }
      }

      // Sin altura, o sin ninguna dirección concreta: lo resuelve el buscador
      // libre, que es lo que responde por "Obelisco".
      searchFreeText(value);
    },
    [handleSelect, requestLocation, searchFreeText, suggest],
  );

  /** Resultados del buscador libre, medidos y ordenados por cercanía. */
  const freeTextPlaces: ResolvedPlace[] = useMemo(() => {
    if (freeText.state.status !== "success") return [];

    const measured = freeText.state.results.map((result: PostalResult) => ({
      id: result.id,
      postcode: result.postcode,
      // Es un tramo de calle o un punto de interés, no una puerta concreta.
      precision: "approx" as const,
      label: result.street ?? result.locality ?? result.displayName,
      area: areaOf([result.locality, result.province]),
      lat: result.lat,
      lon: result.lon,
      distanceKm: coords
        ? getGeoDistance(result.lat, result.lon, coords.lat, coords.lon)
        : null,
    }));

    if (coords) {
      measured.sort(
        (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity),
      );
    }

    return measured.slice(0, MAX_ALTERNATIVES + 1);
  }, [freeText.state, coords]);

  const primary: ResolvedPlace | null = useMemo(() => {
    if (selected && postcode.state.status === "success") {
      const result: PostcodeResult = postcode.state.result;

      return {
        id: selected.id,
        postcode: result.postcode,
        precision: result.precision,
        label: selected.label,
        area: areaOf([selected.department, selected.province]),
        lat: result.lat,
        lon: result.lon,
        distanceKm: selected.distanceKm,
      };
    }

    if (freeTextPlaces.length > 0) {
      return (
        freeTextPlaces.find((place) => place.id === activeFreeTextId) ??
        freeTextPlaces[0]
      );
    }

    return null;
  }, [selected, postcode.state, freeTextPlaces, activeFreeTextId]);

  const alternatives: Alternative[] = useMemo(() => {
    if (selected) {
      return candidates
        .filter((candidate) => candidate.id !== selected.id)
        .slice(0, MAX_ALTERNATIVES)
        .map((candidate) =>
          toAlternative({
            id: candidate.id,
            label: candidate.label,
            area: areaOf([candidate.department, candidate.province]),
            distanceKm: candidate.distanceKm,
          }),
        );
    }

    return freeTextPlaces
      .filter((place) => place.id !== primary?.id)
      .slice(0, MAX_ALTERNATIVES)
      .map((place) =>
        toAlternative({
          id: place.id,
          label: place.label,
          area: place.area,
          distanceKm: place.distanceKm,
        }),
      );
  }, [selected, candidates, freeTextPlaces, primary]);

  const handleAlternative = useCallback(
    (id: string) => {
      const candidate = candidates.find((item) => item.id === id);

      if (candidate) {
        setSelected(candidate);
        setQuery(candidate.label);
        void postcode.resolve(candidate);
        return;
      }

      // En el buscador libre el código postal ya vino con el resultado:
      // alcanza con cambiar cuál es el protagonista.
      setActiveFreeTextId(id);
    },
    [candidates, postcode],
  );

  function renderOutput() {
    if (postcode.state.status === "loading" || freeText.state.status === "loading")
      return <PrimarySkeleton />;

    if (postcode.state.status === "error")
      return (
        <ErrorState
          message={postcode.state.message}
          onRetry={() => selected && void postcode.resolve(selected)}
        />
      );

    if (freeText.state.status === "error")
      return (
        <ErrorState message={freeText.state.message} onRetry={freeText.retry} />
      );

    if (freeText.state.status === "empty")
      return <NoResults query={freeText.state.query} />;

    if (!primary) return null;

    return (
      <>
        <PrimaryResult
          place={primary}
          accuracyMeters={coords?.accuracyMeters ?? null}
        />
        <AlternativeResults
          alternatives={alternatives}
          onSelect={handleAlternative}
          accuracyMeters={coords?.accuracyMeters ?? null}
        />
      </>
    );
  }

  const isHero = !hasOutput;

  return (
    // `h-full` + `flex-col` es lo que le da altura al `flex-1` de abajo: sin
    // eso la portada se pega arriba en vez de quedar centrada verticalmente.
    <div className="relative z-10 mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden px-4 sm:px-6 lg:px-8">
      <motion.div
        layout
        transition={LAYOUT_TRANSITION}
        className={
          isHero
            ? "flex flex-1 flex-col items-center justify-center gap-10 pb-[8vh] sm:gap-12"
            : "flex shrink-0 flex-row items-center gap-3 pt-5 sm:gap-4"
        }
      >
        <BrandHeader compact={!isHero} />

        <motion.div
          layout
          transition={LAYOUT_TRANSITION}
          className={isHero ? "w-full max-w-2xl" : "min-w-0 flex-1"}
        >
          <AddressAutocomplete
            value={query}
            onChange={handleChange}
            onSelect={handleSelect}
            onSubmit={(value) => void handleSubmit(value)}
            suggestions={suggest.suggestions}
            total={suggest.total}
            widenedFrom={suggest.widenedFrom}
            isLoading={suggest.isLoading}
            isBusy={
              postcode.state.status === "loading" ||
              freeText.state.status === "loading"
            }
            accuracyMeters={coords?.accuracyMeters ?? null}
          />
        </motion.div>
      </motion.div>

      {!isHero && (
        <motion.div
          layout
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...LAYOUT_TRANSITION, delay: 0.25 }}
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto pt-8 pb-6"
        >
          {renderOutput()}
        </motion.div>
      )}
    </div>
  );
}
