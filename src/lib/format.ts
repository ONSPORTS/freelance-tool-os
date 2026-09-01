/**
 * Formattazione italiana. Ogni importo che l'utente legge passa da qui:
 * 1.234,56 €, mai €1,234.56.
 */
import { format as formatDate, parseISO } from "date-fns";
import { it } from "date-fns/locale";

/**
 * `useGrouping: "always"` non è un dettaglio: con l'impostazione predefinita
 * alcune versioni di ICU applicano il raggruppamento «min2» e scrivono
 * 1234,56 € invece di 1.234,56 €. Il risultato cambia fra il rendering sul
 * server e quello nel browser, e il prodotto mostra due forme diverse dello
 * stesso importo. Qui il raggruppamento è imposto ovunque.
 */
const OPZIONI_BASE = { useGrouping: "always" } as const;

const valuta = new Intl.NumberFormat("it-IT", {
  ...OPZIONI_BASE,
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const valutaCompatta = new Intl.NumberFormat("it-IT", {
  ...OPZIONI_BASE,
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const numero = new Intl.NumberFormat("it-IT", {
  ...OPZIONI_BASE,
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Intero con separatore di migliaia: 122.295. Usato anche dal motore fiscale. */
export const interoIt = new Intl.NumberFormat("it-IT", {
  ...OPZIONI_BASE,
  maximumFractionDigits: 0,
});

/** 1.234,56 € */
export function euro(valore: number | null | undefined): string {
  if (valore == null || !Number.isFinite(valore)) return "—";
  return valuta.format(valore);
}

/** 1.235 € — per i titoloni dove i centesimi sono rumore. */
export function euroTondo(valore: number | null | undefined): string {
  if (valore == null || !Number.isFinite(valore)) return "—";
  return valutaCompatta.format(valore);
}

/** 28,98 % — il valore in ingresso è una frazione (0,2898). */
export function percentuale(frazione: number | null | undefined, decimali = 2): string {
  if (frazione == null || !Number.isFinite(frazione)) return "—";
  return `${new Intl.NumberFormat("it-IT", {
    ...OPZIONI_BASE,
    minimumFractionDigits: decimali,
    maximumFractionDigits: decimali,
  }).format(frazione * 100)} %`;
}

/** +12,4 % oppure −3,1 %, con il segno esplicito per i chip di variazione. */
export function variazione(frazione: number | null | undefined, decimali = 1): string {
  if (frazione == null || !Number.isFinite(frazione)) return "—";
  const segno = frazione > 0 ? "+" : frazione < 0 ? "−" : "";
  return `${segno}${new Intl.NumberFormat("it-IT", {
    ...OPZIONI_BASE,
    minimumFractionDigits: decimali,
    maximumFractionDigits: decimali,
  }).format(Math.abs(frazione) * 100)} %`;
}

export function num(valore: number | null | undefined): string {
  if (valore == null || !Number.isFinite(valore)) return "—";
  return numero.format(valore);
}

/** 15/01/2026 */
export function data(valore: Date | string | null | undefined): string {
  if (!valore) return "—";
  const d = typeof valore === "string" ? parseISO(valore) : valore;
  if (Number.isNaN(d.getTime())) return "—";
  return formatDate(d, "dd/MM/yyyy", { locale: it });
}

/** 15 gennaio 2026 */
export function dataEstesa(valore: Date | string | null | undefined): string {
  if (!valore) return "—";
  const d = typeof valore === "string" ? parseISO(valore) : valore;
  if (Number.isNaN(d.getTime())) return "—";
  return formatDate(d, "d MMMM yyyy", { locale: it });
}

/** gennaio, febbraio, … — indice 1-12. */
export function nomeMese(indice: number): string {
  return formatDate(new Date(2026, indice - 1, 1), "MMMM", { locale: it });
}

/** Gen, Feb, … per gli assi dei grafici. */
export function meseBreve(indice: number): string {
  const s = formatDate(new Date(2026, indice - 1, 1), "MMM", { locale: it });
  return s.charAt(0).toUpperCase() + s.slice(1).replace(".", "");
}

/** AS, MR — iniziali per gli avatar cliente. */
export function iniziali(nome: string): string {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}

/** Colore stabile derivato dal nome: stesso cliente, stesso colore, sempre. */
export function coloreDaNome(nome: string): string {
  const tavolozza = [
    "#4C5BF5", "#0EA5E9", "#10B981", "#F5A524",
    "#E5484D", "#8B5CF6", "#EC4899", "#14B8A6",
  ];
  let somma = 0;
  for (let i = 0; i < nome.length; i++) somma = (somma * 31 + nome.charCodeAt(i)) >>> 0;
  return tavolozza[somma % tavolozza.length];
}
