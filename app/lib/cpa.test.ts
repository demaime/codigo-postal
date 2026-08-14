import { describe, expect, it } from "vitest";

import { normalizePostcode } from "./cpa";

describe("normalizePostcode", () => {
  it("pasa a mayúsculas y saca separadores", () => {
    expect(normalizePostcode("c1043 aay")).toBe("C1043AAY");
    expect(normalizePostcode("b-1648")).toBe("B1648");
  });

  it("deja intacto un código ya normalizado", () => {
    expect(normalizePostcode("C1043AAY")).toBe("C1043AAY");
    expect(normalizePostcode("1043")).toBe("1043");
  });

  it("devuelve null cuando no queda nada útil", () => {
    expect(normalizePostcode("")).toBeNull();
    expect(normalizePostcode("   ")).toBeNull();
    expect(normalizePostcode(null)).toBeNull();
    expect(normalizePostcode(undefined)).toBeNull();
  });
});
