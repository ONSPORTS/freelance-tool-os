/**
 * Il periodo osservato. Vive qui, puro e testabile, perché il selettore in
 * testa alla pagina ricalcola ogni schermata e non deve poter sbagliare.
 *
 * Attenzione a cosa filtra: i registri di fatture e costi si filtrano sulla
 * data del documento, non su quella di incasso o pagamento. Il calcolo delle
 * imposte resta annuale — scaglioni, massimali e soglie sono grandezze
 * dell'anno, e filtrare il prospetto a «marzo» produrrebbe un numero privo
 * di significato.
 */

export type TipoPeriodo = "anno" | "trimestre" | "mese" | "personalizzato";

export type Periodo = {
  tipo: TipoPeriodo;
  anno: number;
  /** 1-12, solo per il tipo «mese». */
  mese?: number;
  /** 1-4, solo per il tipo «trimestre». */
  trimestre?: number;
  /** Estremi inclusivi in formato aaaa-mm-gg, solo per «personalizzato». */
  da?: string;
  a?: string;
};

export type Intervallo = { da: string; a: string };

const NOMI_MESI = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];

function iso(anno: number, mese: number, giorno: number): string {
  return `${anno}-${String(mese).padStart(2, "0")}-${String(giorno).padStart(2, "0")}`;
}

function ultimoGiorno(anno: number, mese: number): number {
  return new Date(Date.UTC(anno, mese, 0)).getUTCDate();
}

/** Gli estremi inclusivi del periodo. */
export function intervallo(periodo: Periodo): Intervallo {
  const { anno } = periodo;
  switch (periodo.tipo) {
    case "mese": {
      const mese = Math.min(12, Math.max(1, periodo.mese ?? 1));
      return { da: iso(anno, mese, 1), a: iso(anno, mese, ultimoGiorno(anno, mese)) };
    }
    case "trimestre": {
      const trimestre = Math.min(4, Math.max(1, periodo.trimestre ?? 1));
      const primo = (trimestre - 1) * 3 + 1;
      const ultimo = primo + 2;
      return { da: iso(anno, primo, 1), a: iso(anno, ultimo, ultimoGiorno(anno, ultimo)) };
    }
    case "personalizzato": {
      const da = periodo.da ?? iso(anno, 1, 1);
      const a = periodo.a ?? iso(anno, 12, 31);
      // Estremi invertiti: li rimetto in ordine invece di restituire il vuoto.
      return da <= a ? { da, a } : { da: a, a: da };
    }
    default:
      return { da: iso(anno, 1, 1), a: iso(anno, 12, 31) };
  }
}

export function dentroPeriodo(dataIso: string | null | undefined, periodo: Periodo): boolean {
  if (!dataIso) return false;
  const { da, a } = intervallo(periodo);
  const g = dataIso.slice(0, 10);
  return g >= da && g <= a;
}

/** «Anno 2026», «2° trimestre 2026», «marzo 2026», «dal 3 al 18 aprile 2026». */
export function etichettaPeriodo(periodo: Periodo): string {
  switch (periodo.tipo) {
    case "mese":
      return `${NOMI_MESI[(periodo.mese ?? 1) - 1]} ${periodo.anno}`;
    case "trimestre":
      return `${periodo.trimestre ?? 1}° trimestre ${periodo.anno}`;
    case "personalizzato": {
      const { da, a } = intervallo(periodo);
      return `dal ${giornoLeggibile(da)} al ${giornoLeggibile(a)}`;
    }
    default:
      return `anno ${periodo.anno}`;
  }
}

function giornoLeggibile(dataIso: string): string {
  const [anno, mese, giorno] = dataIso.split("-").map(Number);
  return `${giorno} ${NOMI_MESI[mese - 1]} ${anno}`;
}

/** Il periodo copre l'anno intero: le grandezze annuali sono confrontabili. */
export function copreAnnoIntero(periodo: Periodo): boolean {
  const { da, a } = intervallo(periodo);
  return da === iso(periodo.anno, 1, 1) && a === iso(periodo.anno, 12, 31);
}

export function periodoAnno(anno: number): Periodo {
  return { tipo: "anno", anno };
}

/** Il trimestre che contiene il mese indicato. */
export function trimestreDi(mese: number): number {
  return Math.floor((Math.min(12, Math.max(1, mese)) - 1) / 3) + 1;
}
