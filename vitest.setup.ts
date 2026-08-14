import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

/**
 * jsdom no implementa IntersectionObserver. Los mapas se montan cuando la
 * tarjeta entra al viewport, así que el stub reporta todo como visible.
 */
class IntersectionObserverStub implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds: ReadonlyArray<number> = [];

  constructor(private readonly callback: IntersectionObserverCallback) {}

  observe(target: Element) {
    this.callback(
      [{ isIntersecting: true, target } as IntersectionObserverEntry],
      this,
    );
  }

  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

// Se asigna directo y no con `vi.stubGlobal`: los tests llaman a
// `vi.unstubAllGlobals()` y se llevarían puesto el stub.
globalThis.IntersectionObserver =
  IntersectionObserverStub as unknown as typeof IntersectionObserver;
