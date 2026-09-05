/**
 * La detrazione per redditi di lavoro autonomo, art. 13 comma 5 e 5-bis TUIR.
 *
 * È l'unica detrazione che spetta d'ufficio a chi ha una partita IVA in regime
 * ordinario: non va dichiarata, non dipende da spese sostenute, e nel 2026 vale
 * fino a 1.265 € l'anno. Mancava dal prospetto, e mancando faceva uscire
 * un'IRPEF più alta del vero per ogni reddito sotto i 50.000 €.
 *
 * La formula è a scaglioni ma non è progressiva come l'IRPEF: è una spezzata
 * decrescente sul **reddito complessivo**, non sull'imponibile. La differenza
 * conta — il reddito complessivo è prima della deduzione dei contributi — e
 * confonderli sposta la detrazione di qualche decina di euro senza che nessuno
 * se ne accorga.
 *
 * Modulo puro: qui c'è solo la formula, e i suoi casi limite si provano contro
 * numeri calcolati a mano.
 */
import { interoIt } from "@/lib/format";
import { round2 } from "./aritmetica";
import type { DetrazioneLavoroAutonomo } from "./tipi";

/** Perché la detrazione non spetta, quando non spetta. */
export type MotivoAssenza = "redditoNullo" | "oltreSoglia";

export type EsitoDetrazione = {
  /** Quanto spetta, prima del confronto con l'imposta lorda. */
  importo: number;
  /** La maggiorazione della fascia intermedia, già compresa in `importo`. */
  maggiorazione: number;
  /** `null` quando la detrazione spetta. */
  assente: MotivoAssenza | null;
  /** La formula applicata, in italiano, con dentro i numeri di chi legge. */
  descrizione: string;
};

/**
 * La detrazione spettante su un reddito complessivo.
 *
 * @param reddito reddito **complessivo**: nel nostro modello è il reddito lordo
 * dell'attività, prima della deduzione di contributi e oneri. L'app conosce
 * solo i redditi dell'attività: chi ha anche un lavoro dipendente o una casa
 * affittata ha un reddito complessivo più alto e una detrazione più bassa, e il
 * prospetto lo dichiara.
 */
export function detrazioneLavoroAutonomo(
  reddito: number,
  d: DetrazioneLavoroAutonomo,
): EsitoDetrazione {
  const niente = (assente: MotivoAssenza, descrizione: string): EsitoDetrazione => ({
    importo: 0,
    maggiorazione: 0,
    assente,
    descrizione,
  });

  if (reddito <= 0) {
    return niente("redditoNullo", "Nessuna detrazione: non c'è reddito da cui detrarre.");
  }
  if (reddito > d.sogliaAzzeramento) {
    return niente(
      "oltreSoglia",
      `Nessuna detrazione: sopra ${intero(d.sogliaAzzeramento)} € di reddito complessivo non spetta più.`,
    );
  }

  let base: number;
  let descrizione: string;
  if (reddito <= d.sogliaPiena) {
    base = d.importoPieno;
    descrizione = `Detrazione piena: fino a ${intero(d.sogliaPiena)} € di reddito complessivo spettano ${intero(d.importoPieno)} €.`;
  } else if (reddito <= d.sogliaMedia) {
    const quota = (d.sogliaMedia - reddito) / (d.sogliaMedia - d.sogliaPiena);
    base = d.importoFisso + d.quotaDecrescente * quota;
    descrizione =
      `${intero(d.importoFisso)} € più ${intero(d.quotaDecrescente)} € × ` +
      `(${intero(d.sogliaMedia)} − ${arrotondato(reddito)}) ÷ ${intero(d.sogliaMedia - d.sogliaPiena)}.`;
  } else {
    const quota = (d.sogliaAzzeramento - reddito) / (d.sogliaAzzeramento - d.sogliaMedia);
    base = d.importoFisso * quota;
    descrizione =
      `${intero(d.importoFisso)} € × (${intero(d.sogliaAzzeramento)} − ${arrotondato(reddito)}) ÷ ` +
      `${intero(d.sogliaAzzeramento - d.sogliaMedia)}: si azzera a ${intero(d.sogliaAzzeramento)} €.`;
  }

  // La maggiorazione della fascia intermedia è un gradino, non una spezzata: o
  // c'è tutta o non c'è. Sta fuori dal calcolo proporzionale apposta.
  const m = d.maggiorazione;
  const spetta = reddito > m.da && reddito <= m.a;
  const maggiorazione = spetta ? m.importo : 0;
  if (spetta) {
    descrizione += ` Più ${intero(m.importo)} € di maggiorazione, che spetta fra ${intero(m.da)} € e ${intero(m.a)} €.`;
  }

  return {
    importo: round2(base + maggiorazione),
    maggiorazione,
    assente: null,
    descrizione,
  };
}

/** Le soglie di legge dentro la frase: intere, dal formatter condiviso. */
function intero(n: number): string {
  return interoIt.format(n);
}

function arrotondato(n: number): string {
  return `${intero(Math.round(n))} €`;
}
