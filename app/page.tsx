"use client";
import Image from "next/image";
import { useRef, useState } from "react";
import axios from "axios";
import ResultCards from "./components/ResultCards";
import { ApiResponseData } from "./types";
import { motion } from "motion/react";

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [results, setResults] = useState<ApiResponseData[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function getLocationData(inputSearchValue: string) {
    const url = `https://nominatim.openstreetmap.org/search?q=${inputSearchValue}&addressdetails=1&format=json&limit=20`;
    try {
      setIsLoading(true);
      const response = await axios.get(url);
      setResults(
        response.data.filter(
          (result: ApiResponseData) => result.address.country === "Argentina",
        ),
      );
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient font-sans">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center gap-8 px-4 py-8 sm:gap-10 sm:px-6 sm:py-10 lg:gap-12 lg:px-12 lg:py-12">
        <motion.div
          className="flex w-full flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4"
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ease: "easeOut", duration: 0.3 }}
        >
          <Image
            src="/logo.png"
            alt="logo"
            width={200}
            height={200}
            className="h-auto w-24 sm:w-28 lg:w-36"
            priority
          />
          <h1 className="text-center text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-6xl">
            CÓDIGO <br />
            POSTAL
          </h1>
        </motion.div>

        <div className="flex w-full flex-col items-center justify-center gap-4 sm:gap-6">
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
            onClick={() => getLocationData(inputRef.current?.value || "")}
            className="w-full max-w-xl rounded bg-orange-600 px-6 py-3 text-gray-50 transition-all duration-100 hover:font-semibold disabled:opacity-60 sm:w-40"
          >
            {isLoading ? "Buscando" : "Buscar"}
          </motion.button>
        </div>
        {isLoading ? <div className="loader mt-24" /> : null}
        {!isLoading && results && results.length > 0 ? (
          <ResultCards results={results} />
        ) : null}
      </div>
    </div>
  );
}
