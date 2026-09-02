"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { catenaAnni, type AnnoCalcolato, type ArchivioPerAnni } from "@/lib/analisi/anno";
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
    return { ...impostazioniPredefinite(parametriDi(anno)), anno };
  }, [salvate, anno]);
}

/**
 * Il calcolo completo di un anno, ricavato dai dati grezzi.
 *
 * Non è un anno isolato: `catenaAnni` percorre tutti gli anni presenti in
 * archivio in ordine, così l'anno richiesto apre con quello che gli ha lasciato
 * il precedente — saldo, accantonato, credito IVA, crediti d'imposta. Cambiare
 * regime nelle impostazioni riconfigura ogni schermata perché tutto scende da
 * qui: nessun valore calcolato è salvato da nessuna parte.
 */
export type CalcoloAnno = AnnoCalcolato;

function archivioDa(dati: Dati): ArchivioPerAnni {
  return {
    impostazioni: dati.impostazioni,
    fatture: dati.fatture,
    costi: dati.costi,
    versamenti: dati.versamenti,
    movimentiAttivita: dati.movimentiAttivita,
    movimentiPersonali: dati.movimentiPersonali,
    chiusure: dati.chiusure,
  };
}

export function useCatenaAnni(
  anno: number,
  oggi: string,
): Map<number, AnnoCalcolato> | undefined {
  const dati = useDati();
  return useMemo(
    () => (dati ? catenaAnni(archivioDa(dati), anno, oggi) : undefined),
    [dati, anno, oggi],
  );
}

export function useCalcoloAnno(anno: number, oggi: string): CalcoloAnno | undefined {
  const catena = useCatenaAnni(anno, oggi);
  return catena?.get(anno);
}

/** Gli anni che hanno qualcosa dentro, per il selettore: sempre in ordine. */
export function useAnniDisponibili(anno: number, oggi: string): number[] {
  const catena = useCatenaAnni(anno, oggi);
  return useMemo(() => (catena ? [...catena.keys()].sort((a, b) => a - b) : [anno]), [catena, anno]);
}
