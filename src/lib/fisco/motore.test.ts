import { describe, expect, it } from "vitest";
import { round0, round2, somma } from "./aritmetica";
import { percentuale } from "@/lib/format";
import { calcolaCosto, calcolaFattura, costoGrezzo, fatturaGrezza } from "./documenti";
import {
  COSTI_FIXTURE,
  FATTURE_FIXTURE,
  OGGI_FIXTURE,
  impostazioniForfettario,
  impostazioniOrdinario,
} from "./fixture";
import { calcolaAcconti, calcolaProspetto, contributiPrevidenziali, irpefScaglioni } from "./motore";
import { PARAMETRI_2026 } from "./parametri/2026";
import type { Fattura, Impostazioni } from "./tipi";

const par = PARAMETRI_2026;

function prospettoCon(imp: Impostazioni, extra: Partial<Parameters<typeof calcolaProspetto>[0]> = {}) {
  return calcolaProspetto({
    impostazioni: imp,
    parametri: par,
    fatture: FATTURE_FIXTURE,
    costi: COSTI_FIXTURE,
    oggi: OGGI_FIXTURE,
    ...extra,
  });
}

describe("aritmetica", () => {
  it("arrotonda come il foglio di calcolo, non come Math.round", () => {
    // Math.round(4324.9 * 0.15 * 100) / 100 darebbe 648.73: un centesimo di meno.
    expect(round2(4324.9 * 0.15)).toBe(648.74);
    expect(round2(5850 * 0.2607)).toBe(1525.1);
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.675)).toBe(2.68);
  });

  it("arrotonda allontanandosi da zero anche sui negativi", () => {
    expect(round2(-4324.9 * 0.15)).toBe(-648.74);
    expect(round0(-2.5)).toBe(-3);
    expect(round0(2.5)).toBe(3);
  });

  it("non propaga NaN né Infinity", () => {
    expect(round2(Number.NaN)).toBe(0);
    expect(round2(Number.POSITIVE_INFINITY)).toBe(0);
    expect(somma(1.1, Number.NaN, 2.2)).toBe(3.3);
  });
});

describe("IRPEF a scaglioni", () => {
  it("applica le aliquote progressive", () => {
    expect(irpefScaglioni(0, par.scaglioniIrpef)).toBe(0);
    expect(irpefScaglioni(20_000, par.scaglioniIrpef)).toBe(4600);
    expect(irpefScaglioni(28_000, par.scaglioniIrpef)).toBe(6440);
    // 28.000 × 23% + 22.000 × 33%
    expect(irpefScaglioni(50_000, par.scaglioniIrpef)).toBe(13_700);
    // + 10.000 × 43%
    expect(irpefScaglioni(60_000, par.scaglioniIrpef)).toBe(18_000);
  });

  it("non produce imposta su reddito negativo", () => {
    expect(irpefScaglioni(-5000, par.scaglioniIrpef)).toBe(0);
  });
});

// ————————————————————————————————————————————————————————————
// I due casi verificati a mano sull'Excel. Se falliscono, è sbagliato il motore.
// ————————————————————————————————————————————————————————————

describe("fixture obbligatorio · forfettario", () => {
  const p = prospettoCon(impostazioniForfettario());

  it("riproduce la catena al centesimo", () => {
    expect(p.ricaviRilevanti).toBe(7500);
    expect(p.redditoLordo).toBe(5850);
    expect(p.totaleContributi).toBe(1525.1);
    expect(p.imponibile).toBe(4324.9);
    expect(p.impostaSostitutiva).toBe(648.74);
    expect(p.totaleImposte).toBe(648.74);
    expect(p.caricoTotale).toBe(2173.84);
    // Sulla pressione controllo la cifra che l'utente legge, non un'approssimazione.
    expect(percentuale(p.pressione)).toBe("28,98 %");
  });

  it("senza IVA in fattura l'incassato lordo coincide con i ricavi rilevanti", () => {
    expect(p.ivaIncassata).toBe(0);
    expect(p.incassatoLordo).toBe(7500);
  });

  it("non deduce i costi e conta l'IVA sugli acquisti per intero", () => {
    expect(p.costiDeducibiliPagati).toBe(0);
    expect(p.ivaDetraibilePagata).toBe(0);
    expect(p.costiNettiACarico).toBe(1019.6);
    expect(p.nettoDisponibile).toBe(4306.56);
  });

  it("azzera l'IVA in fattura e applica il bollo", () => {
    const f = p.fattureCalcolate[0];
    expect(f.aliquotaIvaApplicata).toBe(0);
    expect(f.iva).toBe(0);
    expect(f.bollo).toBe(2);
    expect(f.totale).toBe(3002);
    // Addebitato al cliente: non è un costo.
    expect(p.bolloACarico).toBe(0);
  });

  it("segnala che l'anno contributivo non si accredita per intero", () => {
    expect(p.accreditoIntero).toBe(false);
  });
});

