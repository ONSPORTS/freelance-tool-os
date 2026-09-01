/**
 * Aritmetica del motore fiscale.
 *
 * Perché questo file esiste: `Math.round(4324.9 * 0.15 * 100) / 100` in JavaScript
 * restituisce 648,73, mentre Excel — e l'Agenzia delle Entrate — dicono 648,74.
 * Il prodotto in virgola mobile vale 648.73499999999989996: l'arrotondamento
 * ingenuo vede un 4 dove nella matematica decimale c'è un 5.
 * Un errore da un centesimo qui invalida l'intero prospetto, quindi ogni
 * arrotondamento del motore passa da `round2`.
 */

/** Cifre significative sufficienti a ripulire l'errore di rappresentazione binaria
 *  senza intaccare importi realistici (fino a ~10 miliardi al centesimo). */
const PRECISIONE = 15;

/**
 * Arrotonda a due decimali con la regola dell'esercizio contabile
 * (half away from zero), la stessa di ROUND() in Excel.
 */
export function round2(valore: number): number {
  if (!Number.isFinite(valore)) return 0;
  const segno = valore < 0 ? -1 : 1;
  const scalato = Number((Math.abs(valore) * 100).toPrecision(PRECISIONE));
  return (segno * Math.round(scalato)) / 100;
}

/** Arrotonda all'unità, half away from zero. */
export function round0(valore: number): number {
  if (!Number.isFinite(valore)) return 0;
  const segno = valore < 0 ? -1 : 1;
  return segno * Math.round(Number(Math.abs(valore).toPrecision(PRECISIONE)));
}

/** Somma di importi già arrotondati, senza accumulo di errore. */
export function somma(...valori: number[]): number {
  return round2(valori.reduce((acc, v) => acc + (Number.isFinite(v) ? v : 0), 0));
}

/** Rapporto sicuro: divisore nullo o non finito restituisce 0, non NaN né Infinity. */
export function rapporto(numeratore: number, denominatore: number): number {
  if (!denominatore || !Number.isFinite(denominatore) || !Number.isFinite(numeratore)) return 0;
  const r = numeratore / denominatore;
  return Number.isFinite(r) ? r : 0;
}

/** Vincola un valore fra due estremi. */
export function limita(valore: number, minimo: number, massimo: number): number {
  return Math.min(Math.max(valore, minimo), massimo);
}

/** Mai sotto zero: le imposte e i contributi non diventano negativi. */
export function nonNegativo(valore: number): number {
  return valore > 0 ? valore : 0;
}
