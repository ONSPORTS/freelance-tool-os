import { describe, expect, it } from "vitest";
import { ordinaPer, prossimoOrdinamento } from "./ordinamento";

describe("ordinamento", () => {
  it("inverte il verso al secondo clic sulla stessa colonna", () => {
    const iniziale = { colonna: "data" as const, verso: "crescente" as const };
    expect(prossimoOrdinamento(iniziale, "data")).toEqual({ colonna: "data", verso: "decrescente" });
    expect(prossimoOrdinamento({ colonna: "data", verso: "decrescente" }, "data")).toEqual({
      colonna: "data", verso: "crescente",
    });
  });

  it("cambiando colonna riparte dal verso iniziale", () => {
    expect(prossimoOrdinamento({ colonna: "data", verso: "decrescente" }, "importo", "decrescente")).toEqual({
      colonna: "importo", verso: "decrescente",
    });
  });

  it("ordina numeri e testo", () => {
    const righe = [{ n: 3, s: "Beta" }, { n: 1, s: "alfa" }, { n: 2, s: "Gamma" }];
    expect(ordinaPer(righe, (r) => r.n, "crescente").map((r) => r.n)).toEqual([1, 2, 3]);
    expect(ordinaPer(righe, (r) => r.n, "decrescente").map((r) => r.n)).toEqual([3, 2, 1]);
    // Confronto italiano: maiuscole e minuscole non separano l'alfabeto.
    expect(ordinaPer(righe, (r) => r.s, "crescente").map((r) => r.s)).toEqual(["alfa", "Beta", "Gamma"]);
  });

  it("tiene i valori assenti in fondo in entrambi i versi", () => {
    const righe = [{ d: "2026-03-01" }, { d: null }, { d: "2026-01-01" }];
    expect(ordinaPer(righe, (r) => r.d, "crescente").map((r) => r.d)).toEqual([
      "2026-01-01", "2026-03-01", null,
    ]);
    expect(ordinaPer(righe, (r) => r.d, "decrescente").map((r) => r.d)).toEqual([
      "2026-03-01", "2026-01-01", null,
    ]);
  });

  it("non modifica l'array di partenza", () => {
    const righe = [{ n: 2 }, { n: 1 }];
    ordinaPer(righe, (r) => r.n, "crescente");
    expect(righe.map((r) => r.n)).toEqual([2, 1]);
  });
});
