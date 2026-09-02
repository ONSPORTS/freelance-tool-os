/**
 * Il formato della chiave di licenza.
 *
 * Una licenza è un testo che l'acquirente incolla nell'app: contiene la sua
 * email e la data di scadenza, firmate con Ed25519. Nell'app c'è solo la
 * chiave pubblica, la verifica avviene nel browser e nessun dato esce dal
 * dispositivo — non c'è nessun server da interrogare, né qui né altrove.
 *
 * Questo modulo è la parte senza crittografia: come si scrive e come si legge
 * il testo della chiave. Puro, sincrono, verificabile.
 *
 * Formato: `FLW1.<carico>.<firma>`, entrambi in base64url.
 * La firma copre `FLW1.<carico>`, prefisso compreso: se un giorno il formato
 * cambia, una licenza v1 non si può far passare per una v2.
 */

export const PREFISSO = "FLW1";

/** Il contenuto firmato. Nomi di un carattere: la chiave si incolla a mano. */
export type Licenza = {
  /** Email dell'acquirente. Non è un identificatore, è una ricevuta. */
  email: string;
  /** Ultimo giorno di validità, ISO `yyyy-mm-dd`. Incluso. */
  scadenza: string;
  /** Quando è stata emessa, ISO. Serve solo a distinguere due chiavi. */
  emessaIl: string;
};

type CaricoGrezzo = { e?: unknown; s?: unknown; d?: unknown };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

// ————————————————————————————————————————————————————————————
// base64url senza dipendenze, uguale in Node e nel browser
// ————————————————————————————————————————————————————————————

const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function inBase64Url(byte: Uint8Array<ArrayBufferLike>): string {
  let out = "";
  for (let i = 0; i < byte.length; i += 3) {
    const a = byte[i];
    const b = byte[i + 1];
    const c = byte[i + 2];
    out += ALFABETO[a >> 2];
    out += ALFABETO[((a & 3) << 4) | ((b ?? 0) >> 4)];
    if (b === undefined) break;
    out += ALFABETO[((b & 15) << 2) | ((c ?? 0) >> 6)];
    if (c === undefined) break;
    out += ALFABETO[c & 63];
  }
  return out;
}

export function daBase64Url(testo: string): Uint8Array<ArrayBuffer> | null {
  const pulito = testo.trim();
  if (!/^[A-Za-z0-9_-]*$/.test(pulito)) return null;
  const byte: number[] = [];
  let accumulatore = 0;
  let bit = 0;
  for (const carattere of pulito) {
    const valore = ALFABETO.indexOf(carattere);
    if (valore < 0) return null;
    accumulatore = (accumulatore << 6) | valore;
    bit += 6;
    if (bit >= 8) {
      bit -= 8;
      byte.push((accumulatore >> bit) & 0xff);
    }
  }
  return Uint8Array.from(byte);
}

const CODIFICA = new TextEncoder();
const DECODIFICA = new TextDecoder();

// ————————————————————————————————————————————————————————————
// Scrittura e lettura della chiave
// ————————————————————————————————————————————————————————————

/** I byte che la firma deve coprire: `FLW1.<carico>`. */
export function daFirmare(caricoB64: string): Uint8Array<ArrayBuffer> {
  return CODIFICA.encode(`${PREFISSO}.${caricoB64}`);
}

/** Serializza il carico. Usata dallo script che emette le licenze. */
export function caricoDi(licenza: Licenza): string {
  return inBase64Url(
    CODIFICA.encode(
      JSON.stringify({ e: licenza.email, s: licenza.scadenza, d: licenza.emessaIl }),
    ),
  );
}

export function componiChiave(licenza: Licenza, firma: Uint8Array): string {
  return `${PREFISSO}.${caricoDi(licenza)}.${inBase64Url(firma)}`;
}

export type ChiaveScomposta = {
  licenza: Licenza;
  /** I byte firmati, da passare a `crypto.subtle.verify`. */
  messaggio: Uint8Array<ArrayBuffer>;
  firma: Uint8Array<ArrayBuffer>;
};

export type EsitoLettura =
  | { ok: true; chiave: ChiaveScomposta }
  | { ok: false; motivo: string };

/**
 * Legge una chiave incollata.
 *
 * Tollerante sulla forma — spazi, a capo, maiuscole del prefisso — perché
 * arriva da un copia-incolla da un'email, e severa sul contenuto. I motivi di
 * rifiuto sono in italiano e diretti all'utente: qui non c'è un log da
 * consultare, l'unico posto in cui l'errore può comparire è lo schermo.
 */
export function leggiChiave(testo: string): EsitoLettura {
  const pulito = testo.replace(/\s+/g, "");
  if (pulito === "") return { ok: false, motivo: "La chiave è vuota." };

  const parti = pulito.split(".");
  if (parti.length !== 3) {
    return { ok: false, motivo: "La chiave non ha la forma attesa: manca una delle tre parti." };
  }
  const [prefisso, caricoB64, firmaB64] = parti;
  if (prefisso.toUpperCase() !== PREFISSO) {
    return { ok: false, motivo: `Formato «${prefisso}» sconosciuto: questa versione legge ${PREFISSO}.` };
  }

  const caricoByte = daBase64Url(caricoB64);
  const firma = daBase64Url(firmaB64);
  if (!caricoByte || !firma) {
    return { ok: false, motivo: "La chiave contiene caratteri non validi: forse è stata troncata." };
  }
  if (firma.length !== 64) {
    return { ok: false, motivo: "La firma non ha la lunghezza di una firma Ed25519." };
  }

  let grezzo: CaricoGrezzo;
  try {
    grezzo = JSON.parse(DECODIFICA.decode(caricoByte)) as CaricoGrezzo;
  } catch {
    return { ok: false, motivo: "Il contenuto della chiave non è leggibile." };
  }

  const { e, s, d } = grezzo;
  if (typeof e !== "string" || e.trim() === "") {
    return { ok: false, motivo: "Nella chiave manca l'email dell'intestatario." };
  }
  if (typeof s !== "string" || !ISO.test(s)) {
    return { ok: false, motivo: "Nella chiave manca una data di scadenza valida." };
  }
  if (typeof d !== "string" || !ISO.test(d)) {
    return { ok: false, motivo: "Nella chiave manca la data di emissione." };
  }

  return {
    ok: true,
    chiave: {
      licenza: { email: e.trim(), scadenza: s, emessaIl: d },
      messaggio: daFirmare(caricoB64),
      firma,
    },
  };
}
