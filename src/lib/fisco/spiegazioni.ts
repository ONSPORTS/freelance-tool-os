/**
 * Il prospetto fiscale riga per riga, con la spiegazione di come ogni numero
 * è stato ottenuto.
 *
 * La spiegazione non è una nota d'aiuto generica: è la formula applicata ai
 * numeri di questa persona, in italiano. «5.850,00 € × 26,07%, fino al
 * massimale di 122.295,00 €» dice tutto quello che serve per fidarsi del
 * totale o per accorgersi che un'impostazione è sbagliata.
 *
 * Vive qui, fuori dalla schermata, perché serve anche all'esportazione da
 * mandare al commercialista.
 */
import { euro, interoIt, percentuale } from "@/lib/format";
import type { Prospetto } from "./motore";
import type { Impostazioni, ParametriAnno } from "./tipi";

export type FormatoValore = "euro" | "percentuale" | "testo";

export type RigaProspetto = {
  id: string;
  etichetta: string;
  valore: number | string;
  formato: FormatoValore;
  /** Come si ottiene il numero, con i valori reali dentro. */
  formula?: string;
  /** Contesto che non è una formula: una regola, un'avvertenza. */
  nota?: string;
  /** Riga di totale: si stacca dalle altre. */
  totale?: boolean;
};

export type SezioneProspetto = {
  id: string;
  lettera: string;
  titolo: string;
  sottotitolo: string;
  righe: RigaProspetto[];
};

