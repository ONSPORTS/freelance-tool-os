"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { calcolaProspetto, type Prospetto } from "@/lib/fisco/motore";
import { calcolaIva, type LiquidazioneIva } from "@/lib/fisco/iva";
import { impostazioniPredefinite } from "@/lib/fisco/impostazioni";
import { parametriDi } from "@/lib/fisco/parametri";
import type { Impostazioni } from "@/lib/fisco/tipi";
import { archivio } from "./archivio";
import type { Dati } from "./tipi";

/**
 * Lo strato reattivo.
 *
 * `useLiveQuery` osserva le tabelle toccate dalla funzione che gli si passa:
 * poiché l'adapter delega direttamente a Dexie, la reattività funziona anche
 * leggendo attraverso l'interfaccia. Un futuro adapter remoto richiederebbe di
 * riscrivere questi hook, non il resto dell'applicazione.
 */
export function useDati(): Dati | undefined {
  return useLiveQuery(() => archivio().leggiTutto(), []);
}

export function useArchivioVuoto(): boolean | undefined {
  return useLiveQuery(() => archivio().vuoto(), []);
}

export function useImpostazioni(anno: number): Impostazioni | undefined {
  const salvate = useLiveQuery(() => archivio().impostazioni.leggi(anno), [anno]);
  return useMemo(() => {
    if (salvate) return salvate;
    if (salvate === undefined) return undefined;
    return impostazioniPredefinite(parametriDi(anno));
  }, [salvate, anno]);
}

export type CalcoloAnno = {
  prospetto: Prospetto;
  iva: LiquidazioneIva;
  impostazioni: Impostazioni;
};

/**
 * Il calcolo completo di un anno, ricavato dai dati grezzi.
 * Cambiare regime nelle impostazioni riconfigura ogni schermata perché tutto
 * scende da qui: nessun valore calcolato è salvato da nessuna parte.
 */
export function useCalcoloAnno(anno: number, oggi: string): CalcoloAnno | undefined {
  const dati = useDati();
  return useMemo(() => {
    if (!dati) return undefined;
    const parametri = parametriDi(anno);
    const impostazioni =
      dati.impostazioni.find((i) => i.anno === anno) ?? impostazioniPredefinite(parametri);
    const prospetto = calcolaProspetto({
      impostazioni,
      parametri,
      fatture: dati.fatture,
      costi: dati.costi,
      versamenti: dati.versamenti,
      oggi,
    });
    return {
      impostazioni,
      prospetto,
      iva: calcolaIva(prospetto.fattureCalcolate, prospetto.costiCalcolati, impostazioni, parametri),
    };
  }, [dati, anno, oggi]);
}
