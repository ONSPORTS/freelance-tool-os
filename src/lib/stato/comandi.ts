"use client";

import * as React from "react";
import { create } from "zustand";

/**
 * Lo stato della palette e le richieste che ne escono.
 *
 * «Nuova fattura» dalla palette deve portare su `/fatture` *e* aprire il
 * modulo. Una query nell'URL lo farebbe, ma l'app è generata staticamente e
 * `useSearchParams` obbligherebbe ogni pagina a un confine di Suspense: la
 * richiesta viaggia quindi in memoria, e la schermata di destinazione la
 * consuma quando è montata. Non è persistita: è un'intenzione di un istante,
 * non una preferenza.
 */
export type Richiesta =
  | { tipo: "nuovaFattura" }
  | { tipo: "nuovoCosto" }
  | { tipo: "cercaFatture"; testo: string }
  | { tipo: "cercaClienti"; testo: string };

type StatoComandi = {
  paletta: boolean;
  richiesta: Richiesta | null;
  /** Cresce a ogni richiesta: due «nuova fattura» di fila sono due eventi. */
  seriale: number;
  apriPaletta: () => void;
  chiudiPaletta: () => void;
  chiedi: (richiesta: Richiesta) => void;
  consumata: () => void;
};

export const useComandi = create<StatoComandi>((set, get) => ({
  paletta: false,
  richiesta: null,
  seriale: 0,
  apriPaletta: () => set({ paletta: true }),
  chiudiPaletta: () => set({ paletta: false }),
  chiedi: (richiesta) =>
    set({ richiesta, seriale: get().seriale + 1, paletta: false }),
  consumata: () => set({ richiesta: null }),
}));

/**
 * Esegue `azione` quando arriva una richiesta del tipo atteso, poi la consuma.
 *
 * Funziona sia quando la schermata si monta dopo la navigazione, sia quando è
 * già aperta: in entrambi i casi l'effetto scatta al cambio di `seriale`.
 *
 * @param pronto finché è falso la richiesta resta in coda invece di essere
 * consumata. Serve alle schermate che devono prima leggere l'archivio: la
 * navigazione arriva sempre prima di Dexie, e una richiesta consumata mentre i
 * dati non ci sono ancora è una richiesta persa in silenzio.
 */
export function useRichiesta<T extends Richiesta["tipo"]>(
  tipo: T,
  azione: (r: Extract<Richiesta, { tipo: T }>) => void,
  pronto = true,
): void {
  const richiesta = useComandi((s) => s.richiesta);
  const seriale = useComandi((s) => s.seriale);
  const consumata = useComandi((s) => s.consumata);
  const riferimento = React.useRef(azione);
  riferimento.current = azione;

  React.useEffect(() => {
    if (!pronto) return;
    if (!richiesta || richiesta.tipo !== tipo) return;
    riferimento.current(richiesta as Extract<Richiesta, { tipo: T }>);
    consumata();
  }, [richiesta, seriale, tipo, pronto, consumata]);
}
