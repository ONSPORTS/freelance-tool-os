/**
 * Il motore fiscale: dalla catena di calcolo del brief al prospetto completo.
 *
 * Tutto il calcolo delle imposte segue il principio di cassa: contano gli
 * incassi e i pagamenti effettivi, non le date dei documenti.
 * (La liquidazione IVA fa eccezione e sta in `iva.ts`: quella segue la data
 * del documento.)
 */
import { limita, nonNegativo, rapporto, round2, somma } from "./aritmetica";
import {
  addizionaleComunaleDi,
  addizionaleDovuta,
  addizionaleRegionaleDi,
} from "./addizionali";
import { impostaProgressiva } from "./scaglioni";
import { interoIt } from "../format";
import { annoDi, calcolaCosto, calcolaFattura } from "./documenti";
import { dateCosto, dateFattura, ripartisci } from "./competenza";
import { calcolaNota, dateNota, type NotaCalcolata } from "./note";
import type {
  NotaCredito,
  Costo,
  CostoCalcolato,
  Fattura,
  FatturaCalcolata,
  Impostazioni,
  ParametriAnno,
  ScaglioneIrpef,
  VersamentoF24,
} from "./tipi";

export type IngressoMotore = {
  impostazioni: Impostazioni;
  parametri: ParametriAnno;
  fatture: Fattura[];
  costi: Costo[];
  /** Le note di credito emesse. Stornano ricavi e IVA con le stesse due date. */
  note?: NotaCredito[];
  versamenti?: VersamentoF24[];
  /**
   * Le impostazioni degli altri anni presenti in archivio.
   *
   * Serve perché ogni documento va calcolato con le regole del **suo** anno:
   * una fattura del 2026 emessa in forfettario non prende l'IVA al 22% solo
   * perché nel 2027 si è passati all'ordinario. Senza questo elenco il motore
   * ricade sulle impostazioni dell'anno in esame, che è corretto finché di anni
   * ce n'è uno solo.
   */
  impostazioniPerAnno?: Impostazioni[];
  /**
   * Credito d'imposta che arriva dall'anno precedente (eccedenza di acconti,
   * ritenute superiori alle imposte). Si scomputa dal saldo e dagli acconti.
   */
  creditoAnnoPrecedente?: number;
  /** Data di riferimento per stati e ritardi. Iniettata: il motore resta puro. */
  oggi: string;
};

/**
 * Le impostazioni da usare per un documento, in base al suo anno.
 *
 * Per un anno non censito si prende l'anno censito più vicino **precedente**,
 * e in mancanza il più vicino in assoluto: un documento vecchio calcolato con
 * le regole di un anno futuro è esattamente l'errore che questa funzione evita.
 */
export function risolutoreImpostazioni(
  corrente: Impostazioni,
  tutte: Impostazioni[] = [],
): (anno: number) => Impostazioni {
  const perAnno = new Map<number, Impostazioni>();
  for (const i of tutte) perAnno.set(i.anno, i);
  perAnno.set(corrente.anno, perAnno.get(corrente.anno) ?? corrente);
  const anni = [...perAnno.keys()].sort((a, b) => a - b);

  return (anno) => {
    const esatta = perAnno.get(anno);
    if (esatta) return esatta;
    const precedenti = anni.filter((a) => a < anno);
    if (precedenti.length > 0) return perAnno.get(precedenti[precedenti.length - 1]) as Impostazioni;
    return perAnno.get(anni[0]) ?? corrente;
  };
}

export type StatoSoglia =
  | "nessunLimite"
  | "neiLimiti"
  | "avviso"
  | "limiteSuperato"
  | "uscitaImmediata";

export type Acconti = {
  dovuti: boolean;
  primo: number;
  secondo: number;
  /** Sotto la soglia dei 257,52 € l'acconto è unico e si versa a novembre. */
  accontoUnico: boolean;
  /** Quanto del credito dell'anno precedente è servito a coprire gli acconti. */
  creditoUtilizzato: number;
  /** Quello che resta del credito dopo aver coperto gli acconti. */
  creditoResiduo: number;
  /** Acconti al netto del credito: la cifra che esce davvero dal conto. */
  primoDaVersare: number;
  secondoDaVersare: number;
};

