import { describe, expect, it } from "vitest";
import { catenaAnni, type ArchivioPerAnni } from "@/lib/analisi/anno";
import {
  calcolaRiporto,
  esportazioneProspettoConsentita,
  istantaneaDa,
  proponiRegime,
  riportoVuoto,
  scostamentiDaChiusura,
  type ChiusuraAnno,
} from "./chiusura";
import { anniCoinvolti, dateCosto, dateFattura, ripartisci } from "./competenza";
import { calcolaAcconti, calcolaProspetto, risolutoreImpostazioni } from "./motore";
import {
  COSTI_CHIUSURA,
  FATTURE_CHIUSURA,
  OGGI_CHIUSURA,
  impostazioniChiusura2026,
  impostazioniChiusura2027,
  impostazioniForfettario,
  impostazioniOrdinario,
} from "./fixture";
import { PARAMETRI_2026 } from "./parametri/2026";
import { PARAMETRI_2027 } from "./parametri/2027";
import { prospettoDettagliato } from "./spiegazioni";
import { euro } from "@/lib/format";
import type { Costo, Fattura, Impostazioni } from "./tipi";

function archivioChiusura(chiusure: ChiusuraAnno[] = []): ArchivioPerAnni {
  return {
    impostazioni: [impostazioniChiusura2026(), impostazioniChiusura2027()],
    fatture: FATTURE_CHIUSURA,
    costi: COSTI_CHIUSURA,
    versamenti: [],
    movimentiAttivita: [],
    movimentiPersonali: [],
    chiusure,
  };
}

function catena(chiusure: ChiusuraAnno[] = []) {
  const anni = catenaAnni(archivioChiusura(chiusure), 2027, OGGI_CHIUSURA);
  const a2026 = anni.get(2026);
  const a2027 = anni.get(2027);
  if (!a2026 || !a2027) throw new Error("la catena deve contenere 2026 e 2027");
  return { a2026, a2027 };
}

// ————————————————————————————————————————————————————————————
// Il fixture obbligatorio del passaggio d'anno
// ————————————————————————————————————————————————————————————

