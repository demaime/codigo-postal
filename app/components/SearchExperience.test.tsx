import type { ReactNode } from "react";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// pigeon-maps baja tiles reales y mide el DOM: fuera del alcance de estos tests.
vi.mock("pigeon-maps", () => ({
  Map: ({ children }: { children?: ReactNode }) => (
    <div data-testid="map">{children}</div>
  ),
  Marker: () => <div data-testid="marker" />,
  ZoomControl: () => <div data-testid="zoom-control" />,
}));

import SearchExperience from "./SearchExperience";
import type { SuggestionWithDistance } from "@/app/lib/types";

/** Obelisco, con precisión de GPS (30 m). */
const USER_COORDS = { latitude: -34.6037, longitude: -58.3816, accuracy: 30 };

/** Las tres "Balcarce 50" reales, ya ordenadas por cercanía por el servidor. */
const SUGGESTIONS: SuggestionWithDistance[] = [
  {
    id: "02007-50",
    label: "Balcarce 50",
    street: "Balcarce",
    number: 50,
    locality: "Buenos Aires",
    department: "Comuna 1",
    province: "Ciudad Autónoma de Buenos Aires",
    provinceId: "02",
    lat: -34.60821,
    lon: -58.37075,
    distanceKm: 1.112,
  },
  {
    id: "06861-50",
    label: "Balcarce 50",
    street: "Balcarce",
    number: 50,
    locality: "Vicente López",
    department: "Vicente López",
    province: "Buenos Aires",
    provinceId: "06",
    lat: -34.52,
    lon: -58.48,
    distanceKm: 12.15,
  },
  {
    id: "82084-50",
    label: "Balcarce 50",
    street: "Balcarce",
    number: 50,
    locality: "Rosario",
    department: "Rosario",
    province: "Santa Fe",
    provinceId: "82",
    lat: -33.0,
    lon: -60.6,
    distanceKm: 280,
  },
];

/** Un código postal distinto por departamento, para poder distinguirlos. */
const POSTCODES: Record<string, string> = {
  "50 Balcarce|Ciudad Autónoma de Buenos Aires": "C1064AAB",
  "50 Balcarce|Buenos Aires": "B1638ABD",
  "50 Balcarce|Santa Fe": "S2000CCC",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

type ApiOptions = {
  suggestions?: SuggestionWithDistance[];
  searchResults?: unknown[];
  widenedFrom?: string | null;
};

function mockApi({
  suggestions = SUGGESTIONS,
  searchResults = [],
  widenedFrom = null,
}: ApiOptions = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost");

    if (url.pathname === "/api/suggest") {
      return json({ suggestions, total: 85, widenedFrom });
    }

    if (url.pathname === "/api/postcode") {
      const key = `${url.searchParams.get("number")} ${url.searchParams.get("street")}|${url.searchParams.get("province")}`;

      return json({
        postcode: POSTCODES[key] ?? null,
        precision: "exact",
        street: url.searchParams.get("street"),
        locality: url.searchParams.get("locality"),
        province: url.searchParams.get("province"),
        lat: Number(url.searchParams.get("lat")),
        lon: Number(url.searchParams.get("lon")),
      });
    }

    if (url.pathname === "/api/search") return json({ results: searchResults });

    throw new Error(`Pedido inesperado: ${url.pathname}`);
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function setGeolocation(
  implementation: (
    success: PositionCallback,
    failure: PositionErrorCallback,
  ) => void,
) {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition: vi.fn(implementation) },
  });
}

function grantLocation() {
  setGeolocation((success) =>
    success({ coords: USER_COORDS } as GeolocationPosition),
  );
}

function denyLocation() {
  setGeolocation((_success, failure) =>
    failure({
      code: 1,
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
      message: "denied",
    } as GeolocationPositionError),
  );
}

