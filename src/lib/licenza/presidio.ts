/**
 * Il presidio sulla chiave pubblica, in fase di build.
 *
 * Il segnaposto è comodo in sviluppo: l'app dichiara di non poter verificare
 * niente, non fa scadere la prova e non blocca nessuno. In produzione la stessa
 * regola è un disastro silenzioso — l'app esce senza alcun controllo di licenza
 * e senza un sintomo che lo faccia notare, finché non se ne accorge qualcun
 * altro. Perciò con `NODE_ENV=production` il build si ferma.
 *
 * Modulo puro e senza dipendenze: lo importa `next.config.ts`, che gira in Node
 * prima di qualunque cosa React.
 */
import { daBase64Url } from "./chiave";
import { DA_CONFIGURARE } from "./chiave-pubblica";

/** I byte di una chiave pubblica Ed25519. */
const BYTE_ED25519 = 32;

const COMANDO = "node strumenti/licenza/genera-licenza.mjs --nuove-chiavi";
const FILE = "src/lib/licenza/chiave-pubblica.ts";

/**
 * @returns `null` se si può procedere, altrimenti il messaggio con cui fermare
 * il build. Restituisce invece di lanciare perché così si può verificare.
 */
export function controlloChiavePubblica(
  chiave: string,
  ambiente: string | undefined,
): string | null {
  if (ambiente !== "production") return null;

  if (chiave === DA_CONFIGURARE || chiave.trim() === "") {
    return blocco(
      `la chiave pubblica in ${FILE} è ancora il segnaposto «${DA_CONFIGURARE}».`,
      [
        "Un build di produzione con il segnaposto pubblicherebbe l'app senza",
        "nessun controllo di licenza — e senza nessun sintomo visibile.",
        "",
        "  1. Genera la coppia (una volta sola, sul computer da cui emetti le licenze):",
        `       ${COMANDO}`,
        "",
        `  2. Incolla la chiave pubblica che stampa in ${FILE}`,
        "",
        "La chiave privata resta in strumenti/licenza/chiavi/, che è in .gitignore.",
        "In sviluppo il segnaposto continua a funzionare: `next dev` non passa di qui.",
      ],
    );
  }

  const byte = daBase64Url(chiave);
  if (!byte || byte.length !== BYTE_ED25519) {
    return blocco(
      `la chiave pubblica in ${FILE} non è una chiave Ed25519 valida.`,
      [
        `Attese ${BYTE_ED25519} byte in base64url, trovati ${byte ? byte.length : "caratteri non validi"}.`,
        "Di solito è un copia-incolla troncato: ricopia per intero la riga stampata da",
        `  ${COMANDO}`,
        "",
        "Meglio fermarsi qui che pubblicare un'app che rifiuta ogni licenza vera.",
      ],
    );
  }

  return null;
}

function blocco(sommario: string, righe: string[]): string {
  return [
    "",
    "  ┌─ Build fermato: chiave di licenza non configurata",
    `  │  ${sommario}`,
    "  │",
    ...righe.map((r) => `  │  ${r}`.trimEnd()),
    "  └─",
    "",
  ].join("\n");
}