describe("fixture obbligatorio · chiusura d'anno", () => {
  const { a2026, a2027 } = catena();

  it("riproduce i riporti al centesimo", () => {
    // 10.000 di apertura + 48.800 incassati − 2.440 − 9.760 pagati
    expect(a2026.cashflow.saldoFinale).toBe(46_600);
    // 48.800 × 30 %
    expect(a2026.cashflow.accantonatoTotale).toBe(14_640);
    expect(a2026.cashflow.liquiditaNettaFinale).toBe(31_960);

    const r = a2026.riportoInUscita;
    expect(r.daAnno).toBe(2026);
    expect(r.aAnno).toBe(2027);
    expect(r.saldoCassa).toBe(46_600);
    expect(r.accantonato).toBe(14_640);
    // 440 di IVA sul costo di aprile + 220 su quello di dicembre
    expect(r.creditoIva).toBe(660);
    expect(r.creditoIvaInLiquidazione).toBe(660);
    // cf2 (incassata a gennaio) e cf3 (mai incassata): il ricavo di entrambe
    // cade fuori dal 2026, ma solo cf3 è ancora da sollecitare a marzo.
    expect(r.fattureDaIncassare).toEqual({ numero: 2, importo: 9_760, numeroAncoraAperti: 1 });
    expect(r.costiDaPagare).toEqual({ numero: 1, importo: 1_220, numeroAncoraAperti: 0 });
  });

  it("al 1° gennaio la liquidità netta è quella del 31 dicembre, non una lira di più", () => {
    // È il riporto che, se si perde, non produce un errore ma un numero
    // plausibile: il conto è lo stesso di ieri, ma 14.640 € servono a giugno.
    expect(a2027.cashflow.saldoIniziale).toBe(46_600);
    expect(a2027.cashflow.accantonatoIniziale).toBe(14_640);
    expect(a2027.cashflow.liquiditaNettaIniziale).toBe(31_960);
    expect(a2027.cashflow.liquiditaNettaIniziale).toBe(a2026.cashflow.liquiditaNettaFinale);
  });

  it("senza il riporto dell'accantonato mostrerebbe 14.640 € che non sono spendibili", () => {
    // La prova in negativo: è il bug che il test sopra esiste per fermare.
    const senzaRiporto = {
      ...a2027.cashflow,
      accantonatoIniziale: 0,
      liquiditaNettaIniziale: a2027.cashflow.saldoIniziale,
    };
    expect(senzaRiporto.liquiditaNettaIniziale - a2027.cashflow.liquiditaNettaIniziale).toBe(
      14_640,
    );
    expect(euro(senzaRiporto.liquiditaNettaIniziale)).toBe(euro(46_600));
  });

  it("attribuisce la fattura a cavallo: IVA al 2026, ricavo al 2027", () => {
    // cf2: emessa il 20 dicembre 2026, incassata il 15 gennaio 2027.
    expect(a2026.prospetto.ricaviRilevanti).toBe(40_000);
    expect(a2026.prospetto.aCavallo.ricaviVersoAnniSuccessivi).toBe(5_000);
    expect(a2026.prospetto.aCavallo.ivaSuIncassiFuturi).toBe(1_760); // 1.100 di cf2 + 660 di cf3

    expect(a2027.prospetto.ricaviRilevanti).toBe(5_000);
    expect(a2027.prospetto.aCavallo.ricaviDaAnniPrecedenti).toBe(5_000);
    // L'IVA di quella fattura è stata liquidata nel 2026: nel 2027 non ricompare.
    expect(a2027.iva.totaleDebito).toBe(0);
  });

  it("attribuisce il costo a cavallo con la stessa regola, dall'altro lato", () => {
    // cc2: documento del 15 dicembre 2026, pagato il 20 gennaio 2027.
    expect(a2026.prospetto.costiDeducibiliPagati).toBe(10_000); // cc1 2.000 + cc3 8.000
    expect(a2026.prospetto.aCavallo.costiVersoAnniSuccessivi).toBe(1_000);
    expect(a2026.prospetto.aCavallo.ivaDetraibileSuPagamentiFuturi).toBe(220);

    expect(a2027.prospetto.costiDeducibiliPagati).toBe(1_000);
    expect(a2027.prospetto.aCavallo.costiDaAnniPrecedenti).toBe(1_000);
    expect(a2027.iva.totaleCredito).toBe(0);
  });

  it("riporta il credito IVA nella liquidazione dell'anno nuovo", () => {
    expect(a2026.iva.creditoFinale).toBe(660);
    expect(a2027.iva.creditoIniziale).toBe(660);
    // Nel 2027 non ci sono documenti: il credito resta intatto e passa oltre.
    expect(a2027.iva.creditoFinale).toBe(660);
  });

  it("il credito IVA scelto a rimborso non entra nella liquidazione", () => {
    const chiusura = chiusuraDi(2026, "rimborso");
    const { a2026: chiuso, a2027: dopo } = catena([chiusura]);
    expect(chiuso.riportoInUscita.creditoIva).toBe(660);
    expect(chiuso.riportoInUscita.creditoIvaInLiquidazione).toBe(0);
    expect(dopo.iva.creditoIniziale).toBe(0);
  });

  it("il 2026 chiude in ordinario e resta ordinario: nessun cambio di regime", () => {
    expect(a2026.prospetto.ricaviRilevanti).toBeLessThan(PARAMETRI_2026.limiteForfettario);
    expect(a2026.regime.regimeProposto).toBe("ordinario");
    expect(a2026.regime.daProporre).toBe(false);
  });
});

function chiusuraDi(
  anno: number,
  destinazione: "compensazione" | "rimborso" = "compensazione",
): ChiusuraAnno {
  const anni = catenaAnni(archivioChiusura(), anno, OGGI_CHIUSURA);
  const calcolato = anni.get(anno);
  if (!calcolato) throw new Error(`anno ${anno} non calcolato`);
  return {
    anno,
    chiusaIl: "2027-01-31T10:00:00.000Z",
    destinazioneCreditoIva: destinazione,
    regimeAnnoSuccessivo: calcolato.regime.regimeProposto,
    note: "",
    istantanea: istantaneaDa(calcolato.riportoInUscita, calcolato.prospetto),
  };
}

// ————————————————————————————————————————————————————————————
// Attribuzione: una funzione sola, due lati
// ————————————————————————————————————————————————————————————