describe("fixture obbligatorio · ordinario", () => {
  const p = prospettoCon(impostazioniOrdinario());

  it("riproduce la catena al centesimo", () => {
    expect(p.ricaviRilevanti).toBe(7500);
    expect(p.costiDeducibiliPagati).toBe(980);
    expect(p.redditoLordo).toBe(6520);
    expect(p.totaleContributi).toBe(1699.76);
    expect(p.imponibile).toBe(4820.24);
    expect(p.totaleImposte).toBe(1230.61);
    // Carico e netto sono due cifre diverse: 2.930,37 esce di tasca, 3.589,63 resta.
    expect(p.caricoTotale).toBe(2930.37);
    expect(p.nettoDisponibile).toBe(3589.63);
    expect(percentuale(p.pressione)).toBe("39,07 %");
  });

  it("scompone le imposte come il prospetto", () => {
    expect(p.irpefLorda).toBe(1108.66);
    expect(p.irpefNetta).toBe(1108.66);
    expect(p.addizionaleRegionale).toBe(83.39);
    expect(p.addizionaleComunale).toBe(38.56);
    expect(p.impostaSostitutiva).toBe(0);
  });

  it("recupera l'IVA sugli acquisti", () => {
    expect(p.ivaDetraibilePagata).toBe(39.6);
    expect(p.costiPagatiTotale).toBe(1019.6);
    expect(p.costiNettiACarico).toBe(980);
  });

  it("distingue il denaro entrato in cassa dai ricavi rilevanti", () => {
    // 7.500 € di compensi più 1.650 € di IVA incassata dai clienti:
    // in banca sono entrati 9.150 €, ma 1.650 € non sono mai stati tuoi.
    expect(p.ivaIncassata).toBe(1650);
    expect(p.incassatoLordo).toBe(9150);
    expect(p.ricaviRilevanti).toBe(7500);
  });

  it("applica l'IVA in fattura e niente bollo", () => {
    const f = p.fattureCalcolate[0];
    expect(f.aliquotaIvaApplicata).toBe(0.22);
    expect(f.iva).toBe(660);
    expect(f.bollo).toBe(0);
    expect(f.totale).toBe(3660);
  });
});

// ————————————————————————————————————————————————————————————
// Casi limite
// ————————————————————————————————————————————————————————————