export function prospettoDettagliato(
  p: Prospetto,
  imp: Impostazioni,
  par: ParametriAnno,
): SezioneProspetto[] {
  const forfettario = imp.regime === "forfettario";
  const sezioni: SezioneProspetto[] = [];

  // — A · Base di calcolo ————————————————————————————
  const base: RigaProspetto[] = [
    {
      id: "compensi",
      etichetta: "Compensi incassati nell'anno",
      valore: p.compensiIncassati,
      formato: "euro",
      formula:
        p.note.stornoIncassato > 0
          ? `Fatture incassate nel ${p.anno}, meno ${euro(p.note.stornoIncassato)} di note di credito rimborsate nell'anno.`
          : `Somma degli imponibili delle fatture con data di incasso nel ${p.anno}. Conta quando il denaro è arrivato, non quando hai emesso la fattura.`,
    },
  ];
  // Voce a sé e non annegata nel totale: un fatturato che cala senza dire
  // perché è il modo più veloce di far perdere fiducia a un prospetto.
  if (p.note.stornoIncassato > 0) {
    base.push({
      id: "storno-note",
      etichetta: "di cui storni da note di credito",
      valore: -p.note.stornoIncassato,
      formato: "euro",
      formula: `${p.note.numero === 1 ? "Una nota di credito rimborsata" : "Note di credito rimborsate"} nel ${p.anno}: il denaro è tornato al cliente, quindi non è ricavo.`,
      nota:
        p.note.nonRiconciliato > 0
          ? `${euro(p.note.nonRiconciliato)} non sono riconciliati a nessuna fattura: riducono comunque i ricavi.`
          : undefined,
    });
  }
  if (p.note.stornoDaRimborsare > 0) {
    base.push({
      id: "storno-da-rimborsare",
      etichetta: "Note di credito emesse e non ancora rimborsate",
      valore: p.note.stornoDaRimborsare,
      formato: "euro",
      formula:
        "Hanno già ridotto l'IVA a debito alla data del documento, ma i ricavi caleranno solo quando il denaro tornerà indietro.",
    });
  }
  if (p.rivalsaIncassata > 0) {
    base.push({
      id: "rivalsa",
      etichetta: "Rivalsa INPS incassata",
      valore: p.rivalsaIncassata,
      formato: "euro",
      formula: `${percentuale(imp.aliquotaRivalsa, 0)} sui compensi incassati.`,
      nota: "La rivalsa concorre a formare il reddito professionale: non è un rimborso.",
    });
  }
  base.push({
    id: "ricavi-rilevanti",
    etichetta: "Ricavi rilevanti ai fini fiscali",
    valore: p.ricaviRilevanti,
    formato: "euro",
    formula:
      p.rivalsaIncassata > 0
        ? `${euro(p.compensiIncassati)} di compensi più ${euro(p.rivalsaIncassata)} di rivalsa.`
        : "Coincidono con i compensi incassati: non applichi la rivalsa in fattura.",
    totale: true,
  });

  // I documenti a cavallo d'anno vanno detti, non lasciati dentro un totale:
  // sono la differenza fra «quest'anno ho fatturato» e «quest'anno ho incassato»,
  // ed è lì che il principio di cassa sorprende chi legge.
  if (p.aCavallo.ricaviDaAnniPrecedenti > 0) {
    base.push({
      id: "ricavi-da-anni-precedenti",
      etichetta: "di cui incassati su fatture di anni precedenti",
      valore: p.aCavallo.ricaviDaAnniPrecedenti,
      formato: "euro",
      formula: `Fatture emesse prima del ${p.anno} e incassate quest'anno: per le imposte sono ricavo del ${p.anno}, perché conta la data dell'incasso. La loro IVA è già stata liquidata nell'anno di emissione.`,
    });
  }
  if (p.aCavallo.ricaviVersoAnniSuccessivi > 0) {
    base.push({
      id: "ricavi-verso-anni-successivi",
      etichetta: `Emesso nel ${p.anno} e incassato dopo`,
      valore: p.aCavallo.ricaviVersoAnniSuccessivi,
      formato: "euro",
      formula: `Non entra in questo prospetto: diventerà ricavo dell'anno in cui è stato incassato.${
        p.aCavallo.ivaSuIncassiFuturi > 0
          ? ` L'IVA, invece, è di competenza del ${p.anno}: ${euro(p.aCavallo.ivaSuIncassiFuturi)}, dovuti comunque.`
          : ""
      }`,
    });
  }
  base.push({
    id: "costi-pagati",
    etichetta: "Costi pagati nell'anno",
    valore: p.costiPagatiTotale,
    formato: "euro",
    formula: `Totale dei documenti con data di pagamento nel ${p.anno}, IVA compresa.`,
  });
  // Lo stesso discorso, dall'altro lato: il costo di dicembre pagato a gennaio
  // si deduce nell'anno nuovo, ma la sua IVA è detraibile in quello vecchio.
  if (!forfettario && p.aCavallo.costiDaAnniPrecedenti > 0) {
    base.push({
      id: "costi-da-anni-precedenti",
      etichetta: "di cui pagati su documenti di anni precedenti",
      valore: p.aCavallo.costiDaAnniPrecedenti,
      formato: "euro",
      formula: `Documenti datati prima del ${p.anno} e pagati quest'anno: si deducono nel ${p.anno}, perché conta la data del pagamento. La loro IVA era già detraibile nell'anno del documento.`,
    });
  }
  if (!forfettario && p.aCavallo.costiVersoAnniSuccessivi + p.aCavallo.costiSospesi > 0) {
    base.push({
      id: "costi-verso-anni-successivi",
      etichetta: `Registrato nel ${p.anno} e non ancora pagato`,
      valore: p.aCavallo.costiVersoAnniSuccessivi + p.aCavallo.costiSospesi,
      formato: "euro",
      formula: `Non è deducibile qui: lo sarà nell'anno in cui lo paghi.${
        p.aCavallo.ivaDetraibileSuPagamentiFuturi > 0
          ? ` L'IVA, invece, è detraibile già nel ${p.anno}: ${euro(p.aCavallo.ivaDetraibileSuPagamentiFuturi)}.`
          : ""
      }`,
    });
  }
  if (!forfettario) {
    base.push({
      id: "costi-deducibili",
      etichetta: "Quota fiscalmente deducibile",
      valore: p.costiDeducibiliPagati,
      formato: "euro",
      formula:
        "Imponibile di ogni costo pagato, moltiplicato per la sua percentuale di deducibilità.",
      nota: "Auto al 20%, ristoranti al 75%, telefonia al 50% dell'IVA: la percentuale è per documento.",
    });
    base.push({
      id: "iva-detraibile",
      etichetta: "IVA sugli acquisti detraibile",
      valore: p.ivaDetraibilePagata,
      formato: "euro",
      formula: "IVA di ogni costo pagato, per la sua percentuale di detraibilità.",
    });
  } else {
    base.push({
      id: "costi-indeducibili",
      etichetta: "Quota fiscalmente deducibile",
      valore: 0,
      formato: "euro",
      formula: "Zero: nel forfettario i costi non si deducono analiticamente.",
      nota: "Il forfait li considera già, nella parte di ricavi che il coefficiente ATECO lascia fuori dal reddito.",
    });
  }
  if (p.bolloACarico > 0) {
    base.push({
      id: "bollo",
      etichetta: "Imposta di bollo a tuo carico",
      valore: p.bolloACarico,
      formato: "euro",
      formula: `${euro(imp.importoBollo)} su ogni fattura senza IVA sopra ${euro(imp.sogliaBollo)}, non addebitata al cliente.`,
    });
  }

  sezioni.push({
    id: "base",
    lettera: "A",
    titolo: "Base di calcolo",
    sottotitolo: "Principio di cassa: contano gli incassi e i pagamenti effettivi",
    righe: base,
  });

  // — B · Reddito imponibile ————————————————————————
  const reddito: RigaProspetto[] = [
    {
      id: "reddito-lordo",
      etichetta: "Reddito lordo ante contributi",
      valore: p.redditoLordo,
      formato: "euro",
      formula: forfettario
        ? `${euro(p.ricaviRilevanti)} × ${percentuale(imp.coefficienteRedditivita, 0)}, il coefficiente di redditività del tuo gruppo ATECO.`
        : `${euro(p.ricaviRilevanti)} di ricavi meno ${euro(p.costiDeducibiliPagati)} di costi deducibili.`,
    },
    {
      id: "contributi-dedotti",
      etichetta: "Contributi dedotti",
      valore: p.contributiDedotti,
      formato: "euro",
      formula:
        p.fonteContributiDedotti === "versamenti"
          ? `Somma dei versamenti F24 di tipo contributi registrati nel ${p.anno}: si deducono per cassa, nell'anno in cui li paghi.`
          : `Non hai registrato versamenti F24 nell'anno, quindi si usano i contributi di competenza (${euro(p.contributiCompetenza)}). Registra gli F24 per avere il dato reale.`,
    },
  ];
  if (!forfettario) {
    reddito.push({
      id: "oneri",
      etichetta: "Oneri deducibili (fondo pensione)",
      valore: p.oneriDeducibili,
      formato: "euro",
      formula: `Versamenti a fondo pensione, deducibili fino a ${euro(par.tettoFondoPensione)} l'anno.`,
    });
  } else {
    reddito.push({
      id: "oneri-zero",
      etichetta: "Oneri deducibili",
      valore: 0,
      formato: "euro",
      formula: "Zero: nel forfettario gli oneri deducibili non abbattono la base imponibile.",
      nota: "È uno degli svantaggi del regime: il fondo pensione resta un costo senza risparmio fiscale.",
    });
  }
  reddito.push({
    id: "imponibile",
    etichetta: "Reddito imponibile",
    valore: p.imponibile,
    formato: "euro",
    formula: `${euro(p.redditoLordo)} − ${euro(p.contributiDedotti)} di contributi${p.oneriDeducibili > 0 ? ` − ${euro(p.oneriDeducibili)} di oneri` : ""}, mai sotto zero.`,
    totale: true,
  });

  sezioni.push({
    id: "reddito",
    lettera: "B",
    titolo: "Reddito imponibile",
    sottotitolo: "Dal fatturato alla base su cui si pagano le imposte",
    righe: reddito,
  });

  // — C · Imposte ————————————————————————————————
  const imposte: RigaProspetto[] = [];
  if (forfettario) {
    imposte.push({
      id: "sostitutiva",
      etichetta: "Imposta sostitutiva",
      valore: p.impostaSostitutiva,
      formato: "euro",
      formula: `${euro(p.imponibile)} × ${percentuale(imp.aliquotaSostitutiva, 0)}.`,
      nota: "Sostituisce IRPEF, addizionali regionali e comunali e IRAP.",
    });
  } else {
    imposte.push({
      id: "irpef-lorda",
      etichetta: "IRPEF lorda",
      valore: p.irpefLorda,
      formato: "euro",
      formula: descriviScaglioni(p.imponibile, imp),
    });
    if (p.detrazioni > 0) {
      imposte.push({
        id: "detrazioni",
        etichetta: "Detrazioni d'imposta",
        valore: p.detrazioni,
        formato: "euro",
        formula: "Importo indicato nelle impostazioni: lavoro autonomo, familiari a carico, spese sanitarie.",
      });
      imposte.push({
        id: "irpef-netta",
        etichetta: "IRPEF netta",
        valore: p.irpefNetta,
        formato: "euro",
        formula: `${euro(p.irpefLorda)} − ${euro(p.detrazioni)} di detrazioni, mai sotto zero.`,
      });
    }
    imposte.push({
      id: "add-regionale",
      etichetta: "Addizionale regionale",
      valore: p.addizionaleRegionale,
      formato: "euro",
      formula: `${euro(p.imponibile)} × ${percentuale(imp.addizionaleRegionale, 2)}, l'aliquota della tua regione.`,
    });
    imposte.push({
      id: "add-comunale",
      etichetta: "Addizionale comunale",
      valore: p.addizionaleComunale,
      formato: "euro",
      formula: `${euro(p.imponibile)} × ${percentuale(imp.addizionaleComunale, 2)}, l'aliquota del tuo comune.`,
    });
  }
  imposte.push({
    id: "totale-imposte",
    etichetta: "Totale imposte",
    valore: p.totaleImposte,
    formato: "euro",
    totale: true,
  });
  if (p.ritenuteSubite > 0) {
    imposte.push({
      id: "ritenute",
      etichetta: "Ritenute d'acconto già subite",
      valore: p.ritenuteSubite,
      formato: "euro",
      formula: `${percentuale(imp.aliquotaRitenuta, 0)} trattenuto dai committenti sulle fatture incassate: è un anticipo, si scomputa dal saldo.`,
    });
    if (p.creditoImposta > 0) {
      imposte.push({
        id: "credito",
        etichetta: "Credito d'imposta",
        valore: p.creditoImposta,
        formato: "euro",
        formula: `Le ritenute (${euro(p.ritenuteSubite)}) superano le imposte dovute (${euro(p.totaleImposte)}): la differenza è un credito da recuperare, non un saldo negativo.`,
        totale: true,
      });
    } else {
      imposte.push({
        id: "imposte-a-saldo",
        etichetta: "Imposte nette a saldo",
        valore: p.imposteNetteASaldo,
        formato: "euro",
        formula: `${euro(p.totaleImposte)} − ${euro(p.ritenuteSubite)} di ritenute già subite.`,
        totale: true,
      });
    }
  }

  sezioni.push({
    id: "imposte",
    lettera: "C",
    titolo: "Imposte",
    sottotitolo: forfettario ? "Imposta sostitutiva del regime forfettario" : "IRPEF a scaglioni e addizionali",
    righe: imposte,
  });

  // — D · Contributi ————————————————————————————————
  const contributi: RigaProspetto[] = [
    {
      id: "base-contributiva",
      etichetta: "Base imponibile contributiva",
      valore: p.baseContributiva,
      formato: "euro",
      formula: "Il reddito lordo prima della deduzione dei contributi stessi.",
    },
  ];
  if (imp.gestione === "separata") {
    contributi.push({
      id: "gestione-separata",
      etichetta: "Gestione Separata INPS",
      valore: p.contributiGestioneSeparata,
      formato: "euro",
      formula: `${euro(Math.min(p.baseContributiva, imp.massimaleGs))} × ${percentuale(imp.aliquotaGestioneSeparata, 2)}, fino al massimale di ${euro(imp.massimaleGs)}.`,
      nota: "Per i professionisti senza cassa non esiste un contributo minimo obbligatorio.",
    });
    contributi.push({
      id: "accredito",
      etichetta: "Accredito contributivo dell'anno",
      valore: p.accreditoIntero ? "Anno intero accreditato" : "Accredito parziale",
      formato: "testo",
      formula: `Il minimale di reddito per l'accredito intero è ${euro(imp.minimaleGs)}; il tuo reddito lordo è ${euro(p.redditoLordo)}.`,
      nota: p.accreditoIntero
        ? undefined
        : "Sotto il minimale l'anno non viene accreditato per intero ai fini pensionistici. È un'informazione che quasi nessuno dà.",
    });
  } else if (imp.gestione === "artigiani") {
    contributi.push({
      id: "artigiani",
      etichetta: "Artigiani e commercianti",
      valore: p.contributiArtigiani,
      formato: "euro",
      formula: `${euro(imp.contributiFissi)} di contributi fissi più ${percentuale(imp.aliquotaEccedenza, 2)} sulla parte di reddito oltre il minimale di ${euro(imp.minimaleArtigiani)}.`,
      nota: "I contributi fissi si versano in quattro rate, a febbraio, maggio, agosto e novembre.",
    });
  } else {
    contributi.push({
      id: "cassa",
      etichetta: "Contributo soggettivo di cassa",
      valore: p.contributiCassa,
      formato: "euro",
      formula: `${euro(p.baseContributiva)} × ${percentuale(imp.aliquotaSoggettivaCassa, 0)}.`,
      nota: `Il contributo integrativo del ${percentuale(imp.aliquotaIntegrativaCassa, 0)} si addebita in fattura al cliente e non concorre al tuo reddito.`,
    });
  }
  contributi.push({
    id: "totale-contributi",
    etichetta: "Totale contributi",
    valore: p.totaleContributi,
    formato: "euro",
    totale: true,
  });

  sezioni.push({
    id: "contributi",
    lettera: "D",
    titolo: "Contributi previdenziali",
    sottotitolo: nomeGestione(imp.gestione),
    righe: contributi,
  });

  // — E · Sintesi ————————————————————————————————
  sezioni.push({
    id: "sintesi",
    lettera: "E",
    titolo: "Sintesi e accantonamento",
    sottotitolo: "Quanto pesa davvero, e quanto mettere da parte ogni mese",
    righe: [
      {
        id: "carico",
        etichetta: "Carico totale annuo",
        valore: p.caricoTotale,
        formato: "euro",
        formula: `${euro(p.totaleImposte)} di imposte più ${euro(p.totaleContributi)} di contributi.`,
        totale: true,
      },
      {
        id: "pressione",
        etichetta: "Pressione effettiva sui ricavi",
        valore: p.pressione,
        formato: "percentuale",
        formula: `${euro(p.caricoTotale)} ÷ ${euro(p.ricaviRilevanti)}: quanto di ogni euro incassato se ne va fra imposte e contributi.`,
      },
      {
        id: "costi-netti",
        etichetta: "Costi netti a carico dell'attività",
        valore: p.costiNettiACarico,
        formato: "euro",
        formula: forfettario
          ? `${euro(p.costiPagatiTotale)} di uscite${p.bolloACarico > 0 ? ` più ${euro(p.bolloACarico)} di bollo` : ""}: in forfettario l'IVA sugli acquisti è indetraibile e diventa costo pieno.`
          : `${euro(p.costiPagatiTotale)} di uscite meno ${euro(p.ivaDetraibilePagata)} di IVA recuperabile${p.bolloACarico > 0 ? `, più ${euro(p.bolloACarico)} di bollo` : ""}.`,
      },
      {
        id: "netto",
        etichetta: "Reddito netto disponibile",
        valore: p.nettoDisponibile,
        formato: "euro",
        formula: `${euro(p.ricaviRilevanti)} − ${euro(p.costiNettiACarico)} di costi − ${euro(p.caricoTotale)} di carico fiscale.`,
        nota: "Quello che ti resta davvero, prima delle spese personali.",
        totale: true,
      },
      {
        id: "accantonamento-mensile",
        etichetta: "Da accantonare al mese",
        valore: p.accantonamentoMensile,
        formato: "euro",
        formula: `${euro(p.caricoTotale)} ÷ 12, da spostare su un conto separato dedicato alle imposte.`,
      },
      {
        id: "scostamento",
        etichetta: "Scostamento sull'accantonamento impostato",
        valore: p.scostamentoAccantonamento,
        formato: "euro",
        formula: `Accantoni il ${percentuale(p.percentualeImpostata, 0)} dei ricavi, cioè ${euro(p.accantonamentoAnnuo)}; il carico reale è ${euro(p.caricoTotale)}.`,
        nota:
          p.scostamentoAccantonamento < 0
            ? `Non basta: porta la percentuale almeno al ${Math.ceil(p.pressione * 100)}%.`
            : "Copri il carico stimato con un margine.",
      },
    ],
  });

  // — F · Saldo e acconti ————————————————————————
  const acconti: RigaProspetto[] = [
    {
      id: "dovuto",
      etichetta: "Totale dovuto per l'anno",
      valore: p.totaleDovuto,
      formato: "euro",
      formula: `${euro(p.imposteNetteASaldo)} di imposte nette più ${euro(p.totaleContributi)} di contributi.`,
      totale: true,
    },
    {
      id: "gia-versato",
      etichetta: "Già versato con F24 nell'anno",
      valore: p.giaVersato,
      formato: "euro",
      formula: "Somma dei versamenti registrati, esclusi quelli di IVA.",
    },
  ];

  // Il credito che arriva dalla chiusura dell'anno prima compare solo quando
  // c'è: una riga da zero euro in un prospetto è rumore.
  if (p.creditoAnnoPrecedente > 0) {
    acconti.push({
      id: "credito-anno-precedente",
      etichetta: "Credito dall'anno precedente",
      valore: p.creditoAnnoPrecedente,
      formato: "euro",
      formula: `Ritenute eccedenti e versamenti in eccesso riportati dalla chiusura del ${p.anno - 1}. Si scomputa prima dal saldo, poi dagli acconti: ${euro(p.creditoUtilizzatoSuSaldo)} sono già serviti a coprire il saldo.`,
    });
  }

  acconti.push({
    id: "saldo",
    etichetta: "Saldo residuo da versare",
    valore: p.saldoResiduo,
    formato: "euro",
    formula:
      p.creditoAnnoPrecedente > 0
        ? `${euro(p.totaleDovuto)} − ${euro(p.giaVersato)} già versati − ${euro(p.creditoUtilizzatoSuSaldo)} di credito, mai sotto zero.`
        : `${euro(p.totaleDovuto)} − ${euro(p.giaVersato)} già versati, mai sotto zero.`,
  });

  if (!p.acconti.dovuti) {
    acconti.push({
      id: "acconti-non-dovuti",
      etichetta: "Acconti per l'anno successivo",
      valore: "Non dovuti",
      formato: "testo",
      formula: `Il dovuto (${euro(p.totaleDovuto)}) resta sotto la soglia di ${euro(par.sogliaAcconti)}: nessun acconto.`,
    });
  } else if (p.acconti.accontoUnico) {
    acconti.push({
      id: "acconto-unico",
      etichetta: "Acconto unico a novembre",
      valore: p.acconti.secondo,
      formato: "euro",
      formula: `Sotto ${euro(par.sogliaAccontoUnico)} l'acconto non si divide: si versa tutto in una volta a novembre.`,
    });
  } else {
    acconti.push({
      id: "primo-acconto",
      etichetta: "Primo acconto",
      valore: p.acconti.primo,
      formato: "euro",
      formula: `${percentuale(par.quotaPrimoAcconto, 0)} di ${euro(p.totaleDovuto)}, metodo storico. Si versa a giugno insieme al saldo.`,
    });
    acconti.push({
      id: "secondo-acconto",
      etichetta: "Secondo acconto",
      valore: p.acconti.secondo,
      formato: "euro",
      formula: `${percentuale(par.quotaSecondoAcconto, 0)} di ${euro(p.totaleDovuto)}. Si versa entro il 30 novembre.`,
    });
    acconti.push({
      id: "rata",
      etichetta: `Rata mensile se rateizzi in ${par.rateRateizzazione}`,
      valore: p.rataRateizzazioneConInteressi,
      formato: "euro",
      formula: `${euro(p.saldoResiduo + p.acconti.primo)} fra saldo e primo acconto, in ${par.rateRateizzazione} rate da giugno a novembre, con interessi dello ${percentuale(par.interesseRateizzazioneMensile, 2)} al mese.`,
      nota: `Senza interessi la rata sarebbe ${euro(p.rataRateizzazione)}.`,
    });
  }

  sezioni.push({
    id: "acconti",
    lettera: "F",
    titolo: "Saldo, acconti e rateizzazione",
    sottotitolo: "Che cosa esce dal conto, e quando",
    righe: acconti,
  });

  return sezioni;
}

