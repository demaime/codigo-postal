import { describe, expect, it } from "vitest";

import { buildPlaceIndex } from "./places";
import { parseQuery } from "./query";

const index = buildPlaceIndex({
  provincias: [
    { id: "02", nombre: "Ciudad Autónoma de Buenos Aires" },
    { id: "14", nombre: "Córdoba" },
  ],
  departamentos: [
    { id: "06861", nombre: "San Miguel" },
    { id: "82084", nombre: "Rosario" },
    { id: "06056", nombre: "Bahía Blanca" },
  ],
  localidades: [{ id: "06357030", nombre: "Mar del Plata" }],
});

describe("parseQuery", () => {
  it("separa la ciudad de la dirección", () => {
    expect(parseQuery("san lorenzo 2889 san miguel", index)).toEqual({
      address: "san lorenzo 2889",
      place: { kind: "departamento", id: "06861", name: "San Miguel" },
    });
  });

  it("resuelve la ciudad por alias", () => {
    expect(parseQuery("corrientes 1234 caba", index).place).toMatchObject({
      id: "02",
    });
  });

  it("no confunde la ciudad con el nombre de la calle", () => {
    // "San Miguel" acá es la calle: después del número no queda nada, así que
    // no hay filtro. Es el caso que rompe una heurística ingenua.
    expect(parseQuery("san miguel 1234", index)).toEqual({
      address: "san miguel 1234",
      place: null,
    });
  });

  it("corta por el último número, no por el primero", () => {
    // Si cortara por el primero, "de julio 1000" quedaría como candidato a
    // ciudad y la calle se partiría en "av 9".
    expect(parseQuery("av 9 de julio 1000", index)).toEqual({
      address: "av 9 de julio 1000",
      place: null,
    });

    expect(parseQuery("calle 91 san lorenzo 2889", index)).toEqual({
      address: "calle 91 san lorenzo 2889",
      place: null,
    });
  });

  it("ignora el sobrante que no es un lugar conocido", () => {
    expect(parseQuery("belgrano 500 piso 3", index)).toEqual({
      address: "belgrano 500 piso 3",
      place: null,
    });
  });

  it("no filtra mientras el nombre está a medio escribir", () => {
    expect(parseQuery("san lorenzo 2889 san mig", index).place).toBeNull();
  });

  it("tolera acentos y mayúsculas en la ciudad", () => {
    expect(parseQuery("mitre 2500 BAHIA blanca", index).place).toMatchObject({
      id: "06056",
    });
    expect(parseQuery("rivadavia 100 Mar del Plata", index).place).toMatchObject(
      { kind: "localidad" },
    );
  });

  it("sin número devuelve todo como dirección", () => {
    expect(parseQuery("san lorenzo", index)).toEqual({
      address: "san lorenzo",
      place: null,
    });
  });

  it("normaliza los espacios sobrantes", () => {
    expect(parseQuery("  san lorenzo   2889   san miguel ", index)).toEqual({
      address: "san lorenzo 2889",
      place: { kind: "departamento", id: "06861", name: "San Miguel" },
    });
  });
});
