/**
 * Liquidazione IVA.
 *
 * Unica parte del motore che non segue il principio di cassa: l'IVA guarda la
 * data del documento, non l'incasso o il pagamento.
 * In regime forfettario resta tutto a zero — niente IVA in fattura, niente
 * detrazione sugli acquisti — e la schermata si nasconde.
 */
import { nonNegativo, round2, somma } from "./aritmetica";
import { annoDi, meseDi } from "./documenti";
import type { CostoCalcolato, FatturaCalcolata, Impostazioni, ParametriAnno } from "./tipi";
import type { NotaCalcolata } from "./note";

export type PeriodoIva = {
  /** 1-12 per i mesi, 1-4 per i trimestri. */
  indice: number;
  etichetta: string;
  debito: number;
  credito: number;
  saldo: number;
  creditoPrecedente: number;
  daVersare: number;
  creditoANuovo: number;
  maggiorazione: number;
  totaleDaVersare: number;
  /** Data di versamento in ISO, o null se la periodicità non prevede il periodo. */
  scadenza: string | null;
};

export type LiquidazioneIva = {
  applicabile: boolean;
  periodicita: Impostazioni["periodicitaIva"];
  /** Credito IVA riportato dall'anno precedente, quando destinato a compensazione. */
  creditoIniziale: number;
  /**
   * IVA tolta dal debito dalle note di credito, mese per mese e in totale.
   * Voce a sé: un debito che cala senza dire perché non si controlla.
   */
  stornoNote: { perMese: number[]; totale: number };
  mesi: PeriodoIva[];
  trimestri: PeriodoIva[];
  totaleDebito: number;
  totaleCredito: number;
  saldoAnno: number;
  totaleDaVersare: number;
  creditoFinale: number;
};

const NOMI_MESI = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

/** Scadenze fisse della liquidazione trimestrale. */
const SCADENZE_TRIMESTRALI: [mese: number, giorno: number, annoSuccessivo: boolean][] = [
  [5, 16, false],
  [8, 20, false],
  [11, 16, false],
  [3, 16, true],
];

function iso(anno: number, mese: number, giorno: number): string {
  return `${anno}-${String(mese).padStart(2, "0")}-${String(giorno).padStart(2, "0")}`;
}

/**
 * @param creditoIniziale credito IVA che arriva dall'anno precedente. Entra come
 * riporto del primo periodo, esattamente come il credito di un periodo entra nel
 * successivo: un credito destinato a rimborso non passa di qui, resta zero.
 */
