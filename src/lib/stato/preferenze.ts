"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ANNO_DEFINITIVO_PIU_RECENTE } from "@/lib/fisco/parametri";
import { periodoAnno, type Periodo } from "@/lib/periodo";

/**
 * Stato di interfaccia, non dati. Vive in localStorage perché il selettore di
 * periodo deve essere «persistente in alto»: chi torna sull'app la ritrova
 * come l'aveva lasciata, senza che questo tocchi l'archivio.
 */
type Preferenze = {
  periodo: Periodo;
  /** Ultimo ordinamento e filtri per ciascuna tabella, per nome di tabella. */
  densita: "comoda" | "compatta";
  impostaPeriodo: (periodo: Periodo) => void;
  impostaAnno: (anno: number) => void;
  impostaDensita: (densita: "comoda" | "compatta") => void;
};

export const usePreferenze = create<Preferenze>()(
  persist(
    (set, get) => ({
      // L'app apre sull'ultimo anno con parametri definitivi, non sull'ultimo
      // censito: aprire di default su un anno le cui aliquote sono stimate
      // significherebbe mostrare numeri provvisori a chi non li ha chiesti.
      periodo: periodoAnno(ANNO_DEFINITIVO_PIU_RECENTE),
      densita: "comoda",
      impostaPeriodo: (periodo) => set({ periodo }),
      impostaAnno: (anno) => set({ periodo: { ...get().periodo, anno } }),
      impostaDensita: (densita) => set({ densita }),
    }),
    {
      name: "ffos-preferenze",
      // L'app è generata staticamente: l'idratazione va fatta a mano dopo il
      // montaggio, altrimenti il primo render sul server e quello nel browser
      // partirebbero da stati diversi.
      skipHydration: true,
    },
  ),
);

/** Anno di riferimento corrente, comodo da leggere ovunque. */
export function useAnno(): number {
  return usePreferenze((s) => s.periodo.anno);
}
