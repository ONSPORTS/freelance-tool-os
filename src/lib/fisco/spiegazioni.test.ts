import { describe, expect, it } from "vitest";
import {
  COSTI_FIXTURE,
  FATTURE_FIXTURE,
  OGGI_FIXTURE,
  impostazioniForfettario,
  impostazioniOrdinario,
} from "./fixture";
import { calcolaProspetto } from "./motore";
import { PARAMETRI_2026 } from "./parametri/2026";
import { euro, percentuale } from "@/lib/format";
import { descriviScaglioni, dettaglioSoglia, prospettoDettagliato } from "./spiegazioni";
import { conValoreDichiarato } from "./parametri-utente";
import type { Impostazioni } from "./tipi";

const par = PARAMETRI_2026;

function sezioniDi(imp: Impostazioni, fatture = FATTURE_FIXTURE, costi = COSTI_FIXTURE) {
  const p = calcolaProspetto({
    impostazioni: imp, parametri: par, fatture, costi, oggi: OGGI_FIXTURE,
  });
  return { sezioni: prospettoDettagliato(p, imp, par), prospetto: p };
}

function riga(sezioni: ReturnType<typeof prospettoDettagliato>, id: string) {
  return sezioni.flatMap((s) => s.righe).find((r) => r.id === id);
}

