import { describe, expect, it } from "vitest";
import {
  COSTI_FIXTURE,
  FATTURE_FIXTURE,
  OGGI_FIXTURE,
  impostazioniForfettario,
  impostazioniOrdinario,
} from "./fixture";
import { calcolaIva } from "./iva";
import { calcolaProspetto } from "./motore";
import { PARAMETRI_2026 } from "./parametri/2026";
import { prossimeScadenze, scadenzeAnno } from "./scadenze";
import type { Impostazioni } from "./tipi";

const par = PARAMETRI_2026;

function prospettoDi(imp: Impostazioni) {
  return calcolaProspetto({
    impostazioni: imp,
    parametri: par,
    fatture: FATTURE_FIXTURE,
    costi: COSTI_FIXTURE,
    oggi: OGGI_FIXTURE,
  });
}

/**
 * Lo scadenzario di un anno che ha un anno prima.
 *
 * Nei test l'anno precedente è lo stesso scenario: quello che conta qui non è
 * di quale anno siano i numeri, ma che saldo e acconti vengano da *quel*
 * prospetto e non da quello dell'anno in corso.
 */
function scadenzeDi(imp: Impostazioni, precedente = prospettoDi(imp)) {
  const prospetto = prospettoDi(imp);
  const iva = calcolaIva(prospetto.fattureCalcolate, prospetto.costiCalcolati, imp, par);
  return scadenzeAnno(imp, par, prospetto, iva, precedente);
}