describe("casi limite", () => {
  it("reddito zero non produce imposte, contributi né divisioni per zero", () => {
    const p = calcolaProspetto({
      impostazioni: impostazioniForfettario(),
      parametri: par,
      fatture: [],
      costi: [],
      oggi: OGGI_FIXTURE,
    });
    expect(p.ricaviRilevanti).toBe(0);
    expect(p.redditoLordo).toBe(0);
    expect(p.totaleContributi).toBe(0);
    expect(p.totaleImposte).toBe(0);
    expect(p.pressione).toBe(0);
    expect(p.nettoDisponibile).toBe(0);
    expect(Number.isNaN(p.pressione)).toBe(false);
    expect(p.acconti.dovuti).toBe(false);
  });

  it("i contributi si fermano al massimale della Gestione Separata", () => {
    const imp = impostazioniForfettario();
    const soprailMassimale = imp.massimaleGs + 50_000;
    const c = contributiPrevidenziali(soprailMassimale, imp);
    expect(c.separata).toBe(round2(imp.massimaleGs * imp.aliquotaGestioneSeparata));
    expect(c.separata).toBe(31_882.31);
    // Un euro sopra il massimale non cambia il contributo.
    expect(contributiPrevidenziali(imp.massimaleGs + 1, imp).separata).toBe(c.separata);
  });

  it("artigiani e commercianti pagano i fissi più l'eccedenza sul minimale", () => {
    const imp = { ...impostazioniForfettario(), gestione: "artigiani" as const };
    // Sotto il minimale si versano solo i contributi fissi.
    expect(contributiPrevidenziali(10_000, imp).artigiani).toBe(4600);
    expect(contributiPrevidenziali(28_555, imp).artigiani).toBe(
      round2(4600 + 10_000 * imp.aliquotaEccedenza),
    );
  });

  it("il superamento degli 85.000 € tiene dentro l'anno e fa uscire dal successivo", () => {
    const p = prospettoConRicavo(90_000);
    expect(p.soglia.stato).toBe("limiteSuperato");
    expect(p.soglia.messaggio).toContain("1° gennaio successivo");
  });

  it("oltre i 100.000 € l'uscita è immediata", () => {
    const p = prospettoConRicavo(110_000);
    expect(p.soglia.stato).toBe("uscitaImmediata");
    expect(p.soglia.messaggio).toContain("stesso anno");
  });

  it("oltre l'85% del limite scatta l'avviso, non l'allarme", () => {
    const p = prospettoConRicavo(75_000);
    expect(p.soglia.stato).toBe("avviso");
    expect(p.soglia.utilizzoLimite).toBeCloseTo(75_000 / 85_000, 6);
  });

  it("la soglia guarda gli incassi, e tiene a fianco l'emesso non ancora incassato", () => {
    const p = prospettoCon(impostazioniForfettario());
    expect(p.soglia.baseCassa).toBe(7500);
    expect(p.soglia.baseCompetenza).toBe(10_000);
    expect(p.soglia.inSospeso).toBe(2500);
    expect(p.soglia.stato).toBe("neiLimiti");
  });

  it("ritenute superiori alle imposte producono un credito, non un saldo negativo", () => {
    const imp: Impostazioni = {
      ...impostazioniOrdinario(),
      ritenutaAttiva: true,
      detrazioniPersonali: 1200,
    };
    const p = prospettoCon(imp);
    expect(p.ritenuteSubite).toBe(1500); // 20% su 7.500 € incassati
    expect(p.totaleImposte).toBeLessThan(p.ritenuteSubite);
    expect(p.imposteNetteASaldo).toBe(0);
    expect(p.creditoImposta).toBe(round2(p.ritenuteSubite - p.totaleImposte));
    expect(p.creditoImposta).toBeGreaterThan(0);
  });

  it("in forfettario la ritenuta non si applica mai", () => {
    const p = prospettoCon({ ...impostazioniForfettario(), ritenutaAttiva: true });
    expect(p.ritenuteSubite).toBe(0);
    expect(p.fattureCalcolate.every((f) => f.ritenuta === 0)).toBe(true);
  });

  it("la rivalsa INPS concorre a formare il reddito in entrambi i regimi", () => {
    const p = prospettoCon({ ...impostazioniForfettario(), rivalsaAttiva: true });
    expect(p.rivalsaIncassata).toBe(300); // 4% su 7.500 €
    expect(p.ricaviRilevanti).toBe(7800);
    expect(p.redditoLordo).toBe(round2(7800 * 0.78));
  });

  it("il contributo integrativo della cassa non concorre al reddito", () => {
    const imp: Impostazioni = {
      ...impostazioniOrdinario(),
      gestione: "cassa",
      rivalsaAttiva: true,
    };
    const p = prospettoCon(imp);
    const f = p.fattureCalcolate[0];
    expect(f.integrativaCassa).toBe(120); // 4% su 3.000 €
    expect(f.rivalsa).toBe(0);
    expect(f.ricavoRilevante).toBe(3000);
    expect(p.ricaviRilevanti).toBe(7500);
    expect(p.contributiCassa).toBe(round2(p.redditoLordo * imp.aliquotaSoggettivaCassa));
  });

  it("il bollo non addebitato diventa un costo a carico", () => {
    const p = prospettoCon({ ...impostazioniForfettario(), bolloAddebitato: false });
    expect(p.bolloACarico).toBe(6); // tre fatture emesse nell'anno
    expect(p.costiNettiACarico).toBe(round2(1019.6 + 6));
  });

  it("sotto la soglia di 77,47 € il bollo non è dovuto", () => {
    const piccola: Fattura = {
      id: "fx",
      dataEmissione: "2026-04-01",
      numero: "2026/004",
      clienteId: "alfa",
      descrizione: "Micro consulenza",
      tipoRicavo: "unaTantum",
      imponibile: 70,
      dataIncasso: "2026-04-10",
    };
    const f = calcolaFattura(piccola, impostazioniForfettario(), OGGI_FIXTURE);
    expect(f.bollo).toBe(0);
  });

  it("i contributi versati con F24 prevalgono sulla competenza", () => {
    const senza = prospettoCon(impostazioniForfettario());
    expect(senza.fonteContributiDedotti).toBe("competenza");
    expect(senza.contributiDedotti).toBe(1525.1);

    const con = prospettoCon(impostazioniForfettario(), {
      versamenti: [{ id: "v1", data: "2026-06-30", tipo: "contributi", importo: 1200 }],
    });
    expect(con.fonteContributiDedotti).toBe("versamenti");
    expect(con.contributiDedotti).toBe(1200);
    expect(con.imponibile).toBe(round2(5850 - 1200));
  });

  it("stati e ritardi delle fatture rispettano la data di riferimento", () => {
    const p = prospettoCon(impostazioniForfettario());
    const [prima, seconda, terza] = p.fattureCalcolate;
    expect(prima.stato).toBe("incassato");
    expect(prima.giorniIncasso).toBe(26);
    expect(prima.giorniRitardo).toBe(0);
    expect(seconda.giorniIncasso).toBe(30);
    expect(terza.stato).toBe("scaduto");
    expect(terza.scadenza).toBe("2026-04-19");
    expect(terza.giorniRitardo).toBe(135);
    expect(terza.giorniIncasso).toBeNull();
  });
});

