"use client";

import { toast } from "@/components/ui/toast";
import { archivio } from "./archivio";
import type { Costo, Fattura } from "./tipi";
import { nuovoId } from "./tipi";

/**
 * Le scritture, con salvataggio ottimistico e annullamento.
 *
 * Ogni modifica va a buon fine subito nell'interfaccia — la tabella è reattiva
 * sull'archivio, quindi «ottimistico» qui significa che non c'è nessuna attesa
 * di rete da mostrare — e il toast tiene per qualche secondo il valore
 * precedente, così un errore di battitura si ripara senza cercare la riga.
 */

async function conAnnullamento<T extends { id: string }>(
  deposito: {
    leggi(id: string): Promise<T | undefined>;
    salva(v: T): Promise<string>;
    elimina(id: string): Promise<void>;
  },
  id: string,
  messaggio: string,
  azione: () => Promise<void>,
): Promise<void> {
  const precedente = await deposito.leggi(id);
  await azione();
  toast.conferma(messaggio, async () => {
    if (precedente) await deposito.salva(precedente);
    else await deposito.elimina(id);
  });
}

// ————————————————————————————————————————————————————————————
// Fatture
// ————————————————————————————————————————————————————————————

export async function salvaFattura(fattura: Fattura, messaggio = "Fattura aggiornata") {
  await conAnnullamento(archivio().fatture, fattura.id, messaggio, async () => {
    await archivio().fatture.salva(fattura);
  });
}

export async function creaFattura(fattura: Omit<Fattura, "id">): Promise<Fattura> {
  const nuova: Fattura = { ...fattura, id: nuovoId() };
  await archivio().fatture.salva(nuova);
  toast.conferma(`Fattura ${nuova.numero || "senza numero"} creata`, async () => {
    await archivio().fatture.elimina(nuova.id);
  });
  return nuova;
}

export async function eliminaFattura(fattura: Fattura) {
  await archivio().fatture.elimina(fattura.id);
  toast.conferma(`Fattura ${fattura.numero || "senza numero"} eliminata`, async () => {
    await archivio().fatture.salva(fattura);
  });
}

/** Azione rapida della tabella: incassata oggi, salvo diversa indicazione. */
export async function segnaIncassata(fattura: Fattura, dataIncasso?: string) {
  const data = dataIncasso ?? new Date().toISOString().slice(0, 10);
  await salvaFattura({ ...fattura, dataIncasso: data }, "Segnata come incassata");
}

export async function annullaIncasso(fattura: Fattura) {
  await salvaFattura({ ...fattura, dataIncasso: null }, "Incasso rimosso");
}

/** Il numero successivo nella serie dell'anno: 2026/001, 2026/002… */
export function prossimoNumero(fatture: Fattura[], anno: number): string {
  const prefisso = `${anno}/`;
  const progressivi = fatture
    .filter((f) => f.numero.startsWith(prefisso))
    .map((f) => Number.parseInt(f.numero.slice(prefisso.length), 10))
    .filter((n) => Number.isFinite(n));
  const prossimo = progressivi.length > 0 ? Math.max(...progressivi) + 1 : 1;
  return `${prefisso}${String(prossimo).padStart(3, "0")}`;
}

// ————————————————————————————————————————————————————————————
// Costi
// ————————————————————————————————————————————————————————————

export async function salvaCosto(costo: Costo, messaggio = "Costo aggiornato") {
  await conAnnullamento(archivio().costi, costo.id, messaggio, async () => {
    await archivio().costi.salva(costo);
  });
}

export async function creaCosto(costo: Omit<Costo, "id">): Promise<Costo> {
  const nuovo: Costo = { ...costo, id: nuovoId() };
  await archivio().costi.salva(nuovo);
  toast.conferma("Costo registrato", async () => {
    await archivio().costi.elimina(nuovo.id);
  });
  return nuovo;
}

export async function eliminaCosto(costo: Costo) {
  await archivio().costi.elimina(costo.id);
  toast.conferma("Costo eliminato", async () => {
    await archivio().costi.salva(costo);
  });
}

export async function segnaPagato(costo: Costo, dataPagamento?: string) {
  const data = dataPagamento ?? new Date().toISOString().slice(0, 10);
  await salvaCosto({ ...costo, dataPagamento: data }, "Segnato come pagato");
}

// ————————————————————————————————————————————————————————————
// Impostazioni
// ————————————————————————————————————————————————————————————

export async function cambiaRegime(anno: number, regime: "forfettario" | "ordinario") {
  const attuali = await archivio().impostazioni.leggi(anno);
  if (!attuali) return;
  await archivio().impostazioni.salva({ ...attuali, regime });
  toast.conferma(
    `Regime ${regime === "forfettario" ? "forfettario" : "ordinario"}: ricalcolato tutto`,
    async () => {
      await archivio().impostazioni.salva(attuali);
    },
  );
}

// ————————————————————————————————————————————————————————————
// Clienti
// ————————————————————————————————————————————————————————————

export async function creaCliente(nome: string): Promise<string> {
  const esistente = (await archivio().clienti.tutti()).find(
    (c) => c.nome.trim().toLowerCase() === nome.trim().toLowerCase(),
  );
  if (esistente) return esistente.id;

  const id = nuovoId();
  await archivio().clienti.salva({
    id,
    nome: nome.trim(),
    canaleAcquisizione: "",
    note: "",
  });
  return id;
}
