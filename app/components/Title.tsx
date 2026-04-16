import { motion } from "motion/react";
import Image from "next/image";
import React from "react";

export default function motionConstants() {
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

  return (
    <div className="flex w-full items-center justify-center gap-3 sm:flex-row sm:gap-4">
      <motion.div
        animate={{ opacity: 1 }}
        initial={{ opacity: 0 }}
        transition={{ duration: 1 }}
      >
        <Image
          src="/logo.png"
          alt="logo"
          width={100}
          height={100}
          // className="h-auto w-24 sm:w-28 lg:w-36"
          priority
        />
      </motion.div>
      <div className="text-center text-2xl font-black tracking-tight text-amber-100 sm:text-4xl lg:text-5xl">
        <motion.h1
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {"CODIGO".split("").map((char, index) => (
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
          {"POSTAL".split("").map((char, index) => (
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
  );
}
