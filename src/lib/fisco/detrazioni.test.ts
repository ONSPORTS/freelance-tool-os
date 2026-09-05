import { describe, expect, it } from "vitest";
import { detrazioneLavoroAutonomo } from "./detrazioni";
import { PARAMETRI_2026 } from "./parametri/2026";

const d = PARAMETRI_2026.detrazioneLavoroAutonomo;
const importo = (reddito: number) => detrazioneLavoroAutonomo(reddito, d).importo;

/*
  Ogni attesa qui sotto è il conto fatto a mano sulla formula dell'art. 13
  comma 5 TUIR, non l'output del codice ricopiato: se il codice cambiasse
  formula, questi numeri non lo seguirebbero.
*/
describe("detrazione per redditi di lavoro autonomo", () => {
  it("è piena fino alla prima soglia", () => {
    expect(importo(1)).toBe(1_265);
    expect(importo(5_000)).toBe(1_265);
    expect(importo(5_500)).toBe(1_265);
  });

  it("cala linearmente fra 5.500 e 28.000", () => {
    // 500 + 765 × (28.000 − 6.520) ÷ 22.500 = 500 + 730,32
    expect(importo(6_520)).toBe(1_230.32);
    // 500 + 765 × 17.000 ÷ 22.500 = 500 + 578
    expect(importo(11_000)).toBe(1_078);
    // 500 + 765 × 0 ÷ 22.500
    expect(importo(28_000)).toBe(500);
  });

  it("cala più lentamente fra 28.000 e 50.000, e si azzera lì", () => {
    // 500 × (50.000 − 39.000) ÷ 22.000 = 250
    expect(importo(39_000)).toBe(250);
    expect(importo(50_000)).toBe(0);
  });

  it("non spetta oltre i 50.000 €, e lo dice", () => {
    const e = detrazioneLavoroAutonomo(50_001, d);
    expect(e.importo).toBe(0);
    expect(e.assente).toBe("oltreSoglia");
    expect(e.descrizione).toContain("50.000");
  });

  it("non spetta senza reddito, e lo dice", () => {
    expect(detrazioneLavoroAutonomo(0, d).assente).toBe("redditoNullo");
    expect(detrazioneLavoroAutonomo(-1_000, d).importo).toBe(0);
  });

  it("aggiunge la maggiorazione solo dentro la fascia 11.000–17.000", () => {
    // Un gradino, non una rampa: a 11.000 non spetta ancora, a 11.001 sì.
    expect(importo(11_000)).toBe(1_078);
    expect(importo(11_001)).toBe(1_127.97); // 1.077,97 + 50
    expect(importo(17_000)).toBe(924); // 874 + 50
    expect(importo(17_001)).toBe(873.97); // senza maggiorazione
    expect(detrazioneLavoroAutonomo(14_000, d).maggiorazione).toBe(50);
    expect(detrazioneLavoroAutonomo(20_000, d).maggiorazione).toBe(0);
  });

  it("resta continua sui punti di raccordo", () => {
    // Un euro in più non fa saltare la detrazione di decine di euro: se
    // succedesse, due redditi quasi uguali pagherebbero imposte diverse.
    expect(Math.abs(importo(5_500) - importo(5_501))).toBeLessThan(0.1);
    expect(Math.abs(importo(28_000) - importo(28_001))).toBeLessThan(0.1);
  });

  it("spiega la formula applicata, con dentro i numeri di chi legge", () => {
    expect(detrazioneLavoroAutonomo(6_520, d).descrizione).toContain("6.520 €");
    expect(detrazioneLavoroAutonomo(3_000, d).descrizione).toContain("1.265");
  });
});