describe("attribuzione a due criteri", () => {
  it("divide fatture e costi con la stessa funzione", () => {
    const rf = ripartisci(FATTURE_CHIUSURA, 2026, dateFattura);
    const rc = ripartisci(COSTI_CHIUSURA, 2026, dateCosto);

    expect(rf.perCompetenza.map((f) => f.id)).toEqual(["cf1", "cf2", "cf3"]);
    expect(rf.perCassa.map((f) => f.id)).toEqual(["cf1"]);
    expect(rf.versoAnniSuccessivi.map((f) => f.id)).toEqual(["cf2"]);
    expect(rf.sospesi.map((f) => f.id)).toEqual(["cf3"]);

    expect(rc.perCompetenza.map((c) => c.id)).toEqual(["cc1", "cc2", "cc3"]);
    expect(rc.perCassa.map((c) => c.id)).toEqual(["cc1", "cc3"]);
    expect(rc.versoAnniSuccessivi.map((c) => c.id)).toEqual(["cc2"]);
    expect(rc.sospesi).toEqual([]);
  });

  it("dall'anno successivo gli stessi documenti arrivano da anni precedenti", () => {
    const rf = ripartisci(FATTURE_CHIUSURA, 2027, dateFattura);
    const rc = ripartisci(COSTI_CHIUSURA, 2027, dateCosto);
    expect(rf.daAnniPrecedenti.map((f) => f.id)).toEqual(["cf2"]);
    expect(rf.perCompetenza).toEqual([]);
    expect(rc.daAnniPrecedenti.map((c) => c.id)).toEqual(["cc2"]);
    expect(rc.perCompetenza).toEqual([]);
  });

  it("un documento incassato in anticipo rispetto alla data non si perde", () => {
    const anticipata: Fattura[] = [
      {
        id: "x",
        dataEmissione: "2027-01-05",
        numero: "1",
        clienteId: "c",
        descrizione: "acconto incassato prima della fattura",
        tipoRicavo: "progetto",
        imponibile: 1_000,
        dataIncasso: "2026-12-28",
      },
    ];
    expect(ripartisci(anticipata, 2027, dateFattura).cassaAnticipata.map((f) => f.id)).toEqual([
      "x",
    ]);
    expect(ripartisci(anticipata, 2026, dateFattura).perCassa.map((f) => f.id)).toEqual(["x"]);
  });

  it("elenca gli anni toccati dai documenti", () => {
    expect(anniCoinvolti(FATTURE_CHIUSURA.map(dateFattura))).toEqual([2026, 2027]);
    expect(anniCoinvolti(COSTI_CHIUSURA.map(dateCosto))).toEqual([2026, 2027]);
  });
});

// ————————————————————————————————————————————————————————————
// Ogni documento con le regole del suo anno
// ————————————————————————————————————————————————————————————

describe("impostazioni dell'anno del documento", () => {
  const forfettario2026: Impostazioni = { ...impostazioniForfettario(), anno: 2026 };
  const ordinario2027: Impostazioni = { ...impostazioniOrdinario(), anno: 2027 };

  const fatturaDel2026: Fattura[] = [
    {
      id: "vecchia",
      dataEmissione: "2026-12-20",
      numero: "2026/010",
      clienteId: "alfa",
      descrizione: "Emessa da forfettario",
      tipoRicavo: "progetto",
      imponibile: 1_000,
      dataIncasso: "2027-02-10",
    },
  ];

  it("una fattura emessa in forfettario non prende l'IVA perché nel frattempo sei passato a ordinario", () => {
    const p = calcolaProspetto({
      impostazioni: ordinario2027,
      parametri: PARAMETRI_2027,
      fatture: fatturaDel2026,
      costi: [],
      impostazioniPerAnno: [forfettario2026, ordinario2027],
      oggi: "2027-03-01",
    });
    const f = p.fattureCalcolate[0];
    expect(f.aliquotaIvaApplicata).toBe(0);
    expect(f.iva).toBe(0);
    expect(f.bollo).toBe(2);
    // Il ricavo però è del 2027: la cassa comanda sulle imposte.
    expect(p.ricaviRilevanti).toBe(1_000);
  });

  it("senza l'elenco per anno userebbe le regole dell'anno in esame", () => {
    const p = calcolaProspetto({
      impostazioni: ordinario2027,
      parametri: PARAMETRI_2027,
      fatture: fatturaDel2026,
      costi: [],
      oggi: "2027-03-01",
    });
    // È il comportamento vecchio, corretto solo finché di anni ce n'è uno.
    expect(p.fattureCalcolate[0].iva).toBe(220);
  });

  it("per un anno non censito prende l'anno precedente più vicino, mai uno futuro", () => {
    const risolvi = risolutoreImpostazioni(ordinario2027, [forfettario2026, ordinario2027]);
    expect(risolvi(2026).regime).toBe("forfettario");
    expect(risolvi(2027).regime).toBe("ordinario");
    expect(risolvi(2028).regime).toBe("ordinario");
    // Prima del primo anno censito non c'è un precedente: si usa il più antico.
    expect(risolvi(2020).regime).toBe("forfettario");
  });
});

