import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const NOMINATIM_PAYLOAD = [
  {
    place_id: 1,
    lat: "-34.6037",
    lon: "-58.3816",
    display_name: "Av. Corrientes 1234",
    address: {
      road: "Avenida Corrientes",
      house_number: "1234",
      city: "Buenos Aires",
      state: "Ciudad Autónoma de Buenos Aires",
      postcode: "C1043AAY",
      country: "Argentina",
    },
  },
];

/** Cada test usa su propia IP para no compartir el token bucket. */
let ipCounter = 0;

function request(query: string) {
  ipCounter += 1;
  return new Request(
    `http://localhost/api/search?q=${encodeURIComponent(query)}`,
    { headers: { "x-forwarded-for": `10.0.0.${ipCounter}` } },
  );
}

function mockFetch(body: unknown, status = 200) {
  const fetchMock = vi.fn(
    async (url: string | URL | Request, init?: RequestInit) => {
      void url;
      void init;
      return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      });
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GET /api/search", () => {
  it("rechaza queries demasiado cortas sin llamar a Nominatim", async () => {
    const fetchMock = mockFetch(NOMINATIM_PAYLOAD);

    const response = await GET(request("av"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_QUERY");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rechaza queries excesivamente largas", async () => {
    const fetchMock = mockFetch(NOMINATIM_PAYLOAD);

    const response = await GET(request("a".repeat(200)));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("manda el User-Agent que exige la política de uso de Nominatim", async () => {
    const fetchMock = mockFetch(NOMINATIM_PAYLOAD);

    await GET(request("Av. Corrientes 1234"));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];

    expect(String(url)).toContain("countrycodes=ar");
    expect(new URL(String(url)).searchParams.get("q")).toBe(
      "Av. Corrientes 1234",
    );
    expect(
      (init?.headers as Record<string, string>)["User-Agent"],
    ).toBeTruthy();
  });

  it("devuelve resultados normalizados", async () => {
    mockFetch(NOMINATIM_PAYLOAD);

    const response = await GET(request("Av. Corrientes 1234"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.results).toHaveLength(1);
    expect(body.results[0]).toMatchObject({
      postcode: "C1043AAY",
      street: "Avenida Corrientes 1234",
      locality: "Buenos Aires",
      lat: -34.6037,
    });
  });

  it("traduce el 429 de Nominatim a un mensaje accionable", async () => {
    mockFetch({}, 429);

    const response = await GET(request("Av. Corrientes 1234"));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error.code).toBe("UPSTREAM_RATE_LIMITED");
  });

  it("responde 502 ante una falla del servicio de mapas", async () => {
    mockFetch({}, 500);

    const response = await GET(request("Av. Corrientes 1234"));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error.code).toBe("UPSTREAM_ERROR");
  });

  it("corta el abuso con rate limit por IP", async () => {
    mockFetch(NOMINATIM_PAYLOAD);

    const headers = { "x-forwarded-for": "203.0.113.7" };
    const url = "http://localhost/api/search?q=Corrientes%201234";

    const statuses: number[] = [];
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const response = await GET(new Request(url, { headers }));
      statuses.push(response.status);
    }

    expect(statuses.at(-1)).toBe(429);
    expect(statuses.filter((status) => status === 200).length).toBeLessThan(12);
  });
});
