import { describe, expect, it } from "vitest";

import { buildPlaceIndex, lookupPlace, normalizePlaceName } from "./places";

const CATALOGS = {
  provincias: [
    { id: "02", nombre: "Ciudad Autónoma de Buenos Aires" },
    { id: "06", nombre: "Buenos Aires" },
    { id: "14", nombre: "Córdoba" },
  ],
  departamentos: [
    { id: "06861", nombre: "San Miguel" },
    { id: "82084", nombre: "Rosario" },
    { id: "06056", nombre: "Bahía Blanca" },
    // Mismo nombre que una provincia: no debe ganarle.
    { id: "14014", nombre: "Córdoba" },
  ],
  localidades: [
    { id: "06357030", nombre: "Mar del Plata" },
    // Mismo nombre que un departamento: tampoco debe ganarle.
    { id: "06861010", nombre: "San Miguel" },
  ],
};

const index = buildPlaceIndex(CATALOGS);

describe("normalizePlaceName", () => {
  it("saca acentos, mayúsculas y puntuación", () => {
    expect(normalizePlaceName("Bahía Blanca")).toBe("bahia blanca");
    expect(normalizePlaceName("Ciudad Autónoma de Buenos Aires")).toBe(
      "ciudad autonoma de buenos aires",
    );
    expect(normalizePlaceName("Lanús")).toBe("lanus");
  });

  it("colapsa espacios y separadores", () => {
    expect(normalizePlaceName("  SAN   MIGUEL  ")).toBe("san miguel");
    expect(normalizePlaceName("Gral. San Martín")).toBe("gral san martin");
  });
});

describe("buildPlaceIndex", () => {
  it("ante nombres repetidos gana el filtro más amplio", () => {
    // Córdoba es provincia y departamento; San Miguel, departamento y
    // localidad. El más amplio nunca deja afuera la respuesta correcta.
    expect(lookupPlace(index, "cordoba")).toMatchObject({
      kind: "provincia",
      id: "14",
    });
    expect(lookupPlace(index, "san miguel")).toMatchObject({
      kind: "departamento",
      id: "06861",
    });
  });

  it("indexa localidades que no chocan con nada", () => {
    expect(lookupPlace(index, "mar del plata")).toMatchObject({
      kind: "localidad",
      id: "06357030",
    });
  });

  it("ignora registros incompletos", () => {
    const partial = buildPlaceIndex({
      provincias: [{ nombre: "Sin id" }, { id: "99" }],
      departamentos: [],
      localidades: [],
    });

    expect(partial.size).toBe(0);
  });
});

describe("lookupPlace", () => {
  it("resuelve los alias que usa la gente", () => {
    for (const alias of ["caba", "capital federal", "ciudad de buenos aires"]) {
      expect(lookupPlace(index, alias)).toMatchObject({ id: "02" });
    }
  });

  it("devuelve null para lo que no es un lugar", () => {
    expect(lookupPlace(index, "piso 3")).toBeNull();
    expect(lookupPlace(index, "")).toBeNull();
    // A medio tipear tampoco matchea: el filtro entra recién al completar.
    expect(lookupPlace(index, "san mig")).toBeNull();
  });
});
