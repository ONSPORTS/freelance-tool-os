/**
 * Calendario civile italiano.
 *
 * Serve alle scadenze fiscali: quelle che cadono di sabato, di domenica o in un
 * giorno festivo slittano al primo giorno lavorativo successivo. L'Excel di
 * partenza lo diceva in nota ma non lo applicava, e mostrava date che nella
 * realtà non esistono.
 */

const GIORNO_MS = 86_400_000;

function iso(anno: number, mese: number, giorno: number): string {
  return `${anno}-${String(mese).padStart(2, "0")}-${String(giorno).padStart(2, "0")}`;
}

/**
 * Domenica di Pasqua secondo il computo gregoriano (algoritmo di Meeus/Butcher).
 * Serve solo a ricavare il lunedì dell'Angelo, che è festivo.
 */
export function pasqua(anno: number): string {
  const a = anno % 19;
  const b = Math.floor(anno / 100);
  const c = anno % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mese = Math.floor((h + l - 7 * m + 114) / 31);
  const giorno = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(anno, mese, giorno);
}

/** Le festività nazionali dell'anno, in formato aaaa-mm-gg. */
export function festivita(anno: number): Set<string> {
  const domenicaDiPasqua = new Date(`${pasqua(anno)}T00:00:00Z`);
  const lunediDellAngelo = new Date(domenicaDiPasqua.getTime() + GIORNO_MS)
    .toISOString()
    .slice(0, 10);
  return new Set([
    iso(anno, 1, 1),    // Capodanno
    iso(anno, 1, 6),    // Epifania
    lunediDellAngelo,
    iso(anno, 4, 25),   // Liberazione
    iso(anno, 5, 1),    // Festa del lavoro
    iso(anno, 6, 2),    // Festa della Repubblica
    iso(anno, 8, 15),   // Ferragosto
    iso(anno, 11, 1),   // Ognissanti
    iso(anno, 12, 8),   // Immacolata
    iso(anno, 12, 25),  // Natale
    iso(anno, 12, 26),  // Santo Stefano
  ]);
}

export function eFestivo(dataIso: string): boolean {
  const g = dataIso.slice(0, 10);
  const giornoSettimana = new Date(`${g}T00:00:00Z`).getUTCDay();
  if (giornoSettimana === 0 || giornoSettimana === 6) return true;
  return festivita(Number(g.slice(0, 4))).has(g);
}

/**
 * Sposta la data al primo giorno lavorativo utile, se serve.
 * Le festività patronali non sono considerate: variano per comune.
 */
export function slittaAGiornoLavorativo(dataIso: string): string {
  let g = dataIso.slice(0, 10);
  // Al massimo una settimana di festività consecutive: il ciclo termina sempre.
  for (let i = 0; i < 10 && eFestivo(g); i++) {
    g = new Date(new Date(`${g}T00:00:00Z`).getTime() + GIORNO_MS).toISOString().slice(0, 10);
  }
  return g;
}

/** Giorni che mancano alla data, rispetto al riferimento. Negativi se passata. */
export function giorniAllaData(dataIso: string, oggiIso: string): number {
  const a = Date.parse(`${dataIso.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${oggiIso.slice(0, 10)}T00:00:00Z`);
  return Math.round((a - b) / GIORNO_MS);
}