export type Prospetto = {
  anno: number;
  regime: Impostazioni["regime"];

  /** A · Base di calcolo (principio di cassa) */
  compensiIncassati: number;
  rivalsaIncassata: number;
  ricaviRilevanti: number;
  /** IVA incassata dai clienti sulle fatture riscosse: denaro in cassa che non è tuo. */
  ivaIncassata: number;
  /** Compensi più IVA incassata: il denaro lordo entrato davvero in cassa. */
  incassatoLordo: number;
  costiPagatiTotale: number;
  costiDeducibiliPagati: number;
  ivaDetraibilePagata: number;
  bolloACarico: number;
  fatturatoEmesso: number;

  /**
   * Note di credito, tenute separate e mai annegate nei totali.
   *
   * `stornoIncassato` è già sottratto da `compensiIncassati` e da
   * `ricaviRilevanti`; `stornoEmesso` da `fatturatoEmesso`. Restano qui in
   * chiaro perché un fatturato che cala senza dire perché è il modo più veloce
   * di far perdere fiducia in un prospetto.
   */
  note: {
    /** Storni con data di rimborso nell'anno: hanno già ridotto i ricavi per cassa. */
    stornoIncassato: number;
    /** Storni con data documento nell'anno: hanno già ridotto il fatturato emesso. */
    stornoEmesso: number;
    /** IVA che le note tolgono al debito dell'anno. */
    ivaStornata: number;
    /** Emesse e non ancora rimborsate: ridurranno i ricavi quando il denaro torna. */
    stornoDaRimborsare: number;
    numero: number;
    /** Quanto delle note emesse non è agganciato a nessuna fattura. */
    nonRiconciliato: number;
  };

  /** Soglie del regime forfettario */
  soglia: {
    stato: StatoSoglia;
    baseCassa: number;
    baseCompetenza: number;
    /** Emesso e non ancora incassato: se rientra entro dicembre sposta la soglia. */
    inSospeso: number;
    utilizzoLimite: number;
    messaggio: string;
  };

  /** B · Reddito imponibile */
  redditoLordo: number;
  contributiCompetenza: number;
  contributiDedotti: number;
  fonteContributiDedotti: "versamenti" | "competenza";
  oneriDeducibili: number;
  imponibile: number;

  /** C · Imposte */
  impostaSostitutiva: number;
  irpefLorda: number;
  detrazioni: number;
  irpefNetta: number;
  addizionaleRegionale: number;
  addizionaleComunale: number;
  totaleImposte: number;
  ritenuteSubite: number;
  imposteNetteASaldo: number;
  creditoImposta: number;

  /** D · Contributi previdenziali */
  baseContributiva: number;
  contributiGestioneSeparata: number;
  contributiArtigiani: number;
  contributiCassa: number;
  totaleContributi: number;
  accreditoIntero: boolean | null;

  /** E · Sintesi e accantonamento */
  caricoTotale: number;
  pressione: number;
  costiNettiACarico: number;
  nettoDisponibile: number;
  percentualeTeoricaAccantonamento: number;
  percentualeImpostata: number;
  accantonamentoAnnuo: number;
  scostamentoAccantonamento: number;
  accantonamentoMensile: number;

  /** F · Saldo, acconti e rateizzazione */
  totaleDovuto: number;
  giaVersato: number;
  saldoResiduo: number;
  acconti: Acconti;
  rataRateizzazione: number;
  rataRateizzazioneConInteressi: number;
  /** Credito arrivato dall'anno precedente, prima di essere utilizzato. */
  creditoAnnoPrecedente: number;
  /** Quanto di quel credito è servito a coprire il saldo. */
  creditoUtilizzatoSuSaldo: number;

  /**
   * G · Documenti a cavallo d'anno.
   *
   * Le grandezze che attraversano il 31 dicembre, tenute a vista perché sono
   * quelle su cui si sbaglia: entrano nelle imposte di un anno e nell'IVA di
   * un altro.
   */
  aCavallo: {
    /** Incassato quest'anno su fatture emesse in anni precedenti: reddito di quest'anno, IVA già liquidata. */
    ricaviDaAnniPrecedenti: number;
    /** Emesso quest'anno e già incassato in un anno successivo: IVA di quest'anno, reddito di quello. */
    ricaviVersoAnniSuccessivi: number;
    /** Emesso quest'anno e non ancora incassato: IVA dovuta, reddito ancora senza anno. */
    ricaviSospesi: number;
    /** IVA di competenza di quest'anno su fatture che incasserai dopo: dovuta comunque. */
    ivaSuIncassiFuturi: number;
    costiDaAnniPrecedenti: number;
    costiVersoAnniSuccessivi: number;
    costiSospesi: number;
    /** IVA detraibile di quest'anno su costi che pagherai dopo: detraibile comunque. */
    ivaDetraibileSuPagamentiFuturi: number;
    /** Quante fatture e quanti costi attraversano il confine. */
    numeroFatture: number;
    numeroCosti: number;
  };

  /** Documenti già calcolati, per non ripetere il lavoro a valle. */
  fattureCalcolate: FatturaCalcolata[];
  costiCalcolati: CostoCalcolato[];
  noteCalcolate: NotaCalcolata[];
};

