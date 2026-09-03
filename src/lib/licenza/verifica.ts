/**
 * La verifica della firma, con Web Crypto.
 *
 * Ed25519 su `crypto.subtle`: nessuna libreria, nessuna richiesta di rete,
 * niente che esca dal browser. L'app conosce solo la chiave pubblica — con
 * quella si verifica, non si emette: chi legge il sorgente non può fabbricare
 * licenze.
 *
 * Nessun tentativo di offuscamento o di anti-manomissione. Un controllo che
 * gira sul dispositivo di chi lo deve subire si aggira per definizione: questo
 * codice serve a dire a un cliente onesto quando la sua licenza è finita, non
 * a fermare chi non vuole essere fermato.
 */
import { daBase64Url, leggiChiave, type Licenza } from "./chiave";
import { CHIAVE_PUBBLICA } from "./chiave-pubblica";
import { chiavePubblicaConfigurata, motivoChiavePubblica } from "./presidio";

export type EsitoVerifica =
  | { ok: true; licenza: Licenza }
  | { ok: false; motivo: string; verificabile: boolean };

const importate = new Map<string, Promise<CryptoKey>>();

function importaChiavePubblica(pubblicaB64: string): Promise<CryptoKey> {
  const gia = importate.get(pubblicaB64);
  if (gia) return gia;

  const promessa = (async () => {
    const byte = daBase64Url(pubblicaB64);
    if (!byte || byte.length !== 32) {
      throw new Error("La chiave pubblica incorporata non è una chiave Ed25519.");
    }
    return crypto.subtle.importKey("raw", byte, { name: "Ed25519" }, false, ["verify"]);
  })();
  // Un import fallito non resta in cache: al prossimo tentativo (browser
  // aggiornato, altra scheda) si riprova.
  promessa.catch(() => importate.delete(pubblicaB64));
  importate.set(pubblicaB64, promessa);
  return promessa;
}

/**
 * Verifica una chiave incollata.
 *
 * @param pubblicaB64 la chiave pubblica da usare. Iniettabile perché i test
 * possano firmare con una coppia generata al volo: la chiave vera non è nel
 * repository, e una suite che dipendesse da lei non girerebbe da nessuna parte.
 *
 * @returns `verificabile: false` quando è il browser a non saper fare Ed25519,
 * non la chiave a essere sbagliata. Chi chiama tratta i due casi in modo
 * diverso: nel primo l'app non blocca nessuno.
 */
export async function verificaChiave(
  testo: string,
  pubblicaB64: string = CHIAVE_PUBBLICA,
): Promise<EsitoVerifica> {
  if (!chiavePubblicaConfigurata(pubblicaB64)) {
    return {
      ok: false,
      verificabile: false,
      motivo: `Questa build non ha una chiave pubblica utilizzabile: ${motivoChiavePubblica(pubblicaB64)} Nessuna licenza può essere verificata.`,
    };
  }

  const lettura = leggiChiave(testo);
  if (!lettura.ok) return { ok: false, motivo: lettura.motivo, verificabile: true };

  const { licenza, messaggio, firma } = lettura.chiave;

  let pubblica: CryptoKey;
  try {
    pubblica = await importaChiavePubblica(pubblicaB64);
  } catch {
    return {
      ok: false,
      verificabile: false,
      motivo:
        "Questo browser non sa verificare le firme Ed25519. Aggiornalo, oppure aprine uno più recente.",
    };
  }

  let valida = false;
  try {
    valida = await crypto.subtle.verify("Ed25519", pubblica, firma, messaggio);
  } catch {
    return {
      ok: false,
      verificabile: false,
      motivo: "Questo browser non sa verificare le firme Ed25519.",
    };
  }

  if (!valida) {
    return {
      ok: false,
      verificabile: true,
      motivo: "La firma non corrisponde: la chiave è stata modificata o non è di Flowlance.",
    };
  }
  return { ok: true, licenza };
}