/** «28.000 € al 23%, poi 22.000 € al 33%»: gli scaglioni davvero applicati. */
export function descriviScaglioni(imponibile: number, imp: Impostazioni): string {
  if (imponibile <= 0) return "Nessuna imposta: il reddito imponibile è zero.";
  const pezzi: string[] = [];
  let precedente = 0;
  for (const s of imp.scaglioniIrpef) {
    const tetto = s.limite ?? Number.POSITIVE_INFINITY;
    const quota = Math.min(imponibile, tetto) - precedente;
    if (quota <= 0) break;
    pezzi.push(`${euro(quota)} al ${percentuale(s.aliquota, 0)}`);
    precedente = tetto;
    if (imponibile <= tetto) break;
  }
  return `Scaglioni progressivi: ${pezzi.join(", poi ")}.`;
}

/** Il messaggio sulla soglia, con il numero che serve per decidere. */
export function dettaglioSoglia(p: Prospetto, imp: Impostazioni): string | null {
  if (imp.regime !== "forfettario") return null;
  const residuo = imp.limiteForfettario - p.soglia.baseCassa;
  if (residuo <= 0) return p.soglia.messaggio;
  return `${p.soglia.messaggio} Hai usato ${percentuale(p.soglia.utilizzoLimite, 0)} del limite di ${interoIt.format(imp.limiteForfettario)} €: puoi ancora incassare ${euro(residuo)}.`;
}

function nomeGestione(gestione: Impostazioni["gestione"]): string {
  return gestione === "separata"
    ? "Gestione Separata INPS"
    : gestione === "artigiani"
      ? "Artigiani e commercianti"
      : "Cassa professionale";
}