describe("prospetto dettagliato", () => {
  it("copre le sei sezioni dell'Excel, nell'ordine", () => {
    const { sezioni } = sezioniDi(impostazioniForfettario());
    expect(sezioni.map((s) => s.lettera)).toEqual(["A", "B", "C", "D", "E", "F"]);
    expect(sezioni.map((s) => s.id)).toEqual([
      "base", "reddito", "imposte", "contributi", "sintesi", "acconti",
    ]);
  });

  it("ogni riga porta un valore, e quasi tutte una formula", () => {
    const { sezioni } = sezioniDi(impostazioniForfettario());
    const righe = sezioni.flatMap((s) => s.righe);
    expect(righe.length).toBeGreaterThan(20);
    for (const r of righe) {
      expect(r.valore).toBeDefined();
      expect(["euro", "percentuale", "testo"]).toContain(r.formato);
    }
    // Solo le righe di puro totale possono farne a meno.
    const senzaFormula = righe.filter((r) => !r.formula);
    expect(senzaFormula.every((r) => r.totale)).toBe(true);
  });

  it("spiega il reddito lordo forfettario con il coefficiente reale", () => {
    const { sezioni } = sezioniDi(impostazioniForfettario());
    expect(riga(sezioni, "reddito-lordo")?.formula).toBe(
      `${euro(7500)} × ${percentuale(0.78, 0)}, il coefficiente di redditività del tuo gruppo ATECO.`,
    );
  });

  it("spiega i contributi con la base e il massimale", () => {
    const { sezioni } = sezioniDi(impostazioniForfettario());
    const gs = riga(sezioni, "gestione-separata");
    expect(gs?.valore).toBe(1525.1);
    expect(gs?.formula).toBe(
      `${euro(5850)} × ${percentuale(0.2607, 2)}, fino al massimale di ${euro(122_295)}.`,
    );
  });

  it("scompone l'IRPEF negli scaglioni davvero applicati", () => {
    const imp = impostazioniOrdinario();
    const al = (q: number, a: number) => `${euro(q)} al ${percentuale(a, 0)}`;
    expect(descriviScaglioni(4820.24, imp)).toBe(
      `Scaglioni progressivi: ${al(4820.24, 0.23)}.`,
    );
    expect(descriviScaglioni(40_000, imp)).toBe(
      `Scaglioni progressivi: ${al(28_000, 0.23)}, poi ${al(12_000, 0.33)}.`,
    );
    expect(descriviScaglioni(60_000, imp)).toBe(
      `Scaglioni progressivi: ${al(28_000, 0.23)}, poi ${al(22_000, 0.33)}, poi ${al(10_000, 0.43)}.`,
    );
    expect(descriviScaglioni(0, imp)).toContain("Nessuna imposta");
  });

  it("in forfettario dice perché i costi non abbattono nulla", () => {
    const { sezioni } = sezioniDi(impostazioniForfettario());
    const costi = riga(sezioni, "costi-indeducibili");
    expect(costi?.valore).toBe(0);
    expect(costi?.formula).toContain("non si deducono analiticamente");
    expect(costi?.nota).toContain("coefficiente ATECO");
    expect(riga(sezioni, "costi-deducibili")).toBeUndefined();
  });

  it("in ordinario mostra le voci che il forfettario non ha", () => {
    const { sezioni } = sezioniDi(impostazioniOrdinario());
    expect(riga(sezioni, "irpef-lorda")).toBeDefined();
    expect(riga(sezioni, "add-regionale")).toBeDefined();
    expect(riga(sezioni, "iva-detraibile")).toBeDefined();
    expect(riga(sezioni, "sostitutiva")).toBeUndefined();
  });

  it("dichiara se i contributi dedotti vengono dai versamenti o dalla competenza", () => {
    const senza = sezioniDi(impostazioniForfettario());
    expect(riga(senza.sezioni, "contributi-dedotti")?.formula).toContain("competenza");

    const p = calcolaProspetto({
      impostazioni: impostazioniForfettario(),
      parametri: par,
      fatture: FATTURE_FIXTURE,
      costi: COSTI_FIXTURE,
      versamenti: [{ id: "v", data: "2026-06-30", tipo: "contributi", importo: 1200 }],
      oggi: OGGI_FIXTURE,
    });
    const conVersamenti = prospettoDettagliato(p, impostazioniForfettario(), par);
    expect(riga(conVersamenti, "contributi-dedotti")?.formula).toContain("per cassa");
  });

  it("segnala l'accredito parziale con il minimale a fianco", () => {
    const { sezioni } = sezioniDi(impostazioniForfettario());
    const accredito = riga(sezioni, "accredito");
    expect(accredito?.valore).toBe("Accredito parziale");
    expect(accredito?.formula).toContain(euro(18_808));
    expect(accredito?.nota).toContain("quasi nessuno dà");
  });

  it("mostra il credito d'imposta invece del saldo quando le ritenute eccedono", () => {
    const { sezioni } = sezioniDi({
      ...impostazioniOrdinario(), ritenutaAttiva: true, detrazioniPersonali: 1200,
    });
    expect(riga(sezioni, "credito")?.formula).toContain("non un saldo negativo");
    expect(riga(sezioni, "imposte-a-saldo")).toBeUndefined();
  });

  it("spiega perché gli acconti non sono dovuti su importi minuscoli", () => {
    const piccola = [{ ...FATTURE_FIXTURE[0], imponibile: 60, dataIncasso: "2026-02-10" }];
    const { sezioni } = sezioniDi(impostazioniForfettario(), piccola, []);
    const acconti = riga(sezioni, "acconti-non-dovuti");
    expect(acconti?.valore).toBe("Non dovuti");
    expect(acconti?.formula).toContain(euro(51.65));
  });

  it("descrive la rateizzazione con e senza interessi", () => {
    const { sezioni } = sezioniDi(impostazioniForfettario());
    const rata = riga(sezioni, "rata");
    expect(rata?.formula).toContain("6 rate da giugno a novembre");
    expect(rata?.nota).toContain("Senza interessi");
  });

  it("dice quanto manca al limite forfettario", () => {
    const { prospetto } = sezioniDi(impostazioniForfettario());
    const testo = dettaglioSoglia(prospetto, impostazioniForfettario());
    expect(testo).toContain("puoi ancora incassare");
    expect(testo).toContain(euro(77_500));
  });

  it("in regime ordinario la soglia non si applica", () => {
    const { prospetto } = sezioniDi(impostazioniOrdinario());
    expect(dettaglioSoglia(prospetto, impostazioniOrdinario())).toBeNull();
  });

  it("chiama «tua» un'aliquota solo se l'hai dichiarata", () => {
    // È il difetto da cui nasce la schermata Parametri: la formula diceva
    // «l'aliquota della tua regione» sopra una media dell'app, e nessuno
    // sarebbe mai tornato a controllarla.
    const media = sezioniDi(impostazioniOrdinario());
    expect(riga(media.sezioni, "add-regionale")?.formula).toMatch(/predefinit/);
    expect(riga(media.sezioni, "add-comunale")?.formula).toMatch(/predefinit/);

    const dichiarata = conValoreDichiarato(impostazioniOrdinario(), "addizionaleRegionale", 0.0203);
    const dopo = sezioniDi(dichiarata);
    expect(riga(dopo.sezioni, "add-regionale")?.formula).toContain("della tua regione");
    // Quella comunale resta com'era: si dichiarano una per una.
    expect(riga(dopo.sezioni, "add-comunale")?.formula).toMatch(/predefinit/);
  });
});
