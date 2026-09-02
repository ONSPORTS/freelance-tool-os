import type { StorageAdapter } from "./adapter";
import { DexieAdapter } from "./dexie-adapter";
import { conSolaLettura } from "./sola-lettura";

/**
 * L'archivio dell'applicazione. Creato pigramente e solo nel browser:
 * durante la generazione statica non esiste IndexedDB, e non deve esistere
 * nemmeno il tentativo di aprirlo.
 */
let istanza: StorageAdapter | null = null;

/**
 * La sola lettura, decisa altrove e interrogata a ogni scrittura.
 *
 * È una funzione e non un booleano perché la licenza può scadere mentre l'app
 * è aperta. Predefinita a «si scrive»: un archivio che si blocca da solo per
 * un errore di configurazione sarebbe il danno peggiore.
 */
let bloccato: () => boolean = () => false;

/** Chiamata dallo stato della licenza al montaggio del guscio. */
export function impostaSolaLettura(predicato: () => boolean): void {
  bloccato = predicato;
}

export function archivio(): StorageAdapter {
  if (typeof window === "undefined") {
    throw new Error(
      "L'archivio è disponibile solo nel browser: i dati non lasciano il dispositivo.",
    );
  }
  if (!istanza) istanza = conSolaLettura(new DexieAdapter(), () => bloccato());
  return istanza;
}

/**
 * Sostituisce l'implementazione. Serve ai test e a un eventuale adapter cloud.
 *
 * Anche questa passa dalla guardia: un adapter di prova che scrivesse a licenza
 * scaduta renderebbe verde un test che nella vita reale fallisce.
 */
export function impostaArchivio(adapter: StorageAdapter | null): void {
  istanza = adapter === null ? null : conSolaLettura(adapter, () => bloccato());
}
