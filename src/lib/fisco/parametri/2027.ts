import type { ParametriAnno } from "../tipi";
import { PARAMETRI_2026 } from "./2026";

/**
 * Parametri 2027 — provvisori.
 *
 * Alla data in cui questo file è stato scritto la Legge di Bilancio 2027 non
 * esiste ancora: aliquote, scaglioni, minimali e massimali qui sotto sono
 * quelli del 2026, ereditati per poter aprire l'anno e registrare documenti.
 *
 * Il flag `provvisorio` non è decorativo. Finché resta `true` l'interfaccia
 * dichiara che i numeri sono stimati e l'export del prospetto è bloccato: un
 * prospetto 2027 calcolato su aliquote 2026 è un numero plausibile e sbagliato,
 * ed è la categoria di errore che questo progetto tratta come la peggiore.
 *
 * A gennaio si sostituiscono i valori pubblicati, si aggiornano le fonti e si
 * mette `provvisorio: false`. Nient'altro.
 */
export const PARAMETRI_2027: ParametriAnno = {
  ...PARAMETRI_2026,
  anno: 2027,
  provvisorio: true,
  fonti: [
    "Valori 2026 ereditati in attesa della Legge di Bilancio 2027",
    "Da sostituire con la Legge di Bilancio 2027 e la circolare INPS sulle aliquote",
  ],
};
