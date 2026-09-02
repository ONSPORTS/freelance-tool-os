/**
 * Attribuzione dei documenti agli anni.
 *
 * Ogni documento porta due date che possono cadere in anni diversi: la data del
 * documento e la data in cui il denaro si muove davvero. Le imposte sul reddito
 * seguono la seconda (principio di cassa), l'IVA la prima (data del documento).
 *
 * Una fattura emessa a dicembre e incassata a gennaio è ricavo dell'anno nuovo
 * e IVA dell'anno vecchio. Un costo con documento a dicembre e pagato a gennaio
 * è deduzione dell'anno nuovo e IVA detraibile dell'anno vecchio. È la stessa
 * regola applicata ai due lati, e qui sta scritta una volta sola: se un giorno
 * cambia, cambia per entrambi.
 */
import { annoDi } from "./documenti";
import type { Costo, Fattura } from "./tipi";

/** Le due date di un documento, spogliate di tutto il resto. */
export type DateDocumento = {
  /** Data del documento: comanda sull'IVA e sul bollo. */
  documento: string;
  /** Data del movimento di cassa: comanda sulle imposte sul reddito. `null` se non è ancora avvenuto. */
  cassa: string | null;
};

export function dateFattura(f: Pick<Fattura, "dataEmissione" | "dataIncasso">): DateDocumento {
  return { documento: f.dataEmissione, cassa: f.dataIncasso ?? null };
}

export function dateCosto(c: Pick<Costo, "dataDocumento" | "dataPagamento">): DateDocumento {
  return { documento: c.dataDocumento, cassa: c.dataPagamento ?? null };
}

export type Ripartizione<T> = {
  /** Movimento di cassa nell'anno: è la base delle imposte sul reddito. */
  perCassa: T[];
  /** Documento datato nell'anno: è la base dell'IVA e del bollo. */
  perCompetenza: T[];
  /** Documento dell'anno, cassa in un anno precedente (acconti, pagamenti anticipati). */
  cassaAnticipata: T[];
  /** Documento dell'anno, cassa in un anno successivo: entra nelle imposte dopo. */
  versoAnniSuccessivi: T[];
  /** Documento dell'anno, cassa mai avvenuta: sospeso, non ha ancora un anno d'imposta. */
  sospesi: T[];
  /** Cassa nell'anno su documenti di anni precedenti: reddito di quest'anno, IVA già liquidata. */
  daAnniPrecedenti: T[];
};

/**
 * Divide un elenco di documenti secondo i due criteri.
 *
 * Le prime due liste non sono alternative: un documento emesso e incassato
 * nello stesso anno sta in entrambe, ed è il caso normale. Le altre quattro
 * isolano i documenti a cavallo, che sono quelli su cui si sbaglia.
 */
export function ripartisci<T>(
  righe: readonly T[],
  anno: number,
  date: (riga: T) => DateDocumento,
): Ripartizione<T> {
  const r: Ripartizione<T> = {
    perCassa: [],
    perCompetenza: [],
    cassaAnticipata: [],
    versoAnniSuccessivi: [],
    sospesi: [],
    daAnniPrecedenti: [],
  };

  for (const riga of righe) {
    const { documento, cassa } = date(riga);
    const annoDocumento = annoDi(documento);
    const annoCassa = cassa ? annoDi(cassa) : null;

    if (annoCassa === anno) r.perCassa.push(riga);
    if (annoDocumento === anno) r.perCompetenza.push(riga);

    if (annoDocumento === anno) {
      if (annoCassa === null) r.sospesi.push(riga);
      else if (annoCassa > anno) r.versoAnniSuccessivi.push(riga);
      else if (annoCassa < anno) r.cassaAnticipata.push(riga);
    }
    if (annoCassa === anno && annoDocumento < anno) r.daAnniPrecedenti.push(riga);
  }

  return r;
}

/** Il documento attraversa il confine fra due anni d'imposta. */
export function aCavallo(date: DateDocumento): boolean {
  return date.cassa !== null && annoDi(date.cassa) !== annoDi(date.documento);
}

/** Gli anni toccati da un insieme di documenti, in ordine crescente. */
export function anniCoinvolti(elenco: readonly DateDocumento[]): number[] {
  const anni = new Set<number>();
  for (const d of elenco) {
    anni.add(annoDi(d.documento));
    if (d.cassa) anni.add(annoDi(d.cassa));
  }
  return [...anni].sort((a, b) => a - b);
}