export function calcolaIva(
  fatture: FatturaCalcolata[],
  costi: CostoCalcolato[],
  imp: Impostazioni,
  par: ParametriAnno,
  creditoIniziale = 0,
  note: NotaCalcolata[] = [],
): LiquidazioneIva {
  const anno = imp.anno;
  const applicabile = imp.regime !== "forfettario";
  const mensile = imp.periodicitaIva === "mensile";

  // Le note seguono la data del documento come le fatture, e tolgono dal debito
  // del mese in cui sono emesse — non da quello in cui il denaro torna.
  const stornoMese = Array.from({ length: 12 }, (_, i) =>
    somma(
      ...note
        .filter((n) => annoDi(n.dataDocumento) === anno && meseDi(n.dataDocumento) === i + 1)
        .map((n) => n.iva),
    ),
  );
  const debitoMese = Array.from({ length: 12 }, (_, i) =>
    round2(
      somma(
        ...fatture
          .filter((f) => annoDi(f.dataEmissione) === anno && meseDi(f.dataEmissione) === i + 1)
          .map((f) => f.iva),
      ) - stornoMese[i],
    ),
  );
  const creditoMese = Array.from({ length: 12 }, (_, i) =>
    somma(
      ...costi
        .filter((c) => annoDi(c.dataDocumento) === anno && meseDi(c.dataDocumento) === i + 1)
        .map((c) => c.ivaDetraibile),
    ),
  );

  // Liquidazione mensile: il credito di un periodo si riporta al successivo.
  const mesi: PeriodoIva[] = [];
  let riporto = nonNegativo(creditoIniziale);
  for (let i = 0; i < 12; i++) {
    const saldo = round2(debitoMese[i] - creditoMese[i]);
    const daVersare = round2(nonNegativo(saldo - riporto));
    const creditoANuovo = round2(nonNegativo(riporto - saldo));
    mesi.push({
      indice: i + 1,
      etichetta: NOMI_MESI[i],
      debito: debitoMese[i],
      credito: creditoMese[i],
      saldo,
      creditoPrecedente: riporto,
      daVersare,
      creditoANuovo,
      maggiorazione: 0,
      totaleDaVersare: daVersare,
      scadenza: mensile
        ? i === 11
          ? iso(anno + 1, 1, 16)
          : iso(anno, i + 2, 16)
        : null,
    });
    riporto = creditoANuovo;
  }

  // Liquidazione trimestrale: la maggiorazione dell'1% non colpisce il quarto
  // trimestre, che confluisce nella dichiarazione annuale.
  const trimestri: PeriodoIva[] = [];
  riporto = nonNegativo(creditoIniziale);
  for (let t = 0; t < 4; t++) {
    const inizio = t * 3;
    const debito = somma(...debitoMese.slice(inizio, inizio + 3));
    const credito = somma(...creditoMese.slice(inizio, inizio + 3));
    const saldo = round2(debito - credito);
    const daVersare = round2(nonNegativo(saldo - riporto));
    const creditoANuovo = round2(nonNegativo(riporto - saldo));
    const applicaMaggiorazione = t < 3 || par.maggiorazioneSuQuartoTrimestre;
    const maggiorazione = applicaMaggiorazione
      ? round2(daVersare * imp.maggiorazioneTrimestrale)
      : 0;
    const [meseScadenza, giornoScadenza, annoDopo] = SCADENZE_TRIMESTRALI[t];
    trimestri.push({
      indice: t + 1,
      etichetta: `${t + 1}° trimestre`,
      debito,
      credito,
      saldo,
      creditoPrecedente: riporto,
      daVersare,
      creditoANuovo,
      maggiorazione,
      totaleDaVersare: round2(daVersare + maggiorazione),
      scadenza: mensile ? null : iso(anno + (annoDopo ? 1 : 0), meseScadenza, giornoScadenza),
    });
    riporto = creditoANuovo;
  }

  const periodi = mensile ? mesi : trimestri;
  const totaleDebito = somma(...debitoMese);
  const totaleCredito = somma(...creditoMese);

  return {
    applicabile,
    periodicita: imp.periodicitaIva,
    creditoIniziale: nonNegativo(creditoIniziale),
    stornoNote: { perMese: stornoMese, totale: somma(...stornoMese) },
    mesi,
    trimestri,
    totaleDebito,
    totaleCredito,
    saldoAnno: round2(totaleDebito - totaleCredito),
    totaleDaVersare: somma(...periodi.map((p) => p.totaleDaVersare)),
    creditoFinale: periodi[periodi.length - 1]?.creditoANuovo ?? 0,
  };
}

/**
 * Il periodo di liquidazione in cui cade una data.
 *
 * Serve al cruscotto, che dell'IVA deve dire una cosa sola: quanto esce alla
 * prossima scadenza. Non è il totale dell'anno né l'IVA incassata dai clienti —
 * quella è denaro che transita — ma il debito del periodo al netto dell'IVA
 * detraibile dello stesso periodo.
 *
 * Fuori dall'anno guardato si torna all'ultimo periodo: chi sfoglia il 2025 a
 * settembre 2026 vuole vedere come si è chiuso, non un periodo che non esiste.
 */
export function periodoIvaCorrente(
  iva: LiquidazioneIva,
  oggi: string,
  anno: number,
): PeriodoIva | null {
  if (!iva.applicabile) return null;
  const periodi = iva.periodicita === "mensile" ? iva.mesi : iva.trimestri;
  if (periodi.length === 0) return null;
  const ultimo = periodi[periodi.length - 1] ?? null;
  if (annoDi(oggi) !== anno) return ultimo;
  const mese = meseDi(oggi);
  const indice = iva.periodicita === "mensile" ? mese : Math.ceil(mese / 3);
  return periodi.find((p) => p.indice === indice) ?? ultimo;
}
