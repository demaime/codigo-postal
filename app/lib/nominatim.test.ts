import { describe, expect, it } from "vitest";

import {
  buildReverseUrl,
  buildSearchUrl,
  buildStructuredSearchUrl,
  dedupe,
  normalizePlace,
  normalizeResults,
} from "./nominatim";
import type { NominatimPlace, PostalResult } from "./types";

function place(overrides: Partial<NominatimPlace> = {}): NominatimPlace {
  return {
    place_id: 1,
    lat: "-34.6037",
    lon: "-58.3816",
    display_name: "Av. Corrientes 1234, Balvanera, CABA",
    address: {
      road: "Avenida Corrientes",
      house_number: "1234",
      neighbourhood: "Balvanera",
      city: "Buenos Aires",
      state: "Ciudad Autónoma de Buenos Aires",
      postcode: "C1043AAY",
      country: "Argentina",
    },
    ...overrides,
  };
}

describe("buildSearchUrl", () => {
  it("encodea la query en vez de interpolarla cruda", () => {
    const url = new URL(buildSearchUrl("Rivadavia & Callao #3"));

    expect(url.searchParams.get("q")).toBe("Rivadavia & Callao #3");
    // El separador de parámetros no puede venir de la dirección del usuario.
    expect(url.searchParams.get("addressdetails")).toBe("1");
  });

  it("filtra por Argentina en el origen", () => {
    const url = new URL(buildSearchUrl("Corrientes 1234"));

    expect(url.searchParams.get("countrycodes")).toBe("ar");
    expect(url.searchParams.get("limit")).toBe("25");
    expect(url.origin + url.pathname).toBe(
      "https://nominatim.openstreetmap.org/search",
    );
  });
});

describe("buildStructuredSearchUrl", () => {
  it("pone la altura delante de la calle, que es como Nominatim la reconoce", () => {
    // En modo libre la altura se pierde; en modo estructurado y en este orden,
    // Nominatim devuelve la puerta exacta con su código postal.
    const url = new URL(
      buildStructuredSearchUrl(
        "Balcarce",
        50,
        "Ciudad Autónoma de Buenos Aires",
      ),
    );

    expect(url.searchParams.get("street")).toBe("50 Balcarce");
    expect(url.searchParams.get("state")).toBe(
      "Ciudad Autónoma de Buenos Aires",
    );
    expect(url.searchParams.get("country")).toBe("Argentina");
    expect(url.searchParams.get("limit")).toBe("1");
  });

  it("sin altura manda solo la calle", () => {
    const url = new URL(buildStructuredSearchUrl("Balcarce", null, "Santa Fe"));
    expect(url.searchParams.get("street")).toBe("Balcarce");
  });

  it("omite la provincia cuando no se conoce", () => {
    const url = new URL(buildStructuredSearchUrl("Balcarce", 50, ""));
    expect(url.searchParams.has("state")).toBe(false);
  });

  it("acota por partido para no agarrar una calle homónima de otro distrito", () => {
    const url = new URL(
      buildStructuredSearchUrl("San Lorenzo", 2889, "Buenos Aires", "San Miguel"),
    );

    expect(url.searchParams.get("county")).toBe("San Miguel");
    expect(url.searchParams.get("street")).toBe("2889 San Lorenzo");
  });
});

describe("buildReverseUrl", () => {
  it("pide el nivel de detalle más fino", () => {
    const url = new URL(buildReverseUrl(-34.5964, -58.3842));

    expect(url.pathname).toBe("/reverse");
    expect(url.searchParams.get("lat")).toBe("-34.5964");
    expect(url.searchParams.get("zoom")).toBe("18");
  });
});

describe("normalizePlace", () => {
  it("convierte lat/lon a número una sola vez", () => {
    const result = normalizePlace(place())!;

    expect(result.lat).toBeCloseTo(-34.6037);
    expect(result.lon).toBeCloseTo(-58.3816);
    expect(typeof result.lat).toBe("number");
  });

  it("arma la calle con el número al final", () => {
    expect(normalizePlace(place())!.street).toBe("Avenida Corrientes 1234");
  });

  it("usa la calle sin número cuando no hay altura", () => {
    const result = normalizePlace(
      place({ address: { road: "Avenida Corrientes" } }),
    )!;

    expect(result.street).toBe("Avenida Corrientes");
  });

  it("cae en orden por los distintos nombres de localidad de OSM", () => {
    expect(normalizePlace(place({ address: { town: "Tigre" } }))!.locality).toBe(
      "Tigre",
    );
    expect(
      normalizePlace(place({ address: { village: "Uspallata" } }))!.locality,
    ).toBe("Uspallata");
    expect(
      normalizePlace(place({ address: { neighbourhood: "Palermo" } }))!.locality,
    ).toBe("Palermo");
  });

  it("normaliza el código postal", () => {
    expect(
      normalizePlace(place({ address: { postcode: "c1043 aay" } }))!.postcode,
    ).toBe("C1043AAY");
  });

  it("deja el código postal en null cuando OSM no lo informa", () => {
    expect(normalizePlace(place({ address: {} }))!.postcode).toBeNull();
  });

  it("descarta lugares sin coordenadas usables", () => {
    expect(normalizePlace(place({ lat: "no-es-un-numero" }))).toBeNull();
  });
});

describe("dedupe", () => {
  const base: PostalResult = {
    id: "1",
    postcode: "C1043AAY",
    street: "Avenida Corrientes 1234",
    locality: "Buenos Aires",
    district: null,
    province: "CABA",
    lat: -34.6,
    lon: -58.38,
    displayName: "",
  };

  it("colapsa entradas del mismo lugar", () => {
    const result = dedupe([base, { ...base, id: "2", lat: -34.6001 }]);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("conserva lugares distintos", () => {
    const result = dedupe([
      base,
      { ...base, id: "2", street: "Avenida Corrientes 1240" },
    ]);

    expect(result).toHaveLength(2);
  });
});

describe("normalizeResults", () => {
  it("normaliza, descarta inválidos y deduplica en una pasada", () => {
    const results = normalizeResults([
      place({ place_id: 1 }),
      place({ place_id: 2 }), // duplicado
      place({ place_id: 3, lat: "nan" }), // inválido
      place({
        place_id: 4,
        address: { road: "San Martín", city: "Rosario", postcode: "S2000" },
      }),
    ]);

    expect(results.map((result) => result.id)).toEqual(["1", "4"]);
  });
});