function input() {
  return screen.getByLabelText("Dirección a buscar");
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("SearchExperience", () => {
  it("resuelve el caso que antes era imposible: dirección con altura, sin escribir la ciudad", async () => {
    const user = userEvent.setup();
    grantLocation();
    mockApi();

    render(<SearchExperience />);
    await user.type(input(), "balcarce 50");

    // La de CABA viene primera porque el servidor ordenó por cercanía.
    const option = await screen.findByRole("option", { name: /Comuna 1/ });
    expect(option).toHaveTextContent("Balcarce 50");
    expect(option).toHaveTextContent("a 1,1 km");

    await user.click(option);

    expect(await screen.findByText("C1064AAB")).toBeInTheDocument();
  });

  it("pide la ubicación al escribir, no al elegir: la primera búsqueda ya sale ordenada", async () => {
    const user = userEvent.setup();
    grantLocation();
    const fetchMock = mockApi();

    render(<SearchExperience />);
    await user.type(input(), "balcarce 50");
    await screen.findByRole("option", { name: /Comuna 1/ });

    // Si la ubicación se pidiera recién al seleccionar, esta primera consulta
    // saldría sin coordenadas y volvería alfabética en vez de por cercanía.
    const suggestUrl = new URL(
      String(fetchMock.mock.calls[0][0]),
      "http://localhost",
    );
    expect(suggestUrl.searchParams.get("lat")).toBe("-34.6037");
    expect(suggestUrl.searchParams.get("lon")).toBe("-58.3816");
  });

  it("no afirma una distancia que cae dentro del margen de error del navegador", async () => {
    const user = userEvent.setup();
    // Una desktop ubicada por WiFi: 2 km de incertidumbre.
    setGeolocation((success) =>
      success({
        coords: { ...USER_COORDS, accuracy: 2000 },
      } as GeolocationPosition),
    );
    mockApi();

    render(<SearchExperience />);
    await user.type(input(), "balcarce 50");

    const option = await screen.findByRole("option", { name: /Comuna 1/ });
    expect(option).toHaveTextContent("cerca tuyo");
    expect(option).not.toHaveTextContent("1,1 km");
  });

  it("sugiere la calle correcta aunque esté mal escrita", async () => {
    const user = userEvent.setup();
    grantLocation();
    const fetchMock = mockApi();

    render(<SearchExperience />);
    await user.type(input(), "balcarse 50");

    await screen.findByRole("option", { name: /Comuna 1/ });
    // El texto con el error viaja tal cual: la corrección la hace georef.
    const suggestUrl = new URL(
      String(fetchMock.mock.calls[0][0]),
      "http://localhost",
    );
    expect(suggestUrl.searchParams.get("q")).toBe("balcarse 50");
  });

  it("se navega con el teclado y Enter elige la resaltada", async () => {
    const user = userEvent.setup();
    grantLocation();
    mockApi();

    render(<SearchExperience />);
    await user.type(input(), "balcarce 50");
    await screen.findByRole("option", { name: /Comuna 1/ });

    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(input()).toHaveAttribute(
      "aria-activedescendant",
      expect.stringContaining("option-1"),
    );

    await user.keyboard("{Enter}");

    // La segunda es la de Vicente López, en provincia de Buenos Aires.
    expect(await screen.findByText("B1638ABD")).toBeInTheDocument();
  });

  it("Enter resuelve lo escrito sin pasar por el buscador libre", async () => {
    const user = userEvent.setup();
    grantLocation();
    const fetchMock = mockApi();

    render(<SearchExperience />);
    await user.type(input(), "balcarce 50");
    await screen.findByRole("option", { name: /Comuna 1/ });

    await user.keyboard("{Enter}");

    // Da el resultado, que es lo que uno espera al apretar Enter.
    expect(await screen.findByText("C1064AAB")).toBeInTheDocument();
    // Y se saca de encima: si no, la lista queda tapando el resultado.
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(input()).not.toHaveFocus();
    // Y por georef: el buscador libre descarta la altura.
    expect(
      fetchMock.mock.calls.some((call) =>
        String(call[0]).includes("/api/search"),
      ),
    ).toBe(false);
  });

  it("Enter apurado no borra el número recién tipeado", async () => {
    const user = userEvent.setup();
    grantLocation();
    // Sugerencias de calle sin altura: las que llegan al escribir solo "cordoba".
    mockApi({
      suggestions: [
        {
          ...SUGGESTIONS[0],
          id: "calle-cordoba",
          label: "Cordoba",
          street: "Cordoba",
          number: null,
        },
      ],
    });

    render(<SearchExperience />);
    await user.type(input(), "cordoba");
    await screen.findByRole("option", { name: /Comuna 1/ });

    // Se sigue escribiendo y se aprieta Enter antes de que la lista se ponga
    // al día: antes elegía la calle sin altura y dejaba el campo en "Cordoba ".
    await user.type(input(), " 2860");
    await user.keyboard("{Enter}");

    expect(input()).toHaveValue("cordoba 2860");
  });

  it("Enter apurado resuelve con la lista nueva, no con la vieja", async () => {
    const user = userEvent.setup();
    grantLocation();

    // Primero responde con calles sin altura; después, con la dirección real.
    let call = 0;
    const fetchMock = vi.fn(async (i: RequestInfo | URL) => {
      const url = new URL(String(i), "http://localhost");

      if (url.pathname === "/api/suggest") {
        call += 1;
        return json({
          suggestions:
            call === 1
              ? [{ ...SUGGESTIONS[0], id: "calle", label: "Balcarce", number: null }]
              : SUGGESTIONS,
          total: 85,
          widenedFrom: null,
        });
      }

      return json({
        postcode: "C1064AAB",
        precision: "exact",
        street: "Balcarce",
        locality: "Buenos Aires",
        province: "Ciudad Autónoma de Buenos Aires",
        lat: -34.60821,
        lon: -58.37075,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<SearchExperience />);
    await user.type(input(), "balcarce");
    await screen.findByRole("option", { name: /Comuna 1/ });

    await user.type(input(), " 50");
    await user.keyboard("{Enter}");

    // Resuelve con lo que trajo la consulta nueva, no con la calle sin altura.
    expect(await screen.findByText("C1064AAB")).toBeInTheDocument();
  });

  it("ofrece las otras coincidencias y las resuelve al elegirlas", async () => {
    const user = userEvent.setup();
    grantLocation();
    mockApi();

    render(<SearchExperience />);
    await user.type(input(), "balcarce 50");
    await user.click(await screen.findByRole("option", { name: /Comuna 1/ }));
    await screen.findByText("C1064AAB");

    expect(screen.getByText("¿No era esta?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Rosario/ }));

    expect(await screen.findByText("S2000CCC")).toBeInTheDocument();
  });

  it("sin ubicación cada sugerencia lleva la provincia al lado para poder distinguirlas", async () => {
    const user = userEvent.setup();
    denyLocation();
    mockApi({
      suggestions: SUGGESTIONS.map((s) => ({ ...s, distanceKm: null })),
    });

    render(<SearchExperience />);
    await user.type(input(), "balcarce 50");

    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(3);

    // Las tres dicen "Balcarce 50": lo que las separa es la provincia.
    expect(options[0]).toHaveTextContent("Ciudad Autónoma de Buenos Aires");
    expect(options[1]).toHaveTextContent("Buenos Aires");
    expect(options[2]).toHaveTextContent("Santa Fe");

    // Y sin ubicación no se inventan distancias.
    expect(screen.queryByText(/^a \d/)).not.toBeInTheDocument();
  });

  it("la lista de sugerencias scrollea en vez de estirarse", async () => {
    const user = userEvent.setup();
    denyLocation();
    mockApi({
      suggestions: Array.from({ length: 25 }, (_, index) => ({
        ...SUGGESTIONS[0],
        id: `sugerencia-${index}`,
        locality: `Localidad ${index}`,
        distanceKm: null,
      })),
    });

    render(<SearchExperience />);
    await user.type(input(), "balcarce 50");

    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(25));

    const listbox = screen.getByRole("listbox", {
      name: "Direcciones sugeridas",
    });
    expect(listbox.className).toMatch(/overflow-y-auto/);
    expect(listbox.className).toMatch(/max-h-/);
  });

  it("avisa cuando tuvo que ampliar la búsqueda a otras ciudades", async () => {
    const user = userEvent.setup();
    grantLocation();
    // La ciudad existe pero la dirección no está ahí.
    mockApi({ widenedFrom: "San Miguel" });

    render(<SearchExperience />);
    await user.type(input(), "belgrano 9999 san miguel");
    await screen.findByRole("option", { name: /Comuna 1/ });

    expect(
      screen.getByText(/No hay ninguna en San Miguel/),
    ).toBeInTheDocument();
    // El aviso reemplaza al de "mostrando N de M", no se apilan.
    expect(screen.queryByText(/Mostrando/)).not.toBeInTheDocument();
  });

  it("no dice nada cuando la ciudad detectada sí funcionó", async () => {
    const user = userEvent.setup();
    grantLocation();
    mockApi();

    render(<SearchExperience />);
    await user.type(input(), "balcarce 50 caba");
    await screen.findByRole("option", { name: /Comuna 1/ });

    expect(screen.queryByText(/No hay ninguna en/)).not.toBeInTheDocument();
  });

  it("avisa cuándo está mostrando solo una parte de las coincidencias", async () => {
    const user = userEvent.setup();
    grantLocation();
    // El mock devuelve 3 sugerencias y declara un total de 85.
    mockApi();

    render(<SearchExperience />);
    await user.type(input(), "balcarce 50");
    await screen.findByRole("option", { name: /Comuna 1/ });

    expect(screen.getByText(/Mostrando 3 de 85/)).toBeInTheDocument();
  });

  it("no dispara un pedido por tecla", async () => {
    const user = userEvent.setup();
    grantLocation();
    const fetchMock = mockApi();

    render(<SearchExperience />);
    await user.type(input(), "balcarce 50");
    await screen.findByRole("option", { name: /Comuna 1/ });

    const suggestCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes("/api/suggest"),
    );

    expect(suggestCalls.length).toBeLessThan(3);
  });

  it("cae al buscador libre cuando no es una dirección con altura", async () => {
    const user = userEvent.setup();
    grantLocation();
    const fetchMock = mockApi({
      suggestions: [],
      searchResults: [
        {
          id: "obelisco",
          postcode: "C1043AAZ",
          street: null,
          locality: "Buenos Aires",
          district: null,
          province: "Ciudad Autónoma de Buenos Aires",
          lat: -34.6037,
          lon: -58.3816,
          displayName: "Obelisco",
        },
      ],
    });

    render(<SearchExperience />);
    await user.type(input(), "Obelisco");
    await user.keyboard("{Enter}");

    expect(await screen.findByText("C1043AAZ")).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some((call) =>
        String(call[0]).includes("/api/search"),
      ),
    ).toBe(true);
  });
});
