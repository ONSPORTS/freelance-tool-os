import { describe, expect, it } from "vitest";
import { euro, euroTondo, iniziali, num, percentuale, variazione, data } from "./format";

describe("formattazione italiana", () => {
  it("scrive gli importi con il separatore di migliaia, anche a quattro cifre", () => {
    // Senza `useGrouping: "always"` alcune versioni di ICU scrivono 1234,56 €
    // e il valore cambia forma fra server e browser.
    expect(euro(1234.56)).toBe("1.234,56 €");
    expect(euro(999.9)).toBe("999,90 €");
    expect(euro(88_888.88)).toBe("88.888,88 €");
    expect(euroTondo(1234.56)).toBe("1.235 €");
    expect(num(1234)).toBe("1.234");
  });

  it("non stampa mai NaN o undefined", () => {
    expect(euro(null)).toBe("—");
    expect(euro(Number.NaN)).toBe("—");
    expect(percentuale(undefined)).toBe("—");
    expect(data(null)).toBe("—");
  });

  it("mostra le percentuali con il segno esplicito nelle variazioni", () => {
    expect(percentuale(0.2898)).toBe("28,98 %");
    expect(variazione(0.124)).toBe("+12,4 %");
    expect(variazione(-0.043)).toBe("−4,3 %");
    expect(variazione(0)).toBe("0,0 %");
  });

  it("formatta le date all'italiana", () => {
    expect(data("2026-01-15")).toBe("15/01/2026");
  });

  it("ricava le iniziali per gli avatar cliente", () => {
    expect(iniziali("Alfa Srl")).toBe("AS");
    expect(iniziali("Gamma")).toBe("G");
  });
});
