import { describe, expect, it } from "vitest";
import { confrontaRegimi, curvaConfronto, puntoDiIncrocio } from "./confronto";
import { calcolaCosto, calcolaFattura } from "./documenti";
import {
  COSTI_FIXTURE,
  FATTURE_FIXTURE,
  OGGI_FIXTURE,
  impostazioniForfettario,
  impostazioniOrdinario,
} from "./fixture";
import { calcolaIva } from "./iva";
import { PARAMETRI_2026 } from "./parametri/2026";
import type { Costo, Fattura, Impostazioni } from "./tipi";

const par = PARAMETRI_2026;

function liquida(imp: Impostazioni, fatture: Fattura[] = FATTURE_FIXTURE, costi: Costo[] = COSTI_FIXTURE) {
  return calcolaIva(
    fatture.map((f) => calcolaFattura(f, imp, OGGI_FIXTURE)),
    costi.map((c) => calcolaCosto(c, imp)),
    imp,
    par,
  );
}

describe("liquidazione IVA", () => {
  it("in forfettario resta tutto a zero e la schermata non si applica", () => {
    const l = liquida(impostazioniForfettario());
    expect(l.applicabile).toBe(false);
    expect(l.totaleDebito).toBe(0);
    expect(l.totaleCredito).toBe(0);
    expect(l.totaleDaVersare).toBe(0);
  });

  it("segue la data del documento, non l'incasso", () => {
    const l = liquida(impostazioniOrdinario());
    // Fattura di gennaio da 3.000 €: l'IVA è di gennaio anche se incassata a febbraio.
    expect(l.mesi[0].debito).toBe(660);
    expect(l.mesi[1].debito).toBe(990);
    expect(l.mesi[2].debito).toBe(550);
    // Costo pagato a febbraio ma datato gennaio: credito di gennaio.
    expect(l.mesi[0].credito).toBe(39.6);
    expect(l.totaleDebito).toBe(2200);
  });

  it("riporta il credito da un periodo al successivo", () => {
    const costoGrosso: Costo = {
      ...COSTI_FIXTURE[0],
      id: "cx",
      dataDocumento: "2026-01-05",
      imponibile: 10_000,
      aliquotaIva: 0.22,
      dataPagamento: "2026-01-05",
    };
    const l = liquida(impostazioniOrdinario(), FATTURE_FIXTURE, [costoGrosso]);
    expect(l.mesi[0].saldo).toBe(round(660 - 2200));
    expect(l.mesi[0].daVersare).toBe(0);
    expect(l.mesi[0].creditoANuovo).toBe(1540);
    expect(l.mesi[1].creditoPrecedente).toBe(1540);
    expect(l.mesi[1].daVersare).toBe(0);
    expect(l.mesi[1].creditoANuovo).toBe(550);
    expect(l.mesi[2].daVersare).toBe(0);
  });

  it("applica la maggiorazione dell'1% ai primi tre trimestri e non al quarto", () => {
    const imp = impostazioniOrdinario();
    const l = liquida(imp);
    const t1 = l.trimestri[0];
    expect(t1.daVersare).toBe(2160.4); // 2.200 € di debito meno 39,60 € di credito
    expect(t1.maggiorazione).toBe(21.6);
    expect(t1.totaleDaVersare).toBe(2182);

    const quarto = liquida(imp, [
      { ...FATTURE_FIXTURE[0], id: "q4", dataEmissione: "2026-11-10", dataIncasso: "2026-12-01" },
    ], []);
    expect(quarto.trimestri[3].daVersare).toBe(660);
    expect(quarto.trimestri[3].maggiorazione).toBe(0);
    expect(quarto.trimestri[3].totaleDaVersare).toBe(660);
  });

  it("assegna le scadenze secondo la periodicità scelta", () => {
    const trimestrale = liquida(impostazioniOrdinario());
    expect(trimestrale.trimestri.map((t) => t.scadenza)).toEqual([
      "2026-05-16",
      "2026-08-20",
      "2026-11-16",
      "2027-03-16",
    ]);
    expect(trimestrale.mesi[0].scadenza).toBeNull();

    const mensile = liquida({ ...impostazioniOrdinario(), periodicitaIva: "mensile" });
    expect(mensile.mesi[0].scadenza).toBe("2026-02-16");
    expect(mensile.mesi[11].scadenza).toBe("2027-01-16");
    expect(mensile.trimestri[0].scadenza).toBeNull();
  });
});