// ————————————————————————————————————————————————————————————
// Il prospetto dichiara i documenti a cavallo
// ————————————————————————————————————————————————————————————

describe("prospetto dei documenti a cavallo d'anno", () => {
  const { a2026, a2027 } = catena();

  function righeDi(anno: (typeof a2026)) {
    return prospettoDettagliato(anno.prospetto, anno.impostazioni, anno.parametri)
      .flatMap((s) => s.righe)
      .reduce<Record<string, { valore: number | string; formula?: string }>>((acc, r) => {
        acc[r.id] = { valore: r.valore, formula: r.formula };
        return acc;
      }, {});
  }

  it("nel 2027 dice quanto arriva da fatture e costi dell'anno prima", () => {
    const righe = righeDi(a2027);
    expect(righe["ricavi-da-anni-precedenti"].valore).toBe(5_000);
    expect(righe["ricavi-da-anni-precedenti"].formula).toContain("IVA è già stata liquidata");
    expect(righe["costi-da-anni-precedenti"].valore).toBe(1_000);
    expect(righe["costi-da-anni-precedenti"].formula).toContain("già detraibile");
  });

  it("nel 2026 dice cosa esce dal prospetto pur avendo generato IVA", () => {
    const righe = righeDi(a2026);
    expect(righe["ricavi-verso-anni-successivi"].valore).toBe(5_000);
    expect(righe["ricavi-verso-anni-successivi"].formula).toContain(euro(1_760));
    expect(righe["costi-verso-anni-successivi"].valore).toBe(1_000);
    expect(righe["costi-verso-anni-successivi"].formula).toContain(euro(220));
  });

  it("senza documenti a cavallo quelle righe non compaiono", () => {
    const anni = catenaAnni(
      { ...archivioChiusura(), fatture: [], costi: [] },
      2026,
      OGGI_CHIUSURA,
    );
    const righe = righeDi(anni.get(2026)!);
    expect(righe["ricavi-da-anni-precedenti"]).toBeUndefined();
    expect(righe["costi-verso-anni-successivi"]).toBeUndefined();
  });
});

// ————————————————————————————————————————————————————————————
// Cambio di regime
// ————————————————————————————————————————————————————————————

describe("cambio di regime alla chiusura", () => {
  function prospettoForfettarioCon(imponibile: number) {
    const imp = impostazioniForfettario();
    const fatture: Fattura[] = [
      {
        id: "unica",
        dataEmissione: "2026-06-01",
        numero: "2026/001",
        clienteId: "alfa",
        descrizione: "Progetto",
        tipoRicavo: "progetto",
        imponibile,
        dataIncasso: "2026-06-30",
      },
    ];
    return {
      imp,
      p: calcolaProspetto({
        impostazioni: imp,
        parametri: PARAMETRI_2026,
        fatture,
        costi: [],
        oggi: "2026-12-31",
      }),
    };
  }

  it("sotto il limite non propone nulla", () => {
    const { imp, p } = prospettoForfettarioCon(60_000);
    const proposta = proponiRegime(p, imp, PARAMETRI_2026);
    expect(proposta.motivo).toBe("nessunCambio");
    expect(proposta.daProporre).toBe(false);
    expect(proposta.regimeProposto).toBe("forfettario");
  });

  it("oltre gli 85.000 € propone l'ordinario dal 1° gennaio successivo", () => {
    const { imp, p } = prospettoForfettarioCon(90_000);
    const proposta = proponiRegime(p, imp, PARAMETRI_2026);
    expect(proposta.motivo).toBe("limiteSuperato");
    expect(proposta.daProporre).toBe(true);
    expect(proposta.regimeProposto).toBe("ordinario");
    expect(proposta.decorrenza).toBe("2027-01-01");
    expect(proposta.conseguenze.length).toBeGreaterThan(0);
  });

  it("oltre i 100.000 € l'uscita è immediata e decorre dall'operazione che supera", () => {
    const imp = impostazioniForfettario();
    const fatture: Fattura[] = [
      {
        id: "a",
        dataEmissione: "2026-03-01",
        numero: "1",
        clienteId: "alfa",
        descrizione: "Prima",
        tipoRicavo: "progetto",
        imponibile: 70_000,
        dataIncasso: "2026-03-31",
      },
      {
        id: "b",
        dataEmissione: "2026-09-01",
        numero: "2",
        clienteId: "beta",
        descrizione: "Quella che supera",
        tipoRicavo: "progetto",
        imponibile: 40_000,
        dataIncasso: "2026-09-30",
      },
    ];
    const p = calcolaProspetto({
      impostazioni: imp,
      parametri: PARAMETRI_2026,
      fatture,
      costi: [],
      oggi: "2026-12-31",
    });
    const proposta = proponiRegime(p, imp, PARAMETRI_2026);
    expect(proposta.motivo).toBe("uscitaImmediata");
    expect(proposta.daProporre).toBe(true);
    // Non aspetta gennaio: colpisce l'anno in corso, dalla fattura che supera.
    expect(proposta.decorrenza).toBe("2026-09-30");
    expect(proposta.fatturaCheSupera?.id).toBe("b");
  });

  it("in ordinario sotto il limite segnala il rientro possibile senza proporlo", () => {
    const imp = impostazioniOrdinario();
    const p = calcolaProspetto({
      impostazioni: imp,
      parametri: PARAMETRI_2026,
      fatture: [],
      costi: [],
      oggi: "2026-12-31",
    });
    const proposta = proponiRegime(p, imp, PARAMETRI_2026);
    expect(proposta.motivo).toBe("rientroDaValutare");
    expect(proposta.daProporre).toBe(false);
    expect(proposta.spiegazione).toContain("commercialista");
  });
});

