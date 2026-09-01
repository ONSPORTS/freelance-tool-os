import { describe, expect, it } from "vitest";
import { calcolaProspetto } from "@/lib/fisco/motore";
import { PARAMETRI_2026 } from "@/lib/fisco/parametri/2026";
import { impostazioniPredefinite } from "@/lib/fisco/impostazioni";
import { datiDemo, ANNO_DEMO } from "@/lib/dati/demo";
import { coloreDaNome } from "@/lib/format";
import {
  andamentoMensile,
  concentrazione,
  giorniMediIncasso,
  portafoglioClienti,
  scadutoPerFascia,
} from "./dashboard";

const dati = datiDemo();
const impostazioni = dati.impostazioni[0] ?? impostazioniPredefinite(PARAMETRI_2026);
const prospetto = calcolaProspetto({
  impostazioni,
  parametri: PARAMETRI_2026,
  fatture: dati.fatture,
  costi: dati.costi,
  versamenti: dati.versamenti,
  oggi: "2026-09-01",
});

describe("andamento mensile", () => {
  const mesi = andamentoMensile(prospetto.fattureCalcolate, prospetto.costiCalcolati, ANNO_DEMO);

  it("restituisce sempre dodici mesi, anche quelli senza movimenti", () => {
    expect(mesi).toHaveLength(12);
    expect(mesi.map((m) => m.etichetta)).toEqual([
      "Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic",
    ]);
  });

  it("l'emesso dei dodici mesi somma al fatturato dell'anno", () => {
    const totale = mesi.reduce((a, m) => a + m.emesso, 0);
    expect(totale).toBe(46_050);
  });

  it("l'incassato somma ai ricavi rilevanti del prospetto", () => {
    const totale = Math.round(mesi.reduce((a, m) => a + m.incassato, 0) * 100) / 100;
    expect(totale).toBe(prospetto.ricaviRilevanti);
  });

  it("il cumulato è monotono quando i costi non superano gli incassi", () => {
    const gennaio = mesi[0];
    expect(gennaio.cumulatoIncassato).toBe(
      Math.round((gennaio.incassato - gennaio.costi) * 100) / 100,
    );
    const ultimo = mesi[11].cumulatoIncassato;
    expect(ultimo).toBeGreaterThan(0);
  });
});

describe("portafoglio clienti", () => {
  const portafoglio = portafoglioClienti(
    prospetto.fattureCalcolate, dati.clienti, ANNO_DEMO, coloreDaNome,
  );

  it("ordina dal cliente più grande al più piccolo", () => {
    const quote = portafoglio.map((r) => r.emesso);
    expect([...quote].sort((a, b) => b - a)).toEqual(quote);
    expect(portafoglio[0].nome).toBe("Alfa Srl");
    expect(portafoglio[0].emesso).toBe(18_000);
  });

  it("le quote sommano a uno", () => {
    const somma = portafoglio.reduce((a, r) => a + r.quota, 0);
    expect(somma).toBeCloseTo(1, 6);
  });

  it("misura la concentrazione del primo cliente", () => {
    expect(concentrazione(portafoglio)).toBeCloseTo(18_000 / 46_050, 6);
    expect(concentrazione([])).toBe(0);
  });

  it("dà a ogni cliente un colore stabile", () => {
    const secondo = portafoglioClienti(
      prospetto.fattureCalcolate, dati.clienti, ANNO_DEMO, coloreDaNome,
    );
    expect(portafoglio.map((r) => r.colore)).toEqual(secondo.map((r) => r.colore));
  });

  it("esclude i clienti senza movimenti nell'anno", () => {
    const conFantasma = [
      ...dati.clienti,
      { id: "cli-fantasma", nome: "Mai Fatturato", canaleAcquisizione: "", note: "" },
    ];
    const righe = portafoglioClienti(prospetto.fattureCalcolate, conFantasma, ANNO_DEMO, coloreDaNome);
    expect(righe.some((r) => r.id === "cli-fantasma")).toBe(false);
  });
});

describe("scaduto per fascia", () => {
  const fasce = scadutoPerFascia(prospetto.fattureCalcolate);

  it("divide il credito aperto fra termini e fasce di ritardo", () => {
    const totale =
      fasce.neiTermini + fasce.entro30 + fasce.entro60 + fasce.entro90 + fasce.oltre90;
    // Le quattro fatture aperte valgono 6.100 € più il bollo addebitato.
    expect(Math.round(totale)).toBe(6108);
    expect(fasce.totaleScaduto).toBe(
      Math.round((fasce.entro30 + fasce.entro60 + fasce.entro90 + fasce.oltre90) * 100) / 100,
    );
  });

  it("mette nella fascia lunga la fattura dimenticata", () => {
    // Zeta Digital, emessa il 24 giugno, scaduta il 24 luglio: oltre i 30 giorni.
    expect(fasce.entro60).toBe(902);
  });

  it("su un archivio vuoto restituisce zeri, non NaN", () => {
    const vuote = scadutoPerFascia([]);
    expect(vuote.totaleScaduto).toBe(0);
    expect(vuote.neiTermini).toBe(0);
  });
});

describe("giorni medi di incasso", () => {
  it("considera solo le fatture già incassate", () => {
    expect(giorniMediIncasso(prospetto.fattureCalcolate)).toBe(35);
  });

  it("senza incassi non inventa uno zero", () => {
    expect(giorniMediIncasso([])).toBeNull();
  });
});
