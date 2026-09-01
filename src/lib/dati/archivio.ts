import type { StorageAdapter } from "./adapter";
import { DexieAdapter } from "./dexie-adapter";

/**
 * L'archivio dell'applicazione. Creato pigramente e solo nel browser:
 * durante la generazione statica non esiste IndexedDB, e non deve esistere
 * nemmeno il tentativo di aprirlo.
 */
let istanza: StorageAdapter | null = null;

export function archivio(): StorageAdapter {
  if (typeof window === "undefined") {
    throw new Error(
      "L'archivio è disponibile solo nel browser: i dati non lasciano il dispositivo.",
    );
  }
  if (!istanza) istanza = new DexieAdapter();
  return istanza;
}

/** Sostituisce l'implementazione. Serve ai test e a un eventuale adapter cloud. */
export function impostaArchivio(adapter: StorageAdapter | null): void {
  istanza = adapter;
}
