/**
 * Il motore fiscale: dalla catena di calcolo del brief al prospetto completo.
 *
 * Tutto il calcolo delle imposte segue il principio di cassa: contano gli
 * incassi e i pagamenti effettivi, non le date dei documenti.
 * (La liquidazione IVA fa eccezione e sta in `iva.ts`: quella segue la data
 * del documento.)
 */
import { limita, nonNegativo, rapporto, round2, somma } from "./aritmetica";
import { interoIt } from "../format";
import { annoDi, calcolaCosto, calcolaFattura } from "./documenti";
import type {
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
  versamenti?: VersamentoF24[];
  /** Data di riferimento per stati e ritardi. Iniettata: il motore resta puro. */
  oggi: string;
};

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

  /** Documenti già calcolati, per non ripetere il lavoro a valle. */
  fattureCalcolate: FatturaCalcolata[];
  costiCalcolati: CostoCalcolato[];
};

/** IRPEF a scaglioni progressivi. */
export function irpefScaglioni(imponibile: number, scaglioni: ScaglioneIrpef[]): number {
  if (imponibile <= 0) return 0;
  let imposta = 0;
  let precedente = 0;
  for (const s of scaglioni) {
    const tetto = s.limite ?? Number.POSITIVE_INFINITY;
    const quota = Math.min(imponibile, tetto) - precedente;
    if (quota <= 0) break;
    imposta += quota * s.aliquota;
    precedente = tetto;
    if (imponibile <= tetto) break;
  }
  return round2(imposta);
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
export function calcolaAcconti(dovuto: number, par: ParametriAnno): Acconti {
  if (dovuto < par.sogliaAcconti) {
    return { dovuti: false, primo: 0, secondo: 0, accontoUnico: false };
  }
  if (dovuto < par.sogliaAccontoUnico) {
    return { dovuti: true, primo: 0, secondo: round2(dovuto), accontoUnico: true };
  }
  return {
    dovuti: true,
    primo: round2(dovuto * par.quotaPrimoAcconto),
    secondo: round2(dovuto * par.quotaSecondoAcconto),
    accontoUnico: false,
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

  const fattureCalcolate = ingresso.fatture.map((f) => calcolaFattura(f, imp, oggi));
  const costiCalcolati = ingresso.costi.map((c) => calcolaCosto(c, imp));

  // — A · Base di calcolo, per cassa ————————————————————————
  const incassateNellAnno = fattureCalcolate.filter(
    (f) => f.dataIncasso && annoDi(f.dataIncasso) === anno,
  );
  const emesseNellAnno = fattureCalcolate.filter((f) => annoDi(f.dataEmissione) === anno);
  const pagatiNellAnno = costiCalcolati.filter(
    (c) => c.dataPagamento && annoDi(c.dataPagamento) === anno,
  );

  const compensiIncassati = somma(...incassateNellAnno.map((f) => f.imponibile));
  const rivalsaIncassata = somma(...incassateNellAnno.map((f) => f.rivalsa));
  const ricaviRilevanti = somma(compensiIncassati, rivalsaIncassata);
  const ivaIncassata = somma(...incassateNellAnno.map((f) => f.iva));
  const incassatoLordo = somma(ricaviRilevanti, ivaIncassata);

  const costiPagatiTotale = somma(...pagatiNellAnno.map((c) => c.totale));
  const costiDeducibiliPagati = somma(...pagatiNellAnno.map((c) => c.costoDeducibile));
  const ivaDetraibilePagata = somma(...pagatiNellAnno.map((c) => c.ivaDetraibile));
  // Il bollo segue la data del documento: è dovuto all'emissione.
  const bolloACarico = somma(...emesseNellAnno.map((f) => f.bolloACarico));

  const fatturatoEmesso = somma(...emesseNellAnno.map((f) => f.ricavoRilevante));
  const inSospeso = somma(
    ...emesseNellAnno.filter((f) => !f.dataIncasso).map((f) => f.ricavoRilevante),
  );

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
  const addizionaleRegionale = forfettario
    ? 0
    : round2(imponibile * imp.addizionaleRegionale);
  const addizionaleComunale = forfettario ? 0 : round2(imponibile * imp.addizionaleComunale);
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
  const saldoResiduo = round2(nonNegativo(totaleDovuto - giaVersato));
  const acconti = calcolaAcconti(totaleDovuto, par);
  const daRateizzare = saldoResiduo + acconti.primo;
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

    fattureCalcolate,
    costiCalcolati,
  };
}

export { limita };
