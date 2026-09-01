/**
 * Entità che non appartengono al motore fiscale: anagrafiche e movimenti
 * che l'utente compila a mano.
 */
import type { Costo, Fattura, Impostazioni, VersamentoF24 } from "@/lib/fisco/tipi";

export type Cliente = {
  id: string;
  nome: string;
  /** Sovrascrive il colore derivato dal nome. Di norma resta vuoto. */
  colore?: string;
  canaleAcquisizione: string;
  note: string;
};

/** Un mese di finanze personali. `mese` va da 1 a 12, `anno` lo qualifica. */
export type MovimentoPersonale = {
  id: string;
  anno: number;
  mese: number;
  prelievi: number;
  altreEntrate: number;
  speseFisse: number;
  speseVariabili: number;
  risparmio: number;
};

/**
 * Entrate e uscite dell'attività che non passano dai registri: rimborsi,
 * interessi, commissioni bancarie. Servono al cashflow, che altrimenti
 * non quadra con l'estratto conto.
 */
export type MovimentoAttivita = {
  id: string;
  anno: number;
  mese: number;
  altreEntrate: number;
  altreUscite: number;
};

/**
 * La spunta di un adempimento dello scadenzario. Non è un dato fiscale: è la
 * memoria di ciò che l'utente ha dichiarato di aver fatto.
 */
export type SpuntaAdempimento = {
  /** `${anno}:${idAdempimento}`, così la spunta segue l'anno. */
  id: string;
  anno: number;
  idAdempimento: string;
  completatoIl: string;
};

export type VocePatrimonio = {
  id: string;
  tipo: "attivo" | "passivo";
  categoria: string;
  descrizione: string;
  valore: number;
};

export type { Costo, Fattura, Impostazioni, VersamentoF24 };

/** Le otto collezioni persistite. Il nome è anche la chiave nel file di backup. */
export const COLLEZIONI = [
  "impostazioni",
  "clienti",
  "fatture",
  "costi",
  "movimentiPersonali",
  "movimentiAttivita",
  "versamenti",
  "patrimonio",
  "spunte",
] as const;

export type NomeCollezione = (typeof COLLEZIONI)[number];

export type Dati = {
  impostazioni: Impostazioni[];
  clienti: Cliente[];
  fatture: Fattura[];
  costi: Costo[];
  movimentiPersonali: MovimentoPersonale[];
  movimentiAttivita: MovimentoAttivita[];
  versamenti: VersamentoF24[];
  patrimonio: VocePatrimonio[];
  spunte: SpuntaAdempimento[];
};

export function datiVuoti(): Dati {
  return {
    impostazioni: [],
    clienti: [],
    fatture: [],
    costi: [],
    movimentiPersonali: [],
    movimentiAttivita: [],
    versamenti: [],
    patrimonio: [],
    spunte: [],
  };
}

/** Identificatore locale: nessun server a cui chiederlo. */
export function nuovoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
