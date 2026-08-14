import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetPlaceIndex } from "@/app/lib/places";
import { GET } from "./route";

/** Catálogos de lugares contra los que se valida lo que escribe el usuario. */
const CATALOGS: Record<string, unknown> = {
  provincias: {
    provincias: [
      { id: "02", nombre: "Ciudad Autónoma de Buenos Aires" },
      { id: "06", nombre: "Buenos Aires" },
      { id: "82", nombre: "Santa Fe" },
    ],
  },
  departamentos: {
    departamentos: [
      { id: "06861", nombre: "San Miguel" },
      { id: "82084", nombre: "Rosario" },
    ],
  },
  localidades: { localidades: [] },
};

function direccion(
  id: string,
  nombre: string,
  departamento: string,
  provincia: { id: string; nombre: string },
  ubicacion: { lat: number; lon: number },
) {
  return {
    altura: { unidad: null, valor: 2889 },
    calle: { id, nombre },
    departamento: { id, nombre: departamento },
    localidad_censal: { id, nombre: departamento },
    provincia,
    ubicacion,
  };
}

/** Tres "San Lorenzo 2889" reales, en el orden arbitrario de georef. */
const ADDRESSES = [
  direccion(
    "82084",
    "SAN LORENZO",
    "Rosario",
    { id: "82", nombre: "Santa Fe" },
    { lat: -33.0, lon: -60.6 },
  ),
  direccion(
    "06861",
    "4150 SAN LORENZO",
    "San Miguel",
    { id: "06", nombre: "Buenos Aires" },
    { lat: -34.54, lon: -58.71 },
  ),
  direccion(
    "02007",
    "SAN LORENZO",
    "Comuna 1",
    { id: "02", nombre: "Ciudad Autónoma de Buenos Aires" },
    { lat: -34.6, lon: -58.38 },
  ),
];

let ipCounter = 0;

function request(query: string, extra = "") {
  ipCounter += 1;
  return new Request(
    `http://localhost/api/suggest?q=${encodeURIComponent(query)}${extra}`,
    { headers: { "x-forwarded-for": `10.1.0.${ipCounter}` } },
  );
}

type AddressResponder = (url: URL) => { total: number; direcciones: unknown[] };

/** El mock responde según el endpoint: catálogos o direcciones. */
function mockGeoref(
  onAddresses: AddressResponder = () => ({
    total: ADDRESSES.length,
    direcciones: ADDRESSES,
  }),
  { addressStatus = 200 } = {},
) {
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input));
    const resource = url.pathname.split("/").pop() ?? "";

    if (resource in CATALOGS) {
      return new Response(JSON.stringify(CATALOGS[resource]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify(onAddresses(url)), {
      status: addressStatus,
      headers: { "content-type": "application/json" },
    });
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Las llamadas a /direcciones, sin el ruido de los catálogos. */
function addressCalls(fetchMock: ReturnType<typeof mockGeoref>) {
  return fetchMock.mock.calls
    .map((call) => new URL(String(call[0])))
    .filter((url) => url.pathname.endsWith("/direcciones"));
}

beforeEach(() => {
  // El índice se memoiza a nivel módulo: sin esto se filtra entre tests.
  resetPlaceIndex();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GET /api/suggest", () => {
  it("rechaza queries cortas sin consultar georef", async () => {
    const fetchMock = mockGeoref();

    const response = await GET(request("li"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_QUERY");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("detecta la ciudad en el texto y la manda en su propio parámetro", async () => {
    // Es la diferencia entre 24 resultados de todo el país y el correcto:
    // dentro de `direccion`, georef descarta la ciudad en silencio.
    const fetchMock = mockGeoref((url) =>
      url.searchParams.get("departamento") === "06861"
        ? { total: 1, direcciones: [ADDRESSES[1]] }
        : { total: 3, direcciones: ADDRESSES },
    );

    const response = await GET(request("san lorenzo 2889 san miguel"));
    const body = await response.json();

    const [call] = addressCalls(fetchMock);
    expect(call.searchParams.get("direccion")).toBe("san lorenzo 2889");
    expect(call.searchParams.get("departamento")).toBe("06861");

    expect(body.suggestions).toHaveLength(1);
    expect(body.suggestions[0].department).toBe("San Miguel");
    expect(body.widenedFrom).toBeNull();
  });

  it("resuelve la ciudad por alias", async () => {
    const fetchMock = mockGeoref();

    await GET(request("corrientes 1234 caba"));

    const [call] = addressCalls(fetchMock);
    expect(call.searchParams.get("provincia")).toBe("02");
    expect(call.searchParams.get("direccion")).toBe("corrientes 1234");
  });

  it("no filtra cuando el sobrante no es una ciudad", async () => {
    const fetchMock = mockGeoref();

    // Acá San Miguel es la calle, no la ciudad.
    await GET(request("san miguel 1234"));

    const [call] = addressCalls(fetchMock);
    expect(call.searchParams.get("direccion")).toBe("san miguel 1234");
    expect(call.searchParams.has("departamento")).toBe(false);
    expect(call.searchParams.has("provincia")).toBe(false);
  });

  it("amplía la búsqueda y lo reporta si la dirección no existe en esa ciudad", async () => {
    const fetchMock = mockGeoref((url) =>
      url.searchParams.has("departamento")
        ? { total: 0, direcciones: [] }
        : { total: 3, direcciones: ADDRESSES },
    );

    const response = await GET(request("belgrano 9999 san miguel"));
    const body = await response.json();

    // Dos consultas: la filtrada que dio 0 y la ampliada.
    const calls = addressCalls(fetchMock);
    expect(calls).toHaveLength(2);
    expect(calls[1].searchParams.has("departamento")).toBe(false);
    expect(body.widenedFrom).toBe("San Miguel");
    expect(body.suggestions.length).toBeGreaterThan(0);
  });

  it("ordena por cercanía cuando recibe coordenadas", async () => {
    mockGeoref();

    // Obelisco: Comuna 1 es la más cercana, Rosario la más lejana.
    const response = await GET(
      request("san lorenzo 2889", "&lat=-34.6037&lon=-58.3816"),
    );
    const body = await response.json();

    expect(
      body.suggestions.map((s: { department: string }) => s.department),
    ).toEqual(["Comuna 1", "San Miguel", "Rosario"]);
  });

  it("sin coordenadas ordena alfabéticamente por provincia, no al azar", async () => {
    mockGeoref();

    const response = await GET(request("san lorenzo 2889"));
    const body = await response.json();

    expect(
      body.suggestions.map((s: { province: string }) => s.province),
    ).toEqual(["Buenos Aires", "Ciudad Autónoma de Buenos Aires", "Santa Fe"]);
    expect(body.suggestions[0].distanceKm).toBeNull();
  });

  it("responde 502 si georef falla", async () => {
    mockGeoref(() => ({ total: 0, direcciones: [] }), { addressStatus: 500 });

    const response = await GET(request("san lorenzo 2889"));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error.code).toBe("UPSTREAM_ERROR");
  });
});
