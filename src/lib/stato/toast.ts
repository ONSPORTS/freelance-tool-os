/**
 * Lo stato delle notifiche.
 *
 * Modulo puro — nessun JSX, nessun componente — perché il raggruppamento delle
 * conferme e l'ordine degli annullamenti sono logica, e come tale si verifica:
 * `toast.test.ts` gira su questo file senza montare niente.
 * La presentazione sta in `components/ui/toast.tsx`.
 */
"use client";

import { create } from "zustand";

export type TonoToast = "conferma" | "avviso" | "errore";

/**
 * Come si accorpano più conferme ravvicinate.
 *
 * `chiave` identifica il gruppo: due toast con la stessa chiave non si mettono
 * in fila, diventano uno con un contatore. `molti` compone il messaggio al
 * plurale — «12 costi aggiornati» — perché «Costo aggiornato ×12» si legge
 * peggio.
 */
export type Raggruppamento = {
  chiave: string;
  molti: (quanti: number) => string;
};

export type Toast = {
  id: number;
  messaggio: string;
  tono: TonoToast;
  /** Quante azioni sono confluite qui. 1 nel caso normale. */
  quanti: number;
  gruppo?: string;
  molti?: (quanti: number) => string;
  /**
   * Gli annullamenti raccolti, dal più vecchio al più recente. Si eseguono in
   * ordine inverso: disfare dodici modifiche partendo dall'ultima è l'unico
   * ordine che riporta ogni riga al valore che aveva prima del gruppo.
   */
  annullamenti: (() => void | Promise<void>)[];
};

type StatoToast = {
  toast: Toast | null;
  mostra: (
    t: { messaggio: string; tono: TonoToast; annulla?: () => void | Promise<void> },
    gruppo?: Raggruppamento,
  ) => number;
  chiudi: (id: number) => void;
  annulla: (id: number) => Promise<void>;
};

let prossimoId = 1;

/**
 * Un toast alla volta.
 *
 * Prima se ne accumulavano quanti erano le azioni: cambiare la categoria a
 * dodici costi di fila copriva mezzo schermo di conferme sovrapposte, proprio
 * mentre si stava ancora lavorando sulla tabella sotto. Ora il nuovo prende il
 * posto del vecchio, e se appartiene allo stesso gruppo lo ingrossa invece di
 * sostituirlo, tenendo un solo Annulla per tutto il gruppo.
 */
export const useToast = create<StatoToast>((set, get) => ({
  toast: null,
  mostra: (t, gruppo) => {
    const attuale = get().toast;
    const annulla = t.annulla ? [t.annulla] : [];

    // Stesso gruppo e toast ancora vivo: si somma.
    if (gruppo && attuale && attuale.gruppo === gruppo.chiave) {
      const quanti = attuale.quanti + 1;
      set({
        toast: {
          ...attuale,
          // Id nuovo: fa ripartire il timer, così una raffica di modifiche
          // tiene il toast in vita e sparisce 3,5 secondi dopo l'ultima.
          id: prossimoId++,
          quanti,
          messaggio: gruppo.molti(quanti),
          annullamenti: [...attuale.annullamenti, ...annulla],
        },
      });
      return get().toast!.id;
    }

    const id = prossimoId++;
    set({
      toast: {
        id,
        messaggio: t.messaggio,
        tono: t.tono,
        quanti: 1,
        gruppo: gruppo?.chiave,
        molti: gruppo?.molti,
        annullamenti: annulla,
      },
    });
    return id;
  },
  chiudi: (id) => set((s) => (s.toast?.id === id ? { toast: null } : s)),
  annulla: async (id) => {
    const t = get().toast;
    if (!t || t.id !== id) return;
    set({ toast: null });
    for (const disfa of [...t.annullamenti].reverse()) await disfa();
  },
}));

/**
 * Scorciatoie.
 *
 * `toast.conferma("Costo aggiornato", annulla, { chiave: "costo-aggiornato",
 * molti: (n) => `${n} costi aggiornati` })`
 */
export const toast = {
  conferma: (
    messaggio: string,
    annulla?: () => void | Promise<void>,
    gruppo?: Raggruppamento,
  ) => useToast.getState().mostra({ messaggio, tono: "conferma", annulla }, gruppo),
  avviso: (messaggio: string) => useToast.getState().mostra({ messaggio, tono: "avviso" }),
  errore: (messaggio: string) => useToast.getState().mostra({ messaggio, tono: "errore" }),
};
