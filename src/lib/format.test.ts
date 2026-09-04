import { describe, expect, it } from "vitest";
import {
  aliquota,
  analizzaNumero,
  analizzaPercentuale,
  data,
  euro,
  euroTondo,
  iniziali,
  num,
  perCampo,
  percentuale,
  variazione,
} from "./format";

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

describe("lettura dei numeri digitati", () => {
  it("accetta le forme che una persona italiana scrive davvero", () => {
    expect(analizzaNumero("1.234,56")).toBe(1234.56);
    expect(analizzaNumero("1234,56")).toBe(1234.56);
    expect(analizzaNumero("1234.56")).toBe(1234.56);
    expect(analizzaNumero("1 234,56")).toBe(1234.56);
    expect(analizzaNumero("3.000")).toBe(3000);
    expect(analizzaNumero("1.234.567,89")).toBe(1234567.89);
    expect(analizzaNumero("12.5")).toBe(12.5);
    expect(analizzaNumero("1.234,56 €")).toBe(1234.56);
    expect(analizzaNumero("-450,20")).toBe(-450.2);
    expect(analizzaNumero("−450,20")).toBe(-450.2);
  });

  it("restituisce null su ciò che numero non è", () => {
    expect(analizzaNumero("")).toBeNull();
    expect(analizzaNumero("   ")).toBeNull();
    expect(analizzaNumero("tremila")).toBeNull();
    expect(analizzaNumero("-")).toBeNull();
  });

  it("interpreta le percentuali sia in centesimi sia in frazione", () => {
    expect(analizzaPercentuale("22")).toBe(0.22);
    expect(analizzaPercentuale("22%")).toBe(0.22);
    expect(analizzaPercentuale("0,22")).toBe(0.22);
    expect(analizzaPercentuale("100")).toBe(1);
    expect(analizzaPercentuale("0")).toBe(0);
  });

  it("prepara il valore per il campo in modifica", () => {
    expect(perCampo(1234.56)).toBe("1.234,56");
    expect(perCampo(3000)).toBe("3.000");
  });
});

describe("aliquota", () => {
  it("toglie i decimali solo quando non ci sono", () => {
    expect(aliquota(0.78)).toBe("78 %");
    expect(aliquota(0.22)).toBe("22 %");
    // Il 26,07 % della Gestione Separata non diventa 26 %: sarebbe un numero
    // sbagliato detto bene.
    expect(aliquota(0.2607)).toBe("26,07 %");
    expect(aliquota(null)).toBe("—");
  });
});
