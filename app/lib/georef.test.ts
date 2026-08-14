import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildAddressesUrl,
  stripStreetCode,
  dedupeSuggestions,
  fetchAddresses,
  hasHouseNumber,
  sortByPlace,
  normalizeAddress,
  toTitleCase,
} from "./georef";
import type { AddressSuggestion, GeorefDireccion } from "./types";

function direccion(overrides: Partial<GeorefDireccion> = {}): GeorefDireccion {
  return {
    altura: { unidad: null, valor: 50 },
    calle: { id: "0200701007500", nombre: "BALCARCE", categoria: "CALLE" },
    departamento: { id: "02007", nombre: "Comuna 1" },
    localidad_censal: { id: "02000010", nombre: "CIUDAD AUTONOMA BUENOS AIRES" },
    provincia: { id: "02", nombre: "Ciudad Autónoma de Buenos Aires" },
    nomenclatura: "BALCARCE 50, Comuna 1, Ciudad Autónoma de Buenos Aires",
    ubicacion: { lat: -34.60821, lon: -58.37075 },
    ...overrides,
  };
}

function suggestion(
  overrides: Partial<AddressSuggestion> = {},
): AddressSuggestion {
  return {
    id: "calle-50",
    label: "Balcarce 50",
    street: "Balcarce",
    number: 50,
    locality: "Buenos Aires",
    department: "Comuna 1",
    province: "Ciudad Autónoma de Buenos Aires",
    provinceId: "02",
    lat: -34.60821,
    lon: -58.37075,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("hasHouseNumber", () => {
  it("distingue una dirección de una calle suelta", () => {
    expect(hasHouseNumber("balcarce 50")).toBe(true);
    expect(hasHouseNumber("balcarce")).toBe(false);
  });
});

describe("toTitleCase", () => {
  it("baja el griterío de georef sin romper las partículas", () => {
    expect(toTitleCase("AV DEL TRABAJO")).toBe("Av del Trabajo");
    expect(toTitleCase("BALCARCE")).toBe("Balcarce");
    expect(toTitleCase("SAN JOSE DE FLORES")).toBe("San Jose de Flores");
  });

  it("mantiene mayúscula en la primera palabra aunque sea partícula", () => {
    expect(toTitleCase("LAS HERAS")).toBe("Las Heras");
  });
});

describe("stripStreetCode", () => {
  it("saca la numeración municipal que OSM no conoce", () => {
    // Sin esto, buscar "2889 4150 San Lorenzo" en OSM no devuelve nada y la
    // dirección termina ubicada por interpolación, ~190 m corrida.
    expect(stripStreetCode("4150 San Lorenzo")).toBe("San Lorenzo");
    expect(stripStreetCode("821 San Lorenzo")).toBe("San Lorenzo");
    expect(stripStreetCode("706 Mermoz")).toBe("Mermoz");
    expect(stripStreetCode("Calle 91 San Lorenzo")).toBe("San Lorenzo");
  });

  it("no toca las fechas, donde el número es parte del nombre", () => {
    // Están entre los nombres de calle más comunes del país.
    expect(stripStreetCode("25 de Mayo")).toBe("25 de Mayo");
    expect(stripStreetCode("9 de Julio")).toBe("9 de Julio");
    expect(stripStreetCode("12 de Octubre")).toBe("12 de Octubre");
  });

  it("deja intacto lo que no empieza con número", () => {
    expect(stripStreetCode("San Lorenzo")).toBe("San Lorenzo");
    expect(stripStreetCode("Avenida Corrientes")).toBe("Avenida Corrientes");
  });

  it("conserva el nombre si el número era todo", () => {
    expect(stripStreetCode("Calle 91")).toBe("Calle 91");
  });
});

describe("buildAddressesUrl", () => {
  it("encodea la dirección y acota por provincia", () => {
    const url = new URL(
      buildAddressesUrl("san martín & belgrano", {
        place: { kind: "provincia", id: "02", name: "CABA" },
      }),
    );

    expect(url.searchParams.get("direccion")).toBe("san martín & belgrano");
    expect(url.searchParams.get("provincia")).toBe("02");
    expect(url.searchParams.get("max")).toBe("500");
  });

  it("usa el parámetro que corresponde a cada tipo de lugar", () => {
    const depto = new URL(
      buildAddressesUrl("san lorenzo 2889", {
        place: { kind: "departamento", id: "06861", name: "San Miguel" },
      }),
    );
    const loc = new URL(
      buildAddressesUrl("rivadavia 100", {
        place: { kind: "localidad", id: "06357", name: "Mar del Plata" },
      }),
    );

    expect(depto.searchParams.get("departamento")).toBe("06861");
    expect(loc.searchParams.get("localidad")).toBe("06357");
  });

  it("no manda filtro de lugar cuando no hay", () => {
    const url = new URL(buildAddressesUrl("balcarce 50"));

    expect(url.searchParams.has("provincia")).toBe(false);
    expect(url.searchParams.has("departamento")).toBe(false);
    expect(url.searchParams.has("localidad")).toBe(false);
  });
});

describe("normalizeAddress", () => {
  it("arma la etiqueta con calle y altura", () => {
    const result = normalizeAddress(direccion())!;

    expect(result.label).toBe("Balcarce 50");
    expect(result.number).toBe(50);
    expect(result.department).toBe("Comuna 1");
  });

  it("acepta la altura como string", () => {
    const result = normalizeAddress(
      direccion({ altura: { unidad: null, valor: "2860" } }),
    )!;

    expect(result.number).toBe(2860);
  });

  it("sin altura deja la calle sola, para pedir el número", () => {
    const result = normalizeAddress(
      direccion({ altura: { unidad: null, valor: null } }),
    )!;

    expect(result.label).toBe("Balcarce");
    expect(result.number).toBeNull();
  });

  it("descarta lugares sin coordenadas", () => {
    expect(
      normalizeAddress(direccion({ ubicacion: { lat: null, lon: null } })),
    ).toBeNull();
  });

  it("descarta registros sin calle", () => {
    expect(normalizeAddress(direccion({ calle: {} }))).toBeNull();
  });
});

describe("dedupeSuggestions", () => {
  it("colapsa la misma dirección repetida por tramo", () => {
    const result = dedupeSuggestions([
      suggestion(),
      suggestion({ lat: -34.5965 }),
    ]);

    expect(result).toHaveLength(1);
  });

  it("conserva la misma calle en localidades distintas cuando no hay altura", () => {
    const street = suggestion({ number: null, id: "calle" });

    const result = dedupeSuggestions([
      street,
      { ...street, locality: "Rosario" },
    ]);

    expect(result).toHaveLength(2);
  });
});

describe("sortByPlace", () => {
  it("ordena alfabéticamente por provincia y después por partido", () => {
    const result = sortByPlace([
      suggestion({ province: "Santa Fe", department: "Rosario" }),
      suggestion({ province: "Buenos Aires", department: "Tigre" }),
      suggestion({ province: "Buenos Aires", department: "Avellaneda" }),
    ]);

    expect(result.map((item) => `${item.province}/${item.department}`)).toEqual([
      "Buenos Aires/Avellaneda",
      "Buenos Aires/Tigre",
      "Santa Fe/Rosario",
    ]);
  });

  it("no muta el arreglo original", () => {
    const original = [
      suggestion({ province: "Santa Fe" }),
      suggestion({ province: "Buenos Aires" }),
    ];

    sortByPlace(original);

    expect(original[0].province).toBe("Santa Fe");
  });
});

describe("fetchAddresses", () => {
  it("el total cuenta direcciones distintas, no tramos repetidos", async () => {
    // georef informa 3 porque cuenta una vez por tramo; distintas hay 1.
    // Reportar 3 hacía decir "mostrando 1 de 3", como si se ocultaran dos.
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          total: 3,
          direcciones: [direccion(), direccion(), direccion({ calle: {} })],
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    const result = await fetchAddresses("balcarce 50", { fetchImpl });

    expect(result.suggestions).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it("respeta el total de georef cuando fue georef quien recortó", async () => {
    // Llegaron menos registros de los que dice haber: ahí sí hay más afuera.
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({ total: 900, direcciones: [direccion()] }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    const result = await fetchAddresses("balcarce 50", { fetchImpl });

    expect(result.total).toBe(900);
  });

  it("propaga el error del servicio", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("", { status: 503 }),
    ) as unknown as typeof fetch;

    await expect(fetchAddresses("balcarce 50", { fetchImpl })).rejects.toThrow(
      /503/,
    );
  });
});
