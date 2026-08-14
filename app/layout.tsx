import type { Metadata, Viewport } from "next";
import { Kanit } from "next/font/google";

import "./globals.css";

const kanit = Kanit({
  weight: ["300", "400", "600", "800"],
  subsets: ["latin"],
  variable: "--font-kanit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Código Postal · Buscador de códigos postales de Argentina",
  description:
    "Escribí una dirección de Argentina y obtené su código postal, con los resultados ordenados por cercanía a tu ubicación.",
  applicationName: "Código Postal",
  authors: [{ name: "demaime" }],
  keywords: [
    "código postal",
    "CPA",
    "Argentina",
    "buscador",
    "dirección",
  ],
  openGraph: {
    title: "Código Postal",
    description:
      "El código postal de cualquier dirección de Argentina, ordenado por cercanía.",
    locale: "es_AR",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b1030",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${kanit.variable} ${kanit.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}
