"use client";
import Image from "next/image";
import "./styles/birds.css";
import { useRef, useState } from "react";
import axios from "axios";
import ResultCards from "./components/ResultCards";
import { ApiResponseData } from "./types";
import { motion } from "motion/react";
import Birds from "./components/Birds";

export default function Home() {
  const codigo = "CODIGO";
  const postal = "POSTAL";
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

  // const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
  //   event.preventDefault;
  //   getLocationData(inputRef.current?.value || "");
  // };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }, // Delays each letter by 0.05s
    },
  };

  const letterVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className="h-dvh max-w-full overflow-hidden bg-[#1d2449]">
      <Birds />
      <div className="relative z-10 mx-auto flex h-full w-full max-w-6xl flex-col items-center gap-8 px-4 py-8 sm:gap-10 sm:px-6 sm:py-10 lg:gap-12 lg:px-12 lg:py-12">
        <div className="flex w-full items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <motion.div
            animate={{ opacity: 1 }}
            initial={{ opacity: 0 }}
            transition={{ duration: 1 }}
          >
            <Image
              src="/logo.png"
              alt="logo"
              width={200}
              height={200}
              className="h-auto w-24 sm:w-28 lg:w-36"
              priority
            />
          </motion.div>
          <div className="text-center text-3xl font-black tracking-tight text-amber-100 sm:text-4xl lg:text-6xl">
            <motion.h1
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {codigo.split("").map((char, index) => (
                <motion.span
                  key={index}
                  variants={letterVariants}
                  style={{ display: "inline-block" }}
                >
                  {char}
                </motion.span>
              ))}
            </motion.h1>
            <motion.h1
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {postal.split("").map((char, index) => (
                <motion.span
                  key={index}
                  variants={letterVariants}
                  style={{ display: "inline-block" }}
                >
                  {char}
                </motion.span>
              ))}
            </motion.h1>
          </div>
        </div>

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