describe("scadenzario", () => {
  it("in forfettario nasconde LIPE, dichiarazione IVA e liquidazioni", () => {
    const titoli = scadenzeDi(impostazioniForfettario()).map((s) => s.titolo);
    expect(titoli.some((t) => t.includes("LIPE"))).toBe(false);
    expect(titoli.some((t) => t.includes("Dichiarazione IVA"))).toBe(false);
    expect(titoli.some((t) => t.includes("IVA del"))).toBe(false);
    // Il bollo virtuale invece riguarda proprio i forfettari.
    expect(titoli.some((t) => t.includes("bollo"))).toBe(true);
  });

  it("in ordinario trimestrale mostra le tre liquidazioni e le LIPE", () => {
    const scadenze = scadenzeDi(impostazioniOrdinario());
    const titoli = scadenze.map((s) => s.titolo);
    expect(titoli.filter((t) => t.startsWith("IVA del")).length).toBe(3);
    // Quattro: le tre dell'anno più quella del 4° trimestre precedente.
    expect(titoli.filter((t) => t.startsWith("LIPE")).length).toBe(4);
    expect(titoli.some((t) => t.includes("bollo"))).toBe(false);
  });

  it("in ordinario mensile elenca dodici liquidazioni, l'ultima a gennaio dopo", () => {
    const scadenze = scadenzeDi({ ...impostazioniOrdinario(), periodicitaIva: "mensile" });
    const mensili = scadenze.filter((s) => s.id.startsWith("iva-mensile-"));
    expect(mensili).toHaveLength(12);
    const dicembre = mensili.find((s) => s.titolo === "IVA di dicembre");
    expect(dicembre?.data.startsWith("2027-01")).toBe(true);
  });

  it("mostra le rate degli artigiani solo a chi le versa", () => {
    const separata = scadenzeDi(impostazioniForfettario());
    expect(separata.some((s) => s.titolo.includes("artigiani"))).toBe(false);

    const artigiani = scadenzeDi({
      ...impostazioniForfettario(),
      gestione: "artigiani",
      contributiFissi: 4600,
    });
    const rate = artigiani.filter((s) => s.titolo.includes("artigiani"));
    expect(rate).toHaveLength(4);
    expect(rate.every((r) => r.importo === 1150)).toBe(true);
  });

  it("collega gli importi ai numeri reali del prospetto", () => {
    const imp = impostazioniForfettario();
    const scadenze = scadenzeDi(imp);
    const saldo = scadenze.find((s) => s.id === "saldo-e-primo-acconto");
    /*
      Dovuto 2.173,84 €: 648,74 di imposte e 1.525,10 di contributi.
      Giugno: saldo intero, più il 40 % delle imposte (259,50) e la prima
      rata dell'acconto contributivo — 80 % di 1.525,10 in due rate: 610,04.
      Novembre: il 60 % delle imposte (389,24) più la seconda rata (610,04).
      Prima i contributi seguivano il 40/60 delle imposte, e novembre portava
      305,02 € di troppo: il 20 % dei contributi che non è mai stato in acconto.
    */
    expect(saldo?.importo).toBeCloseTo(2173.84 + 259.5 + 610.04, 2);
    const secondo = scadenze.find((s) => s.id === "secondo-acconto");
    expect(secondo?.importo).toBeCloseTo(389.24 + 610.04, 2);
  });

  it("sposta le scadenze che cadono in un giorno festivo", () => {
    const scadenze = scadenzeDi(impostazioniOrdinario());
    // Il 31 maggio 2026 è domenica: si adempie il lunedì.
    const lipe = scadenze.find((s) => s.id === "lipe-1t");
    expect(lipe?.dataDiCalendario).toBe("2026-05-31");
    expect(lipe?.data).toBe("2026-06-01");
    // Il 16 maggio 2026 è sabato.
    const primoTrimestre = scadenze.find((s) => s.id === "iva-1t");
    expect(primoTrimestre?.dataDiCalendario).toBe("2026-05-16");
    expect(primoTrimestre?.data).toBe("2026-05-18");
    // Il 20 agosto 2026 è un giovedì: resta dov'è, senza data di calendario.
    const secondoTrimestre = scadenze.find((s) => s.id === "iva-2t");
    expect(secondoTrimestre?.data).toBe("2026-08-20");
    expect(secondoTrimestre?.dataDiCalendario).toBeUndefined();
  });

  it("è ordinato per data", () => {
    const date = scadenzeDi(impostazioniOrdinario()).map((s) => s.data);
    expect([...date].sort()).toEqual(date);
  });

  it("senza acconti dovuti la voce di novembre sparisce", () => {
    const scadenze = calcolaProspetto({
      impostazioni: impostazioniForfettario(),
      parametri: par,
      fatture: [],
      costi: [],
      oggi: OGGI_FIXTURE,
    });
    const iva = calcolaIva([], [], impostazioniForfettario(), par);
    const elenco = scadenzeAnno(impostazioniForfettario(), par, scadenze, iva, scadenze);
    expect(elenco.some((s) => s.id === "secondo-acconto")).toBe(false);
  });

  it("saldo e acconti vengono dall'anno prima, non dall'anno in corso", () => {
    /*
      È il difetto che questo passaggio corregge: quello che esce dal conto a
      giugno del 2026 è il saldo del 2025 più il primo acconto del 2026, e
      tutti e due si calcolano sui numeri del 2025. Prima venivano dal 2026,
      cioè da un saldo che si sarebbe versato un anno dopo.
    */
    const imp = impostazioniForfettario();
    const corrente = prospettoDi(imp);
    const magro = calcolaProspetto({
      impostazioni: imp, parametri: par,
      fatture: [{ ...FATTURE_FIXTURE[0], imponibile: 1_000, dataIncasso: "2026-02-10" }],
      costi: [], oggi: OGGI_FIXTURE,
    });
    const iva = calcolaIva(corrente.fattureCalcolate, corrente.costiCalcolati, imp, par);
    const elenco = scadenzeAnno(imp, par, corrente, iva, magro);
    const giugno = elenco.find((s) => s.id === "saldo-e-primo-acconto");
    expect(giugno?.importo).toBeCloseTo(magro.saldoResiduo + magro.acconti.primo, 2);
    expect(giugno?.importo).not.toBeCloseTo(corrente.saldoResiduo + corrente.acconti.primo, 2);
    expect(giugno?.titolo).toContain("Saldo 2026");
  });

  it("al primo anno di attività le due scadenze restano senza importo, con il perché", () => {
    const imp = impostazioniForfettario();
    const corrente = prospettoDi(imp);
    const iva = calcolaIva(corrente.fattureCalcolate, corrente.costiCalcolati, imp, par);
    const elenco = scadenzeAnno(imp, par, corrente, iva, null);
    const giugno = elenco.find((s) => s.id === "saldo-e-primo-acconto")!;
    expect(giugno.importo).toBeNull();
    expect(giugno.nota).toContain("primo anno");
    const novembre = elenco.find((s) => s.id === "secondo-acconto")!;
    expect(novembre.importo).toBeNull();
    // La voce resta in elenco: una scadenza che sparisce è peggio di una
    // scadenza senza importo.
    expect(novembre.nota).toBeDefined();
  });

  it("le prossime scadenze partono da oggi", () => {
    const scadenze = scadenzeDi(impostazioniForfettario());
    const prossime = prossimeScadenze(scadenze, "2026-09-01", 3);
    // Dopo settembre a un forfettario restano due sole scadenze nell'anno:
    // è una delle ragioni per cui il cruscotto guarda anche all'anno dopo.
    expect(prossime).toHaveLength(2);
    expect(prossime.every((s) => s.data >= "2026-09-01")).toBe(true);
    expect(prossime[0].data <= prossime[1].data).toBe(true);

    const ordinario = scadenzeDi(impostazioniOrdinario());
    expect(prossimeScadenze(ordinario, "2026-09-01", 3)).toHaveLength(3);
  });
});
