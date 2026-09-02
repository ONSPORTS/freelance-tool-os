/**
 * Ricerca fuzzy per sottosequenza, scritta a mano.
 *
 * Nessuna dipendenza: il progetto resta local-first e senza librerie, e per un
 * archivio da qualche centinaio di fatture un filtro lineare costa meno del
 * peso di un pacchetto in più. La regola è quella che ci si aspetta da una
 * palette: le lettere digitate devono comparire nell'ordine dato, non per forza
 * di seguito — «nvft» trova «nuova fattura», «2601» trova «2026/01».
 *
 * Il punteggio serve solo a ordinare, non ha un significato assoluto. Premia
 * le corrispondenze che iniziano una parola e quelle contigue, perché è così
 * che si scrive quando si sa già cosa si cerca.
 */

export type Riscontro = {
  punteggio: number;
  /** Indici (sul testo normalizzato, che ha la stessa lunghezza dell'originale) dei caratteri centrati. */
  indici: number[];
};

/**
 * Minuscolo e senza accenti, mantenendo la lunghezza: gli indici tornati da
 * `riscontro` devono poter evidenziare la stringa originale carattere per
 * carattere. `NFD` sposterebbe le posizioni, quindi le lettere accentate si
 * sostituiscono una a una.
 */
const ACCENTI: Record<string, string> = {
  à: "a", á: "a", â: "a", ä: "a", ã: "a", å: "a",
  è: "e", é: "e", ê: "e", ë: "e",
  ì: "i", í: "i", î: "i", ï: "i",
  ò: "o", ó: "o", ô: "o", ö: "o", õ: "o",
  ù: "u", ú: "u", û: "u", ü: "u",
  ç: "c", ñ: "n",
};

export function normalizza(testo: string): string {
  let out = "";
  for (const c of testo.toLowerCase()) out += ACCENTI[c] ?? c;
  return out;
}

const SEPARATORI = new Set([" ", "-", "/", ".", "_", ",", ":", "(", ")", "«", "»"]);

/**
 * Cerca `query` dentro `testo`.
 *
 * @returns `null` se una lettera manca, altrimenti punteggio e posizioni.
 * Una query vuota è un riscontro neutro: la palette senza testo mostra tutto.
 */
export function riscontro(testo: string, query: string): Riscontro | null {
  const q = normalizza(query.trim());
  if (q === "") return { punteggio: 0, indici: [] };

  const t = normalizza(testo);
  const indici: number[] = [];
  let punteggio = 0;
  let cursore = 0;
  let precedente = -2;

  for (const lettera of q) {
    if (lettera === " ") continue; // gli spazi della query non vincolano nulla
    const trovato = t.indexOf(lettera, cursore);
    if (trovato === -1) return null;

    punteggio += 1;
    // Contiguo alla lettera precedente: si sta digitando una parola intera.
    if (trovato === precedente + 1) punteggio += 6;
    // Inizio di parola: «nf» su «nuova fattura» vale più che su «confronto».
    if (trovato === 0 || SEPARATORI.has(t[trovato - 1])) punteggio += 8;

    indici.push(trovato);
    precedente = trovato;
    cursore = trovato + 1;
  }

  // Un tratto unico batte le stesse lettere sparse: «fat» deve trovare
  // «fatture» prima di «federico attilio tosi», dove pure ogni lettera apre
  // una parola. Il bonus vale solo se la query è coperta tutta di seguito.
  const contigua = indici.every((n, i) => i === 0 || n === indici[i - 1] + 1);
  if (contigua && indici.length > 1) {
    punteggio += 10;
    if (indici[0] === 0 || SEPARATORI.has(t[indici[0] - 1])) punteggio += 6;
  }

  // Più il riscontro comincia presto, meglio è: «cli» su «Clienti» prima che
  // su «Nuovo cliente». Sottrazione piccola, per non ribaltare i bonus sopra.
  punteggio -= Math.min(indici[0], 12) * 0.5;
  // Una corrispondenza che copre quasi tutto il testo è più probabile di una
  // che pesca tre lettere in una frase lunga.
  punteggio += (q.length / Math.max(t.length, 1)) * 6;

  return { punteggio, indici };
}

/** Il migliore fra più campi (etichetta, sinonimi, numero fattura…). */
export function riscontroMigliore(campi: readonly string[], query: string): Riscontro | null {
  let migliore: Riscontro | null = null;
  for (const campo of campi) {
    const r = riscontro(campo, query);
    if (r && (migliore === null || r.punteggio > migliore.punteggio)) migliore = r;
  }
  return migliore;
}

/** Spezza un testo nei tratti centrati dalla query, per l'evidenziazione. */
export function tratti(testo: string, indici: number[]): { testo: string; evidenziato: boolean }[] {
  if (indici.length === 0) return [{ testo, evidenziato: false }];
  const dentro = new Set(indici);
  const out: { testo: string; evidenziato: boolean }[] = [];
  for (let i = 0; i < testo.length; i++) {
    const ev = dentro.has(i);
    const ultimo = out[out.length - 1];
    if (ultimo && ultimo.evidenziato === ev) ultimo.testo += testo[i];
    else out.push({ testo: testo[i], evidenziato: ev });
  }
  return out;
}
