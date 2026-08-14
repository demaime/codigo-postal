import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

/** Lo que devuelve Nominatim en modo estructurado para Balcarce 50, CABA. */
const STRUCTURED_MATCH = [
  {
    place_id: 1,
    lat: "-34.5964134",
    lon: "-58.3842949",
    display_name: "Balcarce 50, Buenos Aires",
    address: {
      road: "Balcarce",
      house_number: "50",
      city: "Buenos Aires",
      state: "Ciudad Autónoma de Buenos Aires",
      postcode: "C1064AAB",
      country: "Argentina",
    },
  },
];

/** El reverse se engancha al objeto mapeado más cercano, que puede estar en
 *  otra calle y con otro código postal. */
const REVERSE_MATCH = {
  place_id: 2,
  lat: "-34.60540",
  lon: "-58.38830",
  display_name: "Sarmiento 1526, Buenos Aires",
  address: {
    road: "Sarmiento",
    house_number: "1526",
    city: "Buenos Aires",
    state: "Ciudad Autónoma de Buenos Aires",
    postcode: "C1037ADA",
    country: "Argentina",
  },
};

const ADDRESS =
  "street=Balcarce&number=50&province=Ciudad%20Aut%C3%B3noma%20de%20Buenos%20Aires&locality=Buenos%20Aires&department=Comuna%201&lat=-34.60821&lon=-58.37075";

let ipCounter = 0;

function request(queryString: string) {
  ipCounter += 1;
  return new Request(`http://localhost/api/postcode?${queryString}`, {
    headers: { "x-forwarded-for": `10.2.0.${ipCounter}` },
  });
}

/** Responde distinto según Nominatim reciba /search o /reverse. */
function mockNominatim({
  structured,
  reverse,
  status = 200,
}: {
  structured?: unknown;
  reverse?: unknown;
  status?: number;
}) {
  const fetchMock = vi.fn(async (url: string | URL | Request) => {
    const isReverse = String(url).includes("/reverse");
    return new Response(JSON.stringify(isReverse ? reverse : structured), {
      status,
      headers: { "content-type": "application/json" },
    });
  });
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

describe("GET /api/postcode", () => {
  it("resuelve por búsqueda estructurada y lo marca exacto", async () => {
    const fetchMock = mockNominatim({ structured: STRUCTURED_MATCH });

    const response = await GET(request(ADDRESS));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.postcode).toBe("C1064AAB");
    expect(body.precision).toBe("exact");
    // Sin reverse: alcanzó con la primera consulta.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("manda la altura adelante del nombre de la calle, que es lo que Nominatim espera", async () => {
    const fetchMock = mockNominatim({ structured: STRUCTURED_MATCH });

    await GET(request(ADDRESS));

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get("street")).toBe("50 Balcarce");
    expect(url.searchParams.get("county")).toBe("Comuna 1");
    expect(url.searchParams.get("state")).toBe(
      "Ciudad Autónoma de Buenos Aires",
    );
    expect(url.searchParams.get("country")).toBe("Argentina");
  });

  it("consulta OSM sin la numeración municipal de la calle", async () => {
    const fetchMock = mockNominatim({ structured: STRUCTURED_MATCH });

    await GET(
      request(
        "street=4150%20San%20Lorenzo&number=2889&province=Buenos%20Aires&department=San%20Miguel&lat=-34.5288&lon=-58.7193",
      ),
    );

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    // Con el "4150" adelante, OSM no encuentra nada y el punto termina
    // interpolado por georef, ~190 m corrido.
    expect(url.searchParams.get("street")).toBe("2889 San Lorenzo");
    expect(url.searchParams.get("county")).toBe("San Miguel");
  });

  it("cae a geocodificación inversa y avisa que el dato es aproximado", async () => {
    const fetchMock = mockNominatim({
      structured: [],
      reverse: REVERSE_MATCH,
    });

    const response = await GET(request(ADDRESS));
    const body = await response.json();

    expect(body.postcode).toBe("C1037ADA");
    expect(body.precision).toBe("approx");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("responde sin código postal cuando OSM no lo tiene", async () => {
    mockNominatim({ structured: [], reverse: { error: "Unable to geocode" } });

    const response = await GET(request(ADDRESS));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.postcode).toBeNull();
    expect(body.precision).toBe("approx");
  });

  it("exige calle y coordenadas", async () => {
    const fetchMock = mockNominatim({ structured: STRUCTURED_MATCH });

    const sinCalle = await GET(request("lat=-34.6&lon=-58.4"));
    const sinCoords = await GET(request("street=Balcarce&number=50"));

    expect(sinCalle.status).toBe(400);
    expect(sinCoords.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("traduce el 429 de Nominatim", async () => {
    mockNominatim({ structured: {}, status: 429 });

    const response = await GET(request(ADDRESS));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error.code).toBe("UPSTREAM_RATE_LIMITED");
  });
});