// ————————————————————————————————————————————————————————————
// Acconti e credito in ingresso
// ————————————————————————————————————————————————————————————

describe("acconti con credito dell'anno precedente", () => {
  it("senza credito il dovuto e il da versare coincidono", () => {
    const a = calcolaAcconti(1_000, PARAMETRI_2026);
    expect(a.primo).toBe(400);
    expect(a.secondo).toBe(600);
    expect(a.primoDaVersare).toBe(400);
    expect(a.secondoDaVersare).toBe(600);
    expect(a.creditoUtilizzato).toBe(0);
  });

  it("il credito copre prima l'acconto di giugno, poi quello di novembre", () => {
    const a = calcolaAcconti(1_000, PARAMETRI_2026, 500);
    // Quello che si dichiara non cambia: cambia quello che esce dal conto.
    expect(a.primo).toBe(400);
    expect(a.secondo).toBe(600);
    expect(a.primoDaVersare).toBe(0);
    expect(a.secondoDaVersare).toBe(500);
    expect(a.creditoUtilizzato).toBe(500);
    expect(a.creditoResiduo).toBe(0);
  });

  it("il credito che avanza resta disponibile per l'anno dopo", () => {
    const a = calcolaAcconti(1_000, PARAMETRI_2026, 1_500);
    expect(a.creditoUtilizzato).toBe(1_000);
    expect(a.creditoResiduo).toBe(500);
    expect(a.primoDaVersare).toBe(0);
    expect(a.secondoDaVersare).toBe(0);
  });

  it("il credito si scomputa prima dal saldo e solo dopo dagli acconti", () => {
    const p = calcolaProspetto({
      impostazioni: impostazioniChiusura2026(),
      parametri: PARAMETRI_2026,
      fatture: FATTURE_CHIUSURA,
      costi: COSTI_CHIUSURA,
      creditoAnnoPrecedente: 1_000,
      oggi: OGGI_CHIUSURA,
    });
    expect(p.creditoAnnoPrecedente).toBe(1_000);
    expect(p.creditoUtilizzatoSuSaldo).toBe(1_000);
    expect(p.acconti.creditoUtilizzato).toBe(0);
    const senzaCredito = calcolaProspetto({
      impostazioni: impostazioniChiusura2026(),
      parametri: PARAMETRI_2026,
      fatture: FATTURE_CHIUSURA,
      costi: COSTI_CHIUSURA,
      oggi: OGGI_CHIUSURA,
    });
    expect(senzaCredito.saldoResiduo - p.saldoResiduo).toBe(1_000);
  });
});

// ————————————————————————————————————————————————————————————
// Reversibilità
// ————————————————————————————————————————————————————————————

