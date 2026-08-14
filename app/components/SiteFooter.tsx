export default function SiteFooter() {
  return (
    <footer className="shrink-0 space-y-1 px-4 py-4 text-center text-xs text-mist-500 sm:px-6">
      <p className="font-semibold">Solo disponible para Argentina</p>

      <p>
        Datos de{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="text-mist-300 underline-offset-2 hover:text-mist-50 hover:underline"
        >
          OpenStreetMap
        </a>{" "}
        vía{" "}
        <a
          href="https://nominatim.org/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-mist-300 underline-offset-2 hover:text-mist-50 hover:underline"
        >
          Nominatim
        </a>
        . Los códigos postales son los cargados en OSM y pueden estar
        incompletos.
      </p>
    </footer>
  );
}
