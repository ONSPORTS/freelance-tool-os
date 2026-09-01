import { describe, expect, it } from "vitest";
import {
  copreAnnoIntero,
  dentroPeriodo,
  etichettaPeriodo,
  intervallo,
  trimestreDi,
  type Periodo,
} from "./periodo";

describe("periodo", () => {
  it("delimita l'anno", () => {
    expect(intervallo({ tipo: "anno", anno: 2026 })).toEqual({ da: "2026-01-01", a: "2026-12-31" });
  });

  it("delimita i trimestri", () => {
    expect(intervallo({ tipo: "trimestre", anno: 2026, trimestre: 1 })).toEqual({
      da: "2026-01-01", a: "2026-03-31",
    });
    expect(intervallo({ tipo: "trimestre", anno: 2026, trimestre: 4 })).toEqual({
      da: "2026-10-01", a: "2026-12-31",
    });
  });

  it("delimita i mesi tenendo conto della loro lunghezza", () => {
    expect(intervallo({ tipo: "mese", anno: 2026, mese: 2 })).toEqual({
      da: "2026-02-01", a: "2026-02-28",
    });
    // 2028 è bisestile.
    expect(intervallo({ tipo: "mese", anno: 2028, mese: 2 }).a).toBe("2028-02-29");
    expect(intervallo({ tipo: "mese", anno: 2026, mese: 4 }).a).toBe("2026-04-30");
  });

  it("rimette in ordine gli estremi invertiti invece di restituire il vuoto", () => {
    const p: Periodo = { tipo: "personalizzato", anno: 2026, da: "2026-06-30", a: "2026-03-01" };
    expect(intervallo(p)).toEqual({ da: "2026-03-01", a: "2026-06-30" });
  });

  it("include gli estremi", () => {
    const p: Periodo = { tipo: "mese", anno: 2026, mese: 3 };
    expect(dentroPeriodo("2026-03-01", p)).toBe(true);
    expect(dentroPeriodo("2026-03-31", p)).toBe(true);
    expect(dentroPeriodo("2026-02-28", p)).toBe(false);
    expect(dentroPeriodo("2026-04-01", p)).toBe(false);
    expect(dentroPeriodo(null, p)).toBe(false);
  });

  it("etichetta il periodo in italiano", () => {
    expect(etichettaPeriodo({ tipo: "anno", anno: 2026 })).toBe("anno 2026");
    expect(etichettaPeriodo({ tipo: "mese", anno: 2026, mese: 3 })).toBe("marzo 2026");
    expect(etichettaPeriodo({ tipo: "trimestre", anno: 2026, trimestre: 2 })).toBe(
      "2° trimestre 2026",
    );
    expect(
      etichettaPeriodo({ tipo: "personalizzato", anno: 2026, da: "2026-04-03", a: "2026-04-18" }),
    ).toBe("dal 3 aprile 2026 al 18 aprile 2026");
  });

  it("riconosce quando il periodo copre l'anno intero", () => {
    expect(copreAnnoIntero({ tipo: "anno", anno: 2026 })).toBe(true);
    expect(copreAnnoIntero({ tipo: "mese", anno: 2026, mese: 1 })).toBe(false);
    expect(
      copreAnnoIntero({ tipo: "personalizzato", anno: 2026, da: "2026-01-01", a: "2026-12-31" }),
    ).toBe(true);
  });

  it("associa ogni mese al suo trimestre", () => {
    expect([1, 3, 4, 6, 7, 9, 10, 12].map(trimestreDi)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
  });
});