/** IRPEF a scaglioni progressivi. La formula sta in `scaglioni.ts`: la
 * condividono le addizionali regionali, che molte regioni applicano così. */
export function irpefScaglioni(imponibile: number, scaglioni: ScaglioneIrpef[]): number {
  return impostaProgressiva(imponibile, scaglioni);
}

/** Contributi previdenziali sulla base imponibile contributiva. */
export function contributiPrevidenziali(
  base: number,
  imp: Impostazioni,
): { separata: number; artigiani: number; cassa: number; totale: number } {
  const positiva = nonNegativo(base);
  const separata =
    imp.gestione === "separata"
      ? round2(Math.min(positiva, imp.massimaleGs) * imp.aliquotaGestioneSeparata)
      : 0;
  const artigiani =
    imp.gestione === "artigiani"
      ? round2(
          imp.contributiFissi + nonNegativo(positiva - imp.minimaleArtigiani) * imp.aliquotaEccedenza,
        )
      : 0;
  const cassa =
    imp.gestione === "cassa" ? round2(positiva * imp.aliquotaSoggettivaCassa) : 0;
  return { separata, artigiani, cassa, totale: somma(separata, artigiani, cassa) };
}

/**
 * Acconti con metodo storico.
 *
 * Rispetto all'Excel, che spalmava sempre 40/60, qui valgono anche le due soglie
 * di legge: sotto 51,65 € non si versa acconto, sotto 257,52 € l'acconto è unico
 * a novembre. Cambia solo il comportamento su importi minuscoli, dove il 40/60
 * produceva rate che nessuno versa davvero.
 */
export function calcolaAcconti(
  dovuto: number,
  par: ParametriAnno,
  creditoInIngresso = 0,
): Acconti {
  const credito = nonNegativo(creditoInIngresso);

  if (dovuto < par.sogliaAcconti) {
    return conCredito({ dovuti: false, primo: 0, secondo: 0, accontoUnico: false }, credito);
  }
  if (dovuto < par.sogliaAccontoUnico) {
    return conCredito(
      { dovuti: true, primo: 0, secondo: round2(dovuto), accontoUnico: true },
      credito,
    );
  }
  return conCredito(
    {
      dovuti: true,
      primo: round2(dovuto * par.quotaPrimoAcconto),
      secondo: round2(dovuto * par.quotaSecondoAcconto),
      accontoUnico: false,
    },
    credito,
  );
}

/**
 * Scomputa il credito dell'anno precedente dagli acconti, nell'ordine in cui si
 * versano: prima quello di giugno, poi quello di novembre. Gli importi `primo` e
 * `secondo` restano quelli dovuti per legge — il credito non li riduce, li paga.
 * La distinzione conta: è dovuto quello che si dichiara, da versare quello che
 * esce dal conto.
 */
function conCredito(
  base: { dovuti: boolean; primo: number; secondo: number; accontoUnico: boolean },
  credito: number,
): Acconti {
  const suPrimo = Math.min(credito, base.primo);
  const suSecondo = Math.min(credito - suPrimo, base.secondo);
  const utilizzato = round2(suPrimo + suSecondo);
  return {
    ...base,
    creditoUtilizzato: utilizzato,
    creditoResiduo: round2(credito - utilizzato),
    primoDaVersare: round2(base.primo - suPrimo),
    secondoDaVersare: round2(base.secondo - suSecondo),
  };
}

function messaggioSoglia(stato: StatoSoglia, par: ParametriAnno): string {
  switch (stato) {
    case "nessunLimite":
      return "Regime ordinario: nessun limite di ricavi.";
    case "uscitaImmediata":
      return `Soglia di ${interoIt.format(par.sogliaUscitaImmediata)} € superata: esci dal forfettario nello stesso anno, con IVA dovuta dall'operazione che la supera.`;
    case "limiteSuperato":
      return `Limite di ${interoIt.format(par.limiteForfettario)} € superato: resti forfettario quest'anno, esci dal 1° gennaio successivo.`;
    case "avviso":
      return `Hai usato oltre l'${Math.round(par.sogliaAvviso * 100)}% del limite. Pianifica il cambio di regime prima di superarlo.`;
    default:
      return "Nei limiti del regime forfettario.";
  }
}

