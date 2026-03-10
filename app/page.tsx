"use client";
import Image from "next/image";
import { useState } from "react";
import axios from "axios";

export default function Home() {
  const [inputValue, setInputValue] = useState("");
  console.log(inputValue);

  async function getZipCode(inputSearchValue: string) {
    const url = `https://nominatim.openstreetmap.org/search?q=${inputValue}&format=json&limit=10`;
    try {
      const response = await axios.get(url);
      console.log(response.data);
    } catch (error) {
      console.log(error);
    }
  }

  const handleSearch = () => getZipCode(inputValue);

  return (
    <div className="flex min-h-screen justify-center bg-zinc-50 font-sans dark:bg-black">
      <div className="w-full flex flex-col items-center gap-12 p-12">
        <div className="w-2/3 flex items-center justify-center gap-2">
          <Image src="/logo.png" alt="logo" width={200} height={200} />
          <h1 className="text-6xl font-black text-white">CÓDIGO POSTAL</h1>
        </div>

        <div className="w-full flex flex-col items-center justify-center gap-8">
          <input
            onChange={(e) => setInputValue(e.target.value)}
            className="rounded-md border border-orange-200 w-1/2 h-16 text-white p-4 font-semibold"
            placeholder="Ingrese una dirección"
            type="text"
          />
          <button
            onClick={handleSearch}
            className="text-gray-50 bg-orange-600 rounded px-6 py-2"
          >
            Buscar
          </button>
        </div>
      </div>
    </div>
  );
}