describe("acconti", () => {
  it("sotto 51,65 € non si versa nulla", () => {
    expect(calcolaAcconti(40, par).dovuti).toBe(false);
  });

  it("fra 51,65 e 257,52 € l'acconto è unico a novembre", () => {
    const a = calcolaAcconti(200, par);
    expect(a.accontoUnico).toBe(true);
    expect(a.primo).toBe(0);
    expect(a.secondo).toBe(200);
  });

  it("sopra 257,52 € si divide in 40% e 60%", () => {
    const a = calcolaAcconti(2173.84, par);
    expect(a.accontoUnico).toBe(false);
    expect(a.primo).toBe(869.54);
    expect(a.secondo).toBe(1304.3);
  });
});

// Helper: un anno con un solo incasso del valore indicato.
function prospettoConRicavo(importo: number) {
  return calcolaProspetto({
    impostazioni: impostazioniForfettario(),
    parametri: par,
    fatture: [
      {
        id: "unica",
        dataEmissione: "2026-01-10",
        numero: "2026/001",
        clienteId: "alfa",
        descrizione: "Incarico annuale",
        tipoRicavo: "progetto",
        imponibile: importo,
        dataIncasso: "2026-02-10",
      },
    ],
    costi: [],
    oggi: OGGI_FIXTURE,
  });
}

describe("ritorno alla forma grezza", () => {
  const p = prospettoCon(impostazioniOrdinario());

  it("una fattura calcolata torna grezza senza portarsi dietro i derivati", () => {
    const calcolata = p.fattureCalcolate[0];
    const grezza = fatturaGrezza(calcolata);
    const vietati = [
      "iva", "rivalsa", "integrativaCassa", "bollo", "bolloACarico", "ritenuta",
      "totale", "nettoIncasso", "ricavoRilevante", "scadenza", "stato",
      "giorniIncasso", "giorniRitardo", "aliquotaIvaApplicata",
    ];
    for (const campo of vietati) expect(grezza).not.toHaveProperty(campo);
    expect(grezza).toEqual(FATTURE_FIXTURE[0]);
  });

  it("un costo calcolato torna grezzo e ricalcolato dà lo stesso risultato", () => {
    const calcolato = p.costiCalcolati[1];
    const grezzo = costoGrezzo(calcolato);
    for (const campo of ["iva", "totale", "costoDeducibile", "ivaDetraibile", "costoNetto", "stato"]) {
      expect(grezzo).not.toHaveProperty(campo);
    }
    expect(calcolaCosto(grezzo, impostazioniOrdinario())).toEqual(calcolato);
  });
})