/**
 * Il prospetto completo dell'anno.
 * Nessun accesso al database, nessun `new Date()` nascosto: stessi ingressi,
 * stesso risultato, sempre.
 */
export function calcolaProspetto(ingresso: IngressoMotore): Prospetto {
  const { impostazioni: imp, parametri: par, oggi } = ingresso;
  const anno = imp.anno;
  const forfettario = imp.regime === "forfettario";

  // Ogni documento con le regole del suo anno: le impostazioni dell'anno in
  // esame valgono per il prospetto, non per una fattura di tre anni fa.
  const impostazioniDi = risolutoreImpostazioni(imp, ingresso.impostazioniPerAnno);
  const fattureCalcolate = ingresso.fatture.map((f) =>
    calcolaFattura(f, impostazioniDi(annoDi(f.dataEmissione)), oggi),
  );
  const costiCalcolati = ingresso.costi.map((c) =>
    calcolaCosto(c, impostazioniDi(annoDi(c.dataDocumento))),
  );
  const noteCalcolate = (ingresso.note ?? []).map((n) =>
    calcolaNota(n, impostazioniDi(annoDi(n.dataDocumento))),
  );

  // — A · Base di calcolo ————————————————————————————————
  // Due criteri, una funzione sola: la cassa comanda sulle imposte, la data del
  // documento sull'IVA e sul bollo.
  const rf = ripartisci(fattureCalcolate, anno, dateFattura);
  const rc = ripartisci(costiCalcolati, anno, dateCosto);
  // Le note passano dalla stessa funzione delle fatture e dei costi: due date,
  // due criteri. La data del rimborso comanda sui ricavi, quella del documento
  // sull'IVA — esattamente come incasso ed emissione su una fattura.
  const rn = ripartisci(noteCalcolate, anno, dateNota);
  const incassateNellAnno = rf.perCassa;
  const emesseNellAnno = rf.perCompetenza;
  const pagatiNellAnno = rc.perCassa;

  // Gli storni entrano nei ricavi con il segno meno, alla data in cui il denaro
  // è tornato indietro. Una nota emessa e non ancora rimborsata non riduce
  // ancora niente di cassa, come una fattura emessa e non incassata.
  const stornoIncassato = somma(...rn.perCassa.map((n) => n.imponibile));
  const stornoEmesso = somma(...rn.perCompetenza.map((n) => n.imponibile));
  const ivaStornata = somma(...rn.perCompetenza.map((n) => n.iva));
  const stornoDaRimborsare = somma(
    ...[...rn.sospesi, ...rn.versoAnniSuccessivi].map((n) => n.imponibile),
  );

  const compensiIncassati = round2(
    somma(...incassateNellAnno.map((f) => f.imponibile)) - stornoIncassato,
  );
  const rivalsaIncassata = somma(...incassateNellAnno.map((f) => f.rivalsa));
  const ricaviRilevanti = somma(compensiIncassati, rivalsaIncassata);
  const ivaIncassata = round2(somma(...incassateNellAnno.map((f) => f.iva)) - ivaStornata);
  const incassatoLordo = somma(ricaviRilevanti, ivaIncassata);

  const costiPagatiTotale = somma(...pagatiNellAnno.map((c) => c.totale));
  const costiDeducibiliPagati = somma(...pagatiNellAnno.map((c) => c.costoDeducibile));
  const ivaDetraibilePagata = somma(...pagatiNellAnno.map((c) => c.ivaDetraibile));
  // Il bollo segue la data del documento: è dovuto all'emissione.
  const bolloACarico = somma(...emesseNellAnno.map((f) => f.bolloACarico));

  const fatturatoEmesso = round2(
    somma(...emesseNellAnno.map((f) => f.ricavoRilevante)) - stornoEmesso,
  );
  const inSospeso = somma(...rf.sospesi.map((f) => f.ricavoRilevante));

  // La soglia si misura sui compensi percepiti, non sull'emesso: l'emesso resta
  // a fianco come indicatore anticipato di dove chiuderai l'anno.
  let statoSoglia: StatoSoglia = "nessunLimite";
  if (forfettario) {
    if (ricaviRilevanti > imp.sogliaUscita) statoSoglia = "uscitaImmediata";
    else if (ricaviRilevanti > imp.limiteForfettario) statoSoglia = "limiteSuperato";
    else if (ricaviRilevanti > imp.limiteForfettario * par.sogliaAvviso) statoSoglia = "avviso";
    else statoSoglia = "neiLimiti";
  }

  // — B · Reddito imponibile ————————————————————————————
  const redditoLordo = forfettario
    ? round2(ricaviRilevanti * imp.coefficienteRedditivita)
    : round2(ricaviRilevanti - costiDeducibiliPagati);

  const baseContributiva = redditoLordo;
  const contributi = contributiPrevidenziali(baseContributiva, imp);
  const contributiCompetenza = contributi.totale;

  // Principio di cassa: si deducono i contributi effettivamente versati nell'anno.
  // Se l'utente non ha ancora registrato F24 si ricade sulla competenza, come
  // faceva l'Excel, dichiarandolo nel prospetto.
  const versamentiContributi = somma(
    ...(ingresso.versamenti ?? [])
      .filter((v) => v.tipo === "contributi" && annoDi(v.data) === anno)
      .map((v) => v.importo),
  );
  const usaVersamenti = versamentiContributi > 0;
  const contributiDedotti = usaVersamenti ? versamentiContributi : contributiCompetenza;

  const oneriDeducibili = forfettario
    ? 0
    : round2(Math.min(imp.fondoPensione, par.tettoFondoPensione));

  const imponibile = round2(nonNegativo(redditoLordo - contributiDedotti - oneriDeducibili));

  // — C · Imposte ————————————————————————————————————
  const impostaSostitutiva = forfettario ? round2(imponibile * imp.aliquotaSostitutiva) : 0;
  const irpefLorda = forfettario ? 0 : irpefScaglioni(imponibile, imp.scaglioniIrpef);
  const detrazioni = forfettario ? 0 : imp.detrazioniPersonali;
  const irpefNetta = forfettario ? 0 : round2(nonNegativo(irpefLorda - detrazioni));
  // Aliquota unica o scaglioni, e la soglia di esenzione: la regola sta in un
  // posto solo, perché qui e nel confronto fra regimi deve dare lo stesso conto.
  const addizionaleRegionale = forfettario
    ? 0
    : addizionaleDovuta(imponibile, addizionaleRegionaleDi(imp));
  const addizionaleComunale = forfettario
    ? 0
    : addizionaleDovuta(imponibile, addizionaleComunaleDi(imp));
  const totaleImposte = somma(
    impostaSostitutiva,
    irpefNetta,
    addizionaleRegionale,
    addizionaleComunale,
  );

  const ritenuteSubite = somma(...incassateNellAnno.map((f) => f.ritenuta));
  const imposteNetteASaldo = round2(nonNegativo(totaleImposte - ritenuteSubite));
  const creditoImposta = round2(nonNegativo(ritenuteSubite - totaleImposte));

  // — E · Sintesi ————————————————————————————————————
  const caricoTotale = somma(totaleImposte, contributiCompetenza);
  const pressione = rapporto(caricoTotale, ricaviRilevanti);
  // In forfettario l'IVA sugli acquisti è indetraibile e diventa costo pieno.
  const costiNettiACarico = round2(
    (forfettario ? costiPagatiTotale : costiPagatiTotale - ivaDetraibilePagata) + bolloACarico,
  );
  const nettoDisponibile = round2(ricaviRilevanti - costiNettiACarico - caricoTotale);

  const accantonamentoAnnuo = round2(ricaviRilevanti * imp.percentualeAccantonamento);

  // — F · Saldo e acconti ————————————————————————————
  const totaleDovuto = somma(imposteNetteASaldo, contributiCompetenza);
  const giaVersato = somma(
    ...(ingresso.versamenti ?? [])
      .filter((v) => v.tipo !== "iva" && annoDi(v.data) === anno)
      .map((v) => v.importo),
  );
  // Il credito che arriva dall'anno precedente copre prima il saldo, poi gli
  // acconti: è l'ordine in cui si compensa in F24.
  const creditoAnnoPrecedente = nonNegativo(ingresso.creditoAnnoPrecedente ?? 0);
  const dopoVersamenti = nonNegativo(totaleDovuto - giaVersato);
  const creditoSuSaldo = Math.min(creditoAnnoPrecedente, dopoVersamenti);
  const saldoResiduo = round2(dopoVersamenti - creditoSuSaldo);
  const acconti = calcolaAcconti(totaleDovuto, par, creditoAnnoPrecedente - creditoSuSaldo);
  const daRateizzare = saldoResiduo + acconti.primoDaVersare;
  const rataRateizzazione = round2(daRateizzare / par.rateRateizzazione);
  // Interesse semplice crescente sulle rate successive alla prima.
  const rateMedieConInteressi =
    ((par.rateRateizzazione - 1) / 2) * par.interesseRateizzazioneMensile;
  const rataRateizzazioneConInteressi = round2(
    (daRateizzare * (1 + rateMedieConInteressi)) / par.rateRateizzazione,
  );

  return {
    anno,
    regime: imp.regime,

    compensiIncassati,
    rivalsaIncassata,
    ricaviRilevanti,
    ivaIncassata,
    incassatoLordo,
    costiPagatiTotale,
    costiDeducibiliPagati,
    ivaDetraibilePagata,
    bolloACarico,
    fatturatoEmesso,

    soglia: {
      stato: statoSoglia,
      baseCassa: ricaviRilevanti,
      baseCompetenza: fatturatoEmesso,
      inSospeso,
      utilizzoLimite: forfettario ? rapporto(ricaviRilevanti, imp.limiteForfettario) : 0,
      messaggio: messaggioSoglia(statoSoglia, par),
    },

    redditoLordo,
    contributiCompetenza,
    contributiDedotti,
    fonteContributiDedotti: usaVersamenti ? "versamenti" : "competenza",
    oneriDeducibili,
    imponibile,

    impostaSostitutiva,
    irpefLorda,
    detrazioni,
    irpefNetta,
    addizionaleRegionale,
    addizionaleComunale,
    totaleImposte,
    ritenuteSubite,
    imposteNetteASaldo,
    creditoImposta,

    baseContributiva,
    contributiGestioneSeparata: contributi.separata,
    contributiArtigiani: contributi.artigiani,
    contributiCassa: contributi.cassa,
    totaleContributi: contributiCompetenza,
    accreditoIntero:
      imp.gestione === "separata" ? baseContributiva >= imp.minimaleGs : null,

    caricoTotale,
    pressione,
    costiNettiACarico,
    nettoDisponibile,
    percentualeTeoricaAccantonamento: pressione,
    percentualeImpostata: imp.percentualeAccantonamento,
    accantonamentoAnnuo,
    scostamentoAccantonamento: round2(accantonamentoAnnuo - caricoTotale),
    accantonamentoMensile: round2(caricoTotale / 12),

    totaleDovuto,
    giaVersato,
    saldoResiduo,
    acconti,
    rataRateizzazione,
    rataRateizzazioneConInteressi,

    aCavallo: {
      ricaviDaAnniPrecedenti: somma(...rf.daAnniPrecedenti.map((f) => f.ricavoRilevante)),
      ricaviVersoAnniSuccessivi: somma(...rf.versoAnniSuccessivi.map((f) => f.ricavoRilevante)),
      ricaviSospesi: inSospeso,
      ivaSuIncassiFuturi: somma(
        ...rf.versoAnniSuccessivi.map((f) => f.iva),
        ...rf.sospesi.map((f) => f.iva),
      ),
      costiDaAnniPrecedenti: somma(...rc.daAnniPrecedenti.map((c) => c.costoDeducibile)),
      costiVersoAnniSuccessivi: somma(...rc.versoAnniSuccessivi.map((c) => c.costoDeducibile)),
      costiSospesi: somma(...rc.sospesi.map((c) => c.costoDeducibile)),
      ivaDetraibileSuPagamentiFuturi: somma(
        ...rc.versoAnniSuccessivi.map((c) => c.ivaDetraibile),
        ...rc.sospesi.map((c) => c.ivaDetraibile),
      ),
      numeroFatture: rf.daAnniPrecedenti.length + rf.versoAnniSuccessivi.length,
      numeroCosti: rc.daAnniPrecedenti.length + rc.versoAnniSuccessivi.length,
    },

    creditoAnnoPrecedente,
    creditoUtilizzatoSuSaldo: round2(creditoSuSaldo),

    note: {
      stornoIncassato,
      stornoEmesso,
      ivaStornata,
      stornoDaRimborsare,
      numero: noteCalcolate.length,
      nonRiconciliato: somma(...noteCalcolate.map((n) => n.residuo)),
    },
    fattureCalcolate,
    costiCalcolati,
    noteCalcolate,
  };
}

export { limita };
