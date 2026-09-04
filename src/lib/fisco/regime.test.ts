import { describe, expect, it } from "vitest";
import { cambiamentiDiRegime } from "./regime";
import { proponiRegime } from "./chiusura";
import { calcolaProspetto } from "./motore";
import { OGGI_FIXTURE, impostazioniForfettario, impostazioniOrdinario } from "./fixture";
import { PARAMETRI_2026 } from "./parametri/2026";
import type { Impostazioni, ParametriAnno } from "./tipi";

const imp = impostazioniForfettario();
const par = PARAMETRI_2026;

describe("cosa cambia col regime", () => {
  it("chi non cambia regime non ha niente da leggere", () => {
    expect(cambiamentiDiRegime("forfettario", "forfettario", imp, par)).toEqual([]);
    expect(cambiamentiDiRegime("ordinario", "ordinario", imp, par)).toEqual([]);
  });

  it("le due direzioni dicono cose diverse", () => {
    const uscita = cambiamentiDiRegime("forfettario", "ordinario", imp, par);
    const rientro = cambiamentiDiRegime("ordinario", "forfettario", imp, par);
    expect(uscita.length).toBeGreaterThan(4);
    expect(rientro.length).toBeGreaterThan(4);
    // Uscendo l'IVA arriva in fattura, rientrando sparisce: se le due liste
    // fossero la stessa, una delle due direzioni mentirebbe.
    expect(uscita[0].titolo).toContain("riporta l'IVA");
    expect(rientro[0].titolo).toContain("senza IVA");
  });

  it("le aliquote citate sono quelle dell'anno, non scritte a mano", () => {
    // Un anno inventato con aliquote diverse: se una cifra fosse fissa nel
    // testo, resterebbe quella del 2026 e nessuno se ne accorgerebbe.
    const finto: ParametriAnno = {
      ...par,
      aliquotaIvaOrdinaria: 0.1,
      aliquotaRitenuta: 0.33,
      importoBollo: 3,
      sogliaBollo: 100,
    };
    const testo = cambiamentiDiRegime("forfettario", "ordinario", imp, finto)
      .map((c) => `${c.titolo} ${c.dettaglio ?? ""}`)
      .join(" ")
      // I formatter separano cifra e simbolo con uno spazio unificatore: qui
      // si confrontano frasi, non si vuole inseguire il carattere invisibile.
      .replace(/\u00a0/g, " ");
    expect(testo).toContain("10 %");
    expect(testo).toContain("33 %");
    expect(testo).toContain("3,00 €");
    expect(testo).toContain("100,00 €");
    expect(testo).not.toContain("22 %");
    expect(testo).not.toContain("20 %");
    // e la sostitutiva resta quella impostata, che il finto anno non tocca
    expect(testo).toContain("15 %");
  });

  it("la proposta di chiusura pesca dallo stesso elenco", () => {
    // Sopra il limite: la proposta è l'uscita dal forfettario, e le sue
    // conseguenze sono i titoli dell'elenco condiviso. Due liste divergenti
    // erano il difetto da cui nasce questo modulo.
    const sopra: Impostazioni = { ...imp };
    const prospetto = calcolaProspetto({
      impostazioni: sopra,
      parametri: par,
      fatture: [
        {
          id: "grande",
          numero: "2026/999",
          dataEmissione: "2026-03-01",
          dataIncasso: "2026-03-01",
          clienteId: "c1",
          descrizione: "oltre il limite",
          tipoRicavo: "progetto",
          imponibile: par.limiteForfettario + 1_000,
        },
      ],
      costi: [],
      oggi: OGGI_FIXTURE,
    });
    const proposta = proponiRegime(prospetto, sopra, par);
    expect(proposta.regimeProposto).toBe("ordinario");
    const titoli = cambiamentiDiRegime("forfettario", "ordinario", sopra, par).map(
      (c) => c.titolo,
    );
    for (const titolo of titoli) expect(proposta.conseguenze).toContain(titolo);
  });

  it("in ordinario l'elenco del rientro parla del coefficiente impostato", () => {
    const ord = impostazioniOrdinario();
    const testo = cambiamentiDiRegime("ordinario", "forfettario", ord, par)
      .map((c) => c.titolo)
      .join(" ");
    expect(testo).toContain("coefficiente");
  });
});
