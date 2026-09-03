/**
 * Scrivere un import, e disfarlo.
 *
 * L'annullamento è **persistente e chirurgico**. Persistente perché di un
 * import sbagliato ci si accorge il giorno dopo, guardando il cruscotto e
 * trovando un numero che non torna: un annulla che sparisce alla ricarica è un
 * annulla assente proprio quando serve. Chirurgico perché a quel punto
 * l'archivio è andato avanti — fatture inserite a mano, costi spuntati — e
 * ripristinare un'istantanea distruggerebbe quel lavoro. Si disfa esattamente
 * ciò che l'import ha fatto, riga per riga.
 *
 * Resta disponibile **fino all'import successivo o alla chiusura d'anno**,
 * quello che viene prima: dopo una chiusura i riporti dell'anno dopo poggiano
 * su questi numeri, e toglierli sotto senza che la chiusura se ne accorga
 * produrrebbe il difetto peggiore del progetto — un numero plausibile e
 * sbagliato.
 */
import { round2 } from "@/lib/fisco/aritmetica";
import { archivio } from "./archivio";
import type { Cliente, Importazione, ModificaImport, MovimentoPersonale } from "./tipi";
import type { Costo, Fattura, NotaCredito } from "@/lib/fisco/tipi";

export type DaScrivere = {
  nomeFile: string;
  destinazione: "fattura" | "costo";
  fatture: Fattura[];
  note: NotaCredito[];
  costi: Costo[];
  clienti: Cliente[];
  /** Le spese personali già raggruppate per mese. */
  personali: { anno: number; mese: number; importo: number }[];
  fisse: boolean;
  scartate: number;
};

/** Scrive l'import e registra come disfarlo. Torna la registrazione. */
export async function eseguiImport(dati: DaScrivere): Promise<Importazione> {
  const a = archivio();
  const modifiche: ModificaImport[] = [];

  // Gli id delle entità sono già stati decisi dall'interpretazione: se un id
  // esiste già siamo nel caso «sostituisci», e il precedente va conservato.
  const fattureEsistenti = new Map((await a.fatture.tutti()).map((f) => [f.id, f]));
  const costiEsistenti = new Map((await a.costi.tutti()).map((c) => [c.id, c]));
  const noteEsistenti = new Map((await a.note.tutti()).map((n) => [n.id, n]));

  for (const cliente of dati.clienti) {
    await a.clienti.salva(cliente);
    modifiche.push({ tipo: "creato", collezione: "clienti", id: cliente.id });
  }

  for (const fattura of dati.fatture) {
    const precedente = fattureEsistenti.get(fattura.id);
    await a.fatture.salva(fattura);
    modifiche.push(
      precedente
        ? { tipo: "sostituito", collezione: "fatture", precedente }
        : { tipo: "creato", collezione: "fatture", id: fattura.id },
    );
  }

  for (const nota of dati.note) {
    const precedente = noteEsistenti.get(nota.id);
    await a.note.salva(nota);
    modifiche.push(
      precedente
        ? { tipo: "sostituito", collezione: "note", precedente }
        : { tipo: "creato", collezione: "note", id: nota.id },
    );
  }

  for (const costo of dati.costi) {
    const precedente = costiEsistenti.get(costo.id);
    await a.costi.salva(costo);
    modifiche.push(
      precedente
        ? { tipo: "sostituito", collezione: "costi", precedente }
        : { tipo: "creato", collezione: "costi", id: costo.id },
    );
  }

  // Le spese personali non sono righe: confluiscono nel totale del mese. Per
  // disfarle si registra il delta, non il valore precedente — così l'annulla
  // resta corretto anche se nel frattempo quel mese è stato modificato a mano.
  const campo: keyof MovimentoPersonale = dati.fisse ? "speseFisse" : "speseVariabili";
  const mesi = await a.movimentiPersonali.tutti();
  for (const p of dati.personali) {
    const esistente = mesi.find((m) => m.anno === p.anno && m.mese === p.mese);
    if (esistente) {
      await a.movimentiPersonali.salva({
        ...esistente,
        [campo]: round2(esistente[campo] + p.importo),
      });
      modifiche.push({
        tipo: "sommato",
        collezione: "movimentiPersonali",
        id: esistente.id,
        campo,
        delta: p.importo,
      });
    } else {
      const nuovo: MovimentoPersonale = {
        id: crypto.randomUUID(),
        anno: p.anno,
        mese: p.mese,
        prelievi: 0,
        altreEntrate: 0,
        speseFisse: 0,
        speseVariabili: 0,
        risparmio: 0,
        [campo]: round2(p.importo),
      };
      await a.movimentiPersonali.salva(nuovo);
      mesi.push(nuovo);
      // Anche il mese creato dall'import registra un delta, non «creato»:
      // se domani l'utente scrive il suo affitto in quel mese e poi annulla
      // l'import, cancellare la riga porterebbe via anche l'affitto. Il mese
      // resta se contiene ancora qualcosa, sparisce se torna tutto a zero.
      modifiche.push({
        tipo: "sommato",
        collezione: "movimentiPersonali",
        id: nuovo.id,
        campo,
        delta: p.importo,
      });
    }
  }

  const registrazione: Importazione = {
    id: crypto.randomUUID(),
    eseguitaIl: new Date().toISOString(),
    nomeFile: dati.nomeFile,
    destinazione: dati.destinazione,
    conteggi: {
      fatture: dati.fatture.length,
      note: dati.note.length,
      costi: dati.costi.length,
      personali: dati.personali.length,
      clienti: dati.clienti.length,
      scartate: dati.scartate,
    },
    modifiche,
  };

  // Uno solo alla volta: il precedente non è più annullabile.
  for (const vecchia of await a.importazioni.tutti()) await a.importazioni.elimina(vecchia.id);
  await a.importazioni.salva(registrazione);
  return registrazione;
}

