"use client";
import Image from "next/image";
import "./styles/birds.css";
import { useRef, useState } from "react";
import axios from "axios";
import ResultCards from "./components/ResultCards copy";
import { ApiResponseData, DataWithDistance } from "./types";
import { motion } from "motion/react";
import Birds from "./components/Birds";
import { getGeoDistance } from "./helpers/getGeoDistance";
import { UserLocation } from "./types";
import Title from "./components/Title";

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [results, setResults] = useState<ApiResponseData[] | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation>({
    userLat: 0,
    userLon: 0,
  });
  const [isLoading, setIsLoading] = useState(false);

  async function getLocationData(inputSearchValue: string) {
    const url = `https://nominatim.openstreetmap.org/search?q=${inputSearchValue}&addressdetails=1&format=json&limit=20`;

    try {
      setIsLoading(true);
      const response = await axios.get<ApiResponseData[]>(url);
      navigator.geolocation.getCurrentPosition((userPosition) => {
        setUserLocation({
          userLat: userPosition.coords.latitude,
          userLon: userPosition.coords.longitude,
        });
      });
      const filteredResult: DataWithDistance[] = response.data
        .filter((location) => location.address.country === "Argentina")
        .map((location) => {
          const newLocation = location as DataWithDistance;
          newLocation.distance = getGeoDistance(
            parseFloat(newLocation.lat),
            parseFloat(newLocation.lon),
            userLocation.userLat,
            userLocation.userLon,
          );
          return newLocation;
        })
        .sort((a, b) => a.distance - b.distance);

      setResults(filteredResult);
      console.log(results);
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05 },
    },
  };

  const letterVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  console.log(results);

  return (
    <div className="h-dvh max-w-full overflow-hidden bg-[#1d2449]">
      <Birds />
      <div className="relative z-10 mx-auto flex h-full w-full max-w-6xl flex-col items-center gap-8 px-4 py-8 sm:gap-10 sm:px-6 sm:py-10 lg:gap-12 lg:px-12 lg:py-12">
        <Title />

        <form
          className="flex w-full flex-col items-center justify-center gap-4 sm:gap-6"
          onSubmit={(event) => {
            event.preventDefault();
            getLocationData(inputRef.current?.value || "");
          }}
        >
          <motion.input
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ ease: "easeOut", duration: 0.3 }}
            ref={inputRef}
            className="h-12 w-full max-w-xl rounded-md border border-orange-200 bg-transparent p-3 font-semibold text-white outline-none focus:border-orange-400 sm:h-14"
            placeholder="Ingrese una dirección"
            type="text"
          />

          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ ease: "easeOut", duration: 0.3 }}
            disabled={isLoading}
            className="w-full max-w-xl rounded bg-orange-600 px-6 py-3 text-gray-50 transition-all duration-100 hover:font-semibold disabled:opacity-60 sm:w-40"
          >
            {isLoading ? "Buscando" : "Buscar"}
          </motion.button>
        </form>

        {isLoading ? <div className="loader mt-24" /> : null}
        {!isLoading && results && results.length > 0 ? (
          <div className="w-full flex-1 min-h-0">
            <ResultCards results={results} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
