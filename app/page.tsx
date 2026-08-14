import Birds from "./components/Birds";
import SearchExperience from "./components/SearchExperience";
import SiteFooter from "./components/SiteFooter";

export default function Home() {
  return (
    <>
      <Birds />

      {/* La página no scrollea: entra toda en pantalla y el scroll vive dentro
          del contenedor de resultados. */}
      <div className="relative z-10 flex h-dvh flex-col overflow-hidden">
        <main className="min-h-0 flex-1">
          <SearchExperience />
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