/** L'ultimo import annullabile, o `null`. */
export async function importAnnullabile(): Promise<Importazione | null> {
  const tutte = await archivio().importazioni.tutti();
  return tutte[0] ?? null;
}

export type EsitoAnnullamento = { annullate: number; clientiTenuti: number };

/**
 * Disfa l'import.
 *
 * I clienti creati si eliminano solo se nessuna fattura li usa più: se nel
 * frattempo ne è stata scritta una a mano su quel cliente, cancellarlo
 * lascerebbe una fattura senza intestatario.
 */
export async function annullaImport(importazione: Importazione): Promise<EsitoAnnullamento> {
  const a = archivio();
  // Già annullato — un doppio clic, due schede aperte — non è un errore: è una
  // richiesta a cui non resta niente da fare. Rieseguirlo cancellerebbe righe
  // che nel frattempo qualcun altro ha rimesso con gli stessi id.
  if (!(await a.importazioni.leggi(importazione.id))) {
    return { annullate: 0, clientiTenuti: 0 };
  }

  let annullate = 0;
  let clientiTenuti = 0;

  // Prima le righe, poi i clienti: l'ordine decide se un cliente risulta ancora
  // usato quando si arriva a valutarlo.
  const clientiCreati: string[] = [];

  for (const m of importazione.modifiche) {
    if (m.tipo === "creato" && m.collezione === "clienti") {
      clientiCreati.push(String(m.id));
      continue;
    }
    if (m.tipo === "creato") {
      await deposito(m.collezione).elimina(m.id);
      annullate++;
    } else if (m.tipo === "sostituito") {
      await deposito(m.collezione).salva(m.precedente);
      annullate++;
    } else {
      const mese = await a.movimentiPersonali.leggi(m.id);
      if (mese) {
        const valore = (mese as unknown as Record<string, number>)[m.campo] ?? 0;
        const aggiornato = { ...mese, [m.campo]: round2(Math.max(0, valore - m.delta)) };
        // Se il mese esisteva solo per le spese importate, tolte quelle non ha
        // più niente da dire: lasciarlo a zero sporcherebbe il cashflow con
        // mesi che l'utente non ha mai compilato.
        if (mesePersonaleVuoto(aggiornato)) await a.movimentiPersonali.elimina(m.id);
        else await a.movimentiPersonali.salva(aggiornato);
        annullate++;
      }
    }
  }

  const rimaste = await a.fatture.tutti();
  for (const id of clientiCreati) {
    if (rimaste.some((f) => f.clienteId === id)) {
      clientiTenuti++;
      continue;
    }
    await a.clienti.elimina(id);
    annullate++;
  }

  await a.importazioni.elimina(importazione.id);
  return { annullate, clientiTenuti };
}

/** Toglie la possibilità di annullare. La chiama la chiusura d'anno. */
export async function dimenticaImport(): Promise<void> {
  const a = archivio();
  for (const i of await a.importazioni.tutti()) await a.importazioni.elimina(i.id);
}

function mesePersonaleVuoto(m: MovimentoPersonale): boolean {
  return (
    m.prelievi === 0 &&
    m.altreEntrate === 0 &&
    m.speseFisse === 0 &&
    m.speseVariabili === 0 &&
    m.risparmio === 0
  );
}

function deposito(collezione: string) {
  return (archivio() as unknown as Record<string, {
    salva: (v: unknown) => Promise<unknown>;
    elimina: (k: string | number) => Promise<void>;
  }>)[collezione];
}
