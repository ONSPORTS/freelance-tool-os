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

/** I byte di una chiave pubblica Ed25519. */
const BYTE_ED25519 = 32;

/**
 * Il valore che ha `CHIAVE_PUBBLICA` prima che qualcuno generi una coppia.
 *
 * Sta qui, in un modulo che nessuno ha motivo di aprire, e non accanto alla
 * chiave: era esportato da `chiave-pubblica.ts` come `DA_CONFIGURARE`, e la
 * vicinanza invitava a incollare la chiave vera lì invece che in
 * `CHIAVE_PUBBLICA` — con il risultato che le due costanti restavano uguali,
 * il confronto d'identità continuava a dire «segnaposto» e l'app si comportava
 * come una build senza chiave, senza un errore da nessuna parte.
 *
 * Serve solo a scegliere le parole del messaggio. A decidere se la chiave c'è
 * è la sua forma, qui sotto.
 */
const SEGNAPOSTO = "DA-GENERARE";

/**
 * La chiave è utilizzabile?
 *
 * Il criterio è strutturale — 32 byte che si decodificano da base64url — e non
 * «diversa dal segnaposto». Una chiave vera passa perché *è* una chiave, non
 * perché non somiglia a qualcos'altro: nessun modo di riorganizzare
 * `chiave-pubblica.ts` può farla scambiare per un segnaposto. E ogni valore che
 * una chiave non è — il segnaposto, il vuoto, un incollato a metà — non passa.
 */
export function chiavePubblicaConfigurata(chiave: string): boolean {
  return daBase64Url(chiave)?.length === BYTE_ED25519;
}

/**
 * Perché la chiave non va bene, in una riga. `null` se va bene.
 * Distingue il segnaposto da una chiave rotta: sono due errori diversi.
 */
export function motivoChiavePubblica(chiave: string): string | null {
  if (chiavePubblicaConfigurata(chiave)) return null;
  if (chiave.trim() === "" || chiave === SEGNAPOSTO) {
    return `è ancora il segnaposto «${SEGNAPOSTO}»: nessuna coppia è mai stata generata.`;
  }
  const byte = daBase64Url(chiave);
  return `non è una chiave Ed25519: attesi ${BYTE_ED25519} byte in base64url, trovati ${
    byte ? `${byte.length} byte` : "caratteri non validi"
  }.`;
}

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
  if (chiavePubblicaConfigurata(chiave)) return null;

  if (chiave.trim() === "" || chiave === SEGNAPOSTO) {
    return blocco(
      `la chiave pubblica in ${FILE} ${motivoChiavePubblica(chiave)}`,
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

  return blocco(`la chiave pubblica in ${FILE} ${motivoChiavePubblica(chiave)}`, [
    "Di solito è un copia-incolla troncato: ricopia per intero la riga stampata da",
    `  ${COMANDO}`,
    "",
    "Meglio fermarsi qui che pubblicare un'app che rifiuta ogni licenza vera.",
  ]);
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