describe("la chiusura è annullabile", () => {
  it("chiudere non cambia un solo numero: cambia solo lo stato", () => {
    const aperto = catena().a2026;
    const chiuso = catena([chiusuraDi(2026)]).a2026;

    expect(aperto.chiuso).toBe(false);
    expect(chiuso.chiuso).toBe(true);
    // Gli importi non si congelano alla chiusura: si ricalcolano sempre.
    expect(chiuso.riportoInUscita.saldoCassa).toBe(aperto.riportoInUscita.saldoCassa);
    expect(chiuso.riportoInUscita.accantonato).toBe(aperto.riportoInUscita.accantonato);
    expect(chiuso.prospetto.totaleImposte).toBe(aperto.prospetto.totaleImposte);
  });

  it("riaprire riporta esattamente allo stato di prima", () => {
    const primaDiChiudere = catena().a2026;
    const dopoAverRiaperto = catena([]).a2026;
    expect(dopoAverRiaperto.chiuso).toBe(false);
    expect(dopoAverRiaperto.riportoInUscita).toEqual(primaDiChiudere.riportoInUscita);
    expect(dopoAverRiaperto.scostamenti).toEqual([]);
  });

  it("una fattura ritrovata a marzo si vede come scostamento dalla chiusura", () => {
    const chiusura = chiusuraDi(2026);
    const dimenticata: Fattura = {
      id: "ritrovata",
      dataEmissione: "2026-07-01",
      numero: "2026/004",
      clienteId: "delta",
      descrizione: "Fattura ritrovata a marzo",
      tipoRicavo: "progetto",
      imponibile: 2_000,
      aliquotaIva: 0.22,
      dataIncasso: "2026-07-31",
    };
    const archivio = archivioChiusura([chiusura]);
    const anni = catenaAnni(
      { ...archivio, fatture: [...archivio.fatture, dimenticata] },
      2026,
      OGGI_CHIUSURA,
    );
    const a2026 = anni.get(2026);
    if (!a2026) throw new Error("2026 non calcolato");

    const ricavi = a2026.scostamenti.find((s) => s.voce === "Ricavi rilevanti");
    expect(ricavi?.differenza).toBe(2_000);
    const cassa = a2026.scostamenti.find((s) => s.voce === "Saldo di cassa");
    expect(cassa?.differenza).toBe(2_440); // incasso lordo, IVA compresa
    // I riporti si sono mossi da soli: non serve ricordarsi di aggiornarli.
    expect(a2026.riportoInUscita.saldoCassa).toBe(46_600 + 2_440);
  });

  it("un anno chiuso senza modifiche non ha scostamenti", () => {
    expect(catena([chiusuraDi(2026)]).a2026.scostamenti).toEqual([]);
  });
});

// ————————————————————————————————————————————————————————————
// Parametri provvisori
// ————————————————————————————————————————————————————————————

describe("parametri provvisori", () => {
  it("il 2027 eredita i valori del 2026 e lo dichiara", () => {
    expect(PARAMETRI_2027.provvisorio).toBe(true);
    expect(PARAMETRI_2026.provvisorio).toBe(false);
    expect(PARAMETRI_2027.aliquotaSostitutiva).toBe(PARAMETRI_2026.aliquotaSostitutiva);
    expect(PARAMETRI_2027.limiteForfettario).toBe(PARAMETRI_2026.limiteForfettario);
    expect(PARAMETRI_2027.fonti.join(" ")).toContain("attesa della Legge di Bilancio 2027");
  });

  it("blocca l'export del prospetto finché il flag è attivo", () => {
    const bloccato = esportazioneProspettoConsentita(PARAMETRI_2027);
    expect(bloccato.consentita).toBe(false);
    if (bloccato.consentita) return;
    expect(bloccato.motivo).toContain("provvisori");

    expect(esportazioneProspettoConsentita(PARAMETRI_2026).consentita).toBe(true);
  });

  it("impedisce di chiudere un anno con parametri provvisori", () => {
    const { a2027 } = catena();
    const blocco = a2027.controlli.find((c) => c.id === "parametri-provvisori");
    expect(blocco?.gravita).toBe("blocco");
  });
});

// ————————————————————————————————————————————————————————————
// Casi limite dei riporti
// ————————————————————————————————————————————————————————————

