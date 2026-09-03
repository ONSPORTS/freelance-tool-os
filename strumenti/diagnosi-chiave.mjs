#!/usr/bin/env node
/**
 * Che cosa vede davvero l'app quando cerca la chiave pubblica.
 *
 *   npm run licenza:stato
 *
 * Serve quando l'app dice di non avere una chiave e il file sembra a posto.
 * Stampa ogni costante esportata da `chiave-pubblica.ts`, la lunghezza in byte
 * una volta decodificata, il verdetto, e le righe di codice del file — se una
 * costante è stata modificata al posto di un'altra, si vede a colpo d'occhio.
 *
 * Non importa `presidio.ts`: quel modulo usa gli import senza estensione del
 * bundler, che Node da solo non risolve. La regola è riscritta qui in due
 * righe, ed è la stessa — «32 byte in base64url» — fissata dai test in
 * `src/lib/licenza/licenza.test.ts`.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RADICE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = resolve(RADICE, "src/lib/licenza/chiave-pubblica.ts");
const BYTE_ED25519 = 32;
const SEGNAPOSTO = "DA-GENERARE";

const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
function byteDi(testo) {
  if (typeof testo !== "string" || !/^[A-Za-z0-9_-]+$/.test(testo.trim())) return null;
  let bit = 0;
  for (const c of testo.trim()) {
    if (ALFABETO.indexOf(c) < 0) return null;
    bit += 6;
  }
  return Math.floor(bit / 8);
}

const modulo = await import(`file://${FILE}`);

console.log(`\n  File: ${FILE}\n`);
console.log("  Costanti esportate:");
for (const [nome, valore] of Object.entries(modulo)) {
  if (typeof valore !== "string") continue;
  const byte = byteDi(valore);
  console.log(
    `    ${nome.padEnd(16)} = ${JSON.stringify(valore)}  →  ${
      byte === null ? "non è base64url" : `${byte} byte`
    }`,
  );
}

// La seconda ipotesi da escludere: la chiave si legge solo dal file.
const ambiente = Object.keys(process.env).filter((k) => /CHIAVE|LICEN|PUBLIC_KEY/i.test(k));
console.log(
  `\n  Variabili d'ambiente che potrebbero interferire: ${
    ambiente.length ? ambiente.join(", ") : "nessuna — la chiave si legge solo da questo file"
  }`,
);

const chiave = modulo.CHIAVE_PUBBLICA;
const byte = byteDi(chiave);
const ok = byte === BYTE_ED25519;
console.log(`\n  Quello che l'app usa: CHIAVE_PUBBLICA = ${JSON.stringify(chiave)}`);
console.log(`  Verdetto: ${ok ? "CONFIGURATA — le licenze si verificano" : "NON configurata"}`);
if (!ok) {
  console.log(
    `  Perché:   ${
      chiave === SEGNAPOSTO || String(chiave).trim() === ""
        ? `è ancora il segnaposto «${SEGNAPOSTO}»: genera la coppia con`
        : `attesi ${BYTE_ED25519} byte in base64url, trovati ${byte === null ? "caratteri non validi" : `${byte} byte`}. Ricopia la riga stampata da`
    }`,
  );
  console.log("            node strumenti/licenza/genera-licenza.mjs --nuove-chiavi");
}

console.log("\n  Righe di codice nel file:");
for (const riga of readFileSync(FILE, "utf8").split("\n")) {
  const t = riga.trim();
  if (t && !t.startsWith("*") && !t.startsWith("/*") && !t.startsWith("//")) {
    console.log(`    ${t}`);
  }
}
console.log();
