import type { ParametriAnno } from "../tipi";
import { PARAMETRI_2026 } from "./2026";

/**
 * Registro dei parametri per anno. Aggiungere il 2027 significa creare
 * `parametri/2027.ts` e aggiungere una riga qui.
 */
export const PARAMETRI_PER_ANNO: Record<number, ParametriAnno> = {
  2026: PARAMETRI_2026,
};

export const ANNO_PIU_RECENTE = Math.max(...Object.keys(PARAMETRI_PER_ANNO).map(Number));

/**
 * Parametri dell'anno richiesto. Per un anno non ancora censito restituisce
 * quelli dell'anno più recente disponibile: meglio una stima dichiarata che un errore.
 */
export function parametriDi(anno: number): ParametriAnno {
  return PARAMETRI_PER_ANNO[anno] ?? PARAMETRI_PER_ANNO[ANNO_PIU_RECENTE];
}

/** L'anno richiesto ha parametri propri, o stiamo estrapolando? */
export function parametriSonoDellAnno(anno: number): boolean {
  return anno in PARAMETRI_PER_ANNO;
}

export { PARAMETRI_2026 };