describe("casi limite dei riporti", () => {
  it("il riporto vuoto non sposta niente", () => {
    const r = riportoVuoto(2025);
    expect(r.saldoCassa).toBe(0);
    expect(r.accantonato).toBe(0);
    expect(r.creditoIvaInLiquidazione).toBe(0);
    expect(r.aAnno).toBe(2026);
  });

  it("il primo anno della catena apre con il saldo scritto nelle impostazioni", () => {
    const { a2026 } = catena();
    expect(a2026.riportoInIngresso.saldoCassa).toBe(0);
    expect(a2026.cashflow.saldoIniziale).toBe(10_000);
  });

  it("la catena non salta gli anni intermedi", () => {
    const archivio = archivioChiusura();
    const anni = catenaAnni(archivio, 2030, OGGI_CHIUSURA);
    expect([...anni.keys()]).toEqual([2026, 2027, 2028, 2029, 2030]);
    // Il saldo attraversa gli anni vuoti senza perdersi.
    expect(anni.get(2030)?.cashflow.saldoIniziale).toBe(anni.get(2027)?.cashflow.saldoFinale);
  });

  it("un anno senza impostazioni proprie resta l'anno che è", () => {
    // Per il 2028 non ci sono né impostazioni né parametri dedicati: senza
    // forzare l'anno, il prospetto sarebbe quello del 2027 sotto altro nome.
    const anni = catenaAnni(archivioChiusura(), 2028, OGGI_CHIUSURA);
    const a2028 = anni.get(2028);
    expect(a2028?.impostazioni.anno).toBe(2028);
    expect(a2028?.prospetto.anno).toBe(2028);
    // Nel 2028 non è stato incassato nulla: i 5.000 sono del 2027.
    expect(a2028?.prospetto.ricaviRilevanti).toBe(0);
    expect(anni.get(2027)?.prospetto.ricaviRilevanti).toBe(5_000);
  });

  it("un anno senza documenti non azzera l'accantonato", () => {
    const anni = catenaAnni(archivioChiusura(), 2029, OGGI_CHIUSURA);
    const a2029 = anni.get(2029);
    expect(a2029?.cashflow.accantonatoIniziale).toBe(anni.get(2028)?.cashflow.accantonatoTotale);
  });

  it("un credito d'imposta non utilizzato passa all'anno dopo", () => {
    const versamenti = [
      { id: "v1", data: "2026-06-30", tipo: "imposte" as const, importo: 50_000 },
    ];
    const anni = catenaAnni({ ...archivioChiusura(), versamenti }, 2027, OGGI_CHIUSURA);
    const r2026 = anni.get(2026)?.riportoInUscita;
    expect(r2026 && r2026.creditoImposte > 0).toBe(true);
    expect(anni.get(2027)?.prospetto.creditoAnnoPrecedente).toBe(r2026?.creditoImposte);
  });

  it("il riporto non dipende dall'istantanea salvata", () => {
    const bugiarda: ChiusuraAnno = {
      ...chiusuraDi(2026),
      istantanea: {
        saldoCassa: 1,
        accantonato: 1,
        creditoIva: 1,
        creditoImposte: 1,
        ricaviRilevanti: 1,
        fattureDaIncassare: 1,
        costiDaPagare: 1,
      },
    };
    const { a2027 } = catena([bugiarda]);
    // L'istantanea è sbagliata di proposito: i riporti la ignorano.
    expect(a2027.cashflow.saldoIniziale).toBe(46_600);
    expect(a2027.cashflow.accantonatoIniziale).toBe(14_640);
  });

  it("calcolaRiporto non tocca i documenti che riceve", () => {
    const { a2026 } = catena();
    const copia: Costo[] = JSON.parse(JSON.stringify(COSTI_CHIUSURA));
    calcolaRiporto({
      anno: 2026,
      prospetto: a2026.prospetto,
      iva: a2026.iva,
      cashflow: a2026.cashflow,
    });
    expect(COSTI_CHIUSURA).toEqual(copia);
  });

  it("gli scostamenti elencano solo le voci davvero cambiate", () => {
    const chiusura = chiusuraDi(2026);
    const { a2026 } = catena();
    const alterata: ChiusuraAnno = {
      ...chiusura,
      istantanea: { ...chiusura.istantanea, creditoIva: 100 },
    };
    const s = scostamentiDaChiusura(alterata, a2026.riportoInUscita, a2026.prospetto);
    expect(s.map((x) => x.voce)).toEqual(["Credito IVA"]);
    expect(s[0].differenza).toBe(560);
  });
});
