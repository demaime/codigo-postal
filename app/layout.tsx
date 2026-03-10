import type { Metadata } from "next";
import { Kanit } from "next/font/google";
import "./globals.css";

const kanit = Kanit({
  weight: "300",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Codigo Postal",
  description: "Obtener el código postal a partir de una dirección",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${kanit.className} antialiased`}>{children}</body>
    </html>
  );
}