describe("confronto fra regimi", () => {
  const ing = { ricavi: 7500, costiDeducibili: 980, costiTotali: 1019.6, ivaAcquisti: 39.6 };

  it("riproduce il confronto del foglio di calcolo", () => {
    const c = confrontaRegimi(ing, impostazioniForfettario(), par);
    expect(c.forfettario.redditoLordo).toBe(5850);
    expect(c.forfettario.contributi).toBe(1525.1);
    expect(c.forfettario.imposte).toBe(648.74);
    expect(c.forfettario.caricoTotale).toBe(2173.84);
    expect(c.forfettario.nettoInTasca).toBe(4306.56);

    expect(c.ordinario.redditoLordo).toBe(6520);
    expect(c.ordinario.contributi).toBe(1699.76);
    expect(c.ordinario.imposte).toBe(1230.61);
    expect(c.ordinario.caricoTotale).toBe(2930.37);
    expect(c.ordinario.nettoInTasca).toBe(3589.63);

    expect(c.differenzaNetto).toBe(716.93);
    expect(c.convenienza).toBe("forfettario");
    expect(c.verdetto).toContain("forfettario");
  });

  it("dice che sopra il limite il forfettario non si applica", () => {
    const c = confrontaRegimi({ ...ing, ricavi: 95_000 }, impostazioniForfettario(), par);
    expect(c.forfettarioApplicabile).toBe(false);
    expect(c.verdetto).toContain("non è applicabile");
  });

  it("non divide per zero a ricavi nulli", () => {
    const c = confrontaRegimi({ ...ing, ricavi: 0 }, impostazioniForfettario(), par);
    expect(c.forfettario.pressione).toBe(0);
    expect(c.ordinario.pressione).toBe(0);
    expect(c.verdetto).toContain("Inserisci");
  });

  it("produce una curva monotona sui ricavi", () => {
    const punti = curvaConfronto(
      { costiDeducibili: 980, costiTotali: 1019.6, ivaAcquisti: 39.6 },
      impostazioniForfettario(),
      par,
      { da: 20_000, a: 80_000, passo: 20_000 },
    );
    expect(punti).toHaveLength(4);
    expect(punti[0].ricavi).toBe(20_000);
    for (let i = 1; i < punti.length; i++) {
      expect(punti[i].forfettario).toBeGreaterThan(punti[i - 1].forfettario);
      expect(punti[i].ordinario).toBeGreaterThan(punti[i - 1].ordinario);
    }
  });

  it("trova il fatturato a cui le due curve si incrociano", () => {
    // Con costi reali alti l'ordinario conviene finché il fatturato resta basso:
    // il forfettario riconosce solo il 22% forfettario di costi, non quelli veri.
    const costi = { costiDeducibili: 20_000, costiTotali: 23_000, ivaAcquisti: 3_000 };
    const incrocio = puntoDiIncrocio(costi, impostazioniForfettario(), par);
    expect(incrocio).not.toBeNull();
    expect(incrocio).toBeGreaterThan(55_000);
    expect(incrocio).toBeLessThan(70_000);

    const sotto = confrontaRegimi({ ...costi, ricavi: (incrocio as number) - 5_000 }, impostazioniForfettario(), par);
    const sopra = confrontaRegimi({ ...costi, ricavi: (incrocio as number) + 5_000 }, impostazioniForfettario(), par);
    expect(sotto.convenienza).toBe("ordinario");
    expect(sopra.convenienza).toBe("forfettario");
  });

  it("restituisce null se le curve non si incrociano mai", () => {
    const incrocio = puntoDiIncrocio(
      { costiDeducibili: 0, costiTotali: 0, ivaAcquisti: 0 },
      impostazioniForfettario(),
      par,
    );
    expect(incrocio).toBeNull();
  });
});

function round(n: number) {
  return Math.round(n * 100) / 100;
}
