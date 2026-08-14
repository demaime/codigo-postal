"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const letterVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

function AnimatedWord({ word }: { word: string }) {
  return (
    <motion.span
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      // Altura fija por renglón: dos renglones miden exactamente 2.1em, que es
      // la altura a la que se ajusta la paloma.
      className="block h-[1.05em]"
      // El lector de pantalla lee la palabra entera, no letra por letra.
      aria-hidden="true"
    >
      {word.split("").map((char, index) => (
        <motion.span
          key={`${char}-${index}`}
          variants={letterVariants}
          className="inline-block align-top"
        >
          {char}
        </motion.span>
      ))}
    </motion.span>
  );
}

type BrandHeaderProps = {
  /** Al buscar, el título se va y la paloma se achica al lado del buscador. */
  compact: boolean;
};

export default function BrandHeader({ compact }: BrandHeaderProps) {
  return (
    <motion.div
      layout
      className={
        compact
          ? "flex shrink-0 items-center"
          : "flex items-center justify-center gap-5 sm:gap-7"
      }
    >
      <motion.div
        layout
        className={
          compact
            ? "h-12 w-12 shrink-0 sm:h-14 sm:w-14"
            : // 2.1em del tamaño del título en cada breakpoint: la paloma mide
              // exactamente lo mismo que las dos líneas de texto.
              "h-[6.3rem] w-[6.3rem] shrink-0 sm:h-[7.875rem] sm:w-[7.875rem] lg:h-[9.45rem] lg:w-[9.45rem]"
        }
      >
        <Image
          src="/logo.png"
          // Decorativa: el <h1> de al lado ya dice el nombre.
          alt=""
          width={512}
          height={512}
          sizes="(max-width: 640px) 101px, (max-width: 1024px) 126px, 151px"
          className="h-full w-full object-contain"
          priority
        />
      </motion.div>

      <AnimatePresence initial={false}>
        {!compact && (
          <motion.h1
            key="wordmark"
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            className="wordmark-offset text-5xl leading-[1.05] font-semibold tracking-tight text-envelope sm:text-6xl lg:text-7xl"
          >
            <span className="sr-only">Código Postal</span>
            <AnimatedWord word="CÓDIGO" />
            <AnimatedWord word="POSTAL" />
          </motion.h1>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
