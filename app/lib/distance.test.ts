import { describe, expect, it } from "vitest";

import {
  describeDistance,
  formatDistance,
  getGeoDistance,
  isWithinAccuracy,
} from "./distance";

const OBELISCO = { lat: -34.6037, lon: -58.3816 };
const MONUMENTO_BANDERA = { lat: -32.9477, lon: -60.6304 };

describe("getGeoDistance", () => {
  it("mide una distancia conocida entre Buenos Aires y Rosario", () => {
    const km = getGeoDistance(
      OBELISCO.lat,
      OBELISCO.lon,
      MONUMENTO_BANDERA.lat,
      MONUMENTO_BANDERA.lon,
    );

    // La distancia real en línea recta ronda los 278 km.
    expect(km).toBeGreaterThan(270);
    expect(km).toBeLessThan(285);
  });

  it("devuelve 0 para el mismo punto", () => {
    expect(
      getGeoDistance(OBELISCO.lat, OBELISCO.lon, OBELISCO.lat, OBELISCO.lon),
    ).toBe(0);
  });

  it("es simétrica", () => {
    const ida = getGeoDistance(-34.6, -58.38, -31.42, -64.18);
    const vuelta = getGeoDistance(-31.42, -64.18, -34.6, -58.38);

    expect(ida).toBeCloseTo(vuelta, 10);
  });
});

describe("formatDistance", () => {
  it("usa metros por debajo del kilómetro", () => {
    expect(formatDistance(0.324)).toBe("320 m");
    expect(formatDistance(0.05)).toBe("50 m");
  });

  it("pasa a kilómetros cuando el redondeo llegaría a 1000 m", () => {
    expect(formatDistance(0.999)).toBe("1 km");
  });

  it("usa un decimal con coma hasta los 10 km", () => {
    expect(formatDistance(2.43)).toBe("2,4 km");
  });

  it("redondea a entero por encima de los 10 km", () => {
    expect(formatDistance(145.2)).toBe("145 km");
  });

  it("devuelve vacío ante valores inválidos", () => {
    expect(formatDistance(Number.NaN)).toBe("");
    expect(formatDistance(-3)).toBe("");
  });
});

describe("describeDistance", () => {
  it("da la cifra cuando la ubicación es lo bastante precisa", () => {
    // GPS: 30 m de margen contra 1,1 km de distancia. El número significa algo.
    expect(describeDistance(1.112, 30)).toBe("a 1,1 km");
  });

  it("no afirma una cifra que cae dentro del margen de error", () => {
    // Una desktop ubicada por WiFi puede tener 2 km de incertidumbre: a 1,6 km
    // podés estar parado justo ahí.
    expect(describeDistance(1.6, 2000)).toBe("cerca tuyo");
  });

  it("trata el borde exacto como dentro del margen", () => {
    expect(describeDistance(1, 1000)).toBe("cerca tuyo");
    expect(describeDistance(1.001, 1000)).toBe("a 1,0 km");
  });

  it("sin dato de precisión muestra la cifra", () => {
    expect(describeDistance(1.112, null)).toBe("a 1,1 km");
  });

  it("con precisión desconocida muestra la cifra igual", () => {
    // Dar el margen por infinito hacía que Rosario, a 280 km, apareciera como
    // "cerca tuyo": ante la duda se muestra el número, no se lo suprime.
    expect(describeDistance(280, Number.POSITIVE_INFINITY)).toBe("a 280 km");
  });

  it("nunca llama cerca a algo a más de 3 km, por impreciso que sea el navegador", () => {
    // Lanús con 50 km de margen de error sigue sin ser tu cuadra.
    expect(describeDistance(12.15, 50000)).toBe("a 12 km");
    expect(describeDistance(3.5, 50000)).toBe("a 3,5 km");
    // Justo en el techo, y con margen suficiente, sí entra.
    expect(describeDistance(3, 50000)).toBe("cerca tuyo");
  });
});

describe("isWithinAccuracy", () => {
  it("es falso cuando no hay dato de precisión", () => {
    expect(isWithinAccuracy(0.1, null)).toBe(false);
  });

  it("compara metros contra kilómetros sin confundir unidades", () => {
    expect(isWithinAccuracy(0.05, 100)).toBe(true);
    expect(isWithinAccuracy(0.2, 100)).toBe(false);
  });
});
