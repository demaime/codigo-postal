import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-5xl font-extrabold text-beak-500">404</p>

      <h1 className="text-2xl font-bold text-mist-50">
        Esta dirección no existe
      </h1>
      <p className="max-w-md text-sm text-mist-300">
        La página que buscás no está acá. Volvé al buscador para encontrar un
        código postal.
      </p>

      <Link
        href="/"
        className="mt-2 rounded-lg bg-beak-500 px-4 py-2 text-sm font-semibold text-ink-950 transition-colors hover:bg-beak-300"
      >
        Ir al buscador
      </Link>
    </main>
  );
}
