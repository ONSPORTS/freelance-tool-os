"use client";

import * as React from "react";
import { create } from "zustand";
import { Check, TriangleAlert, Undo2, X } from "lucide-react";
import { cn } from "@/lib/utils";

type TonoToast = "conferma" | "avviso" | "errore";

export type Toast = {
  id: number;
  messaggio: string;
  tono: TonoToast;
  annulla?: () => void;
};

type StatoToast = {
  toast: Toast[];
  mostra: (t: Omit<Toast, "id">) => number;
  chiudi: (id: number) => void;
};

let prossimoId = 1;

export const useToast = create<StatoToast>((set) => ({
  toast: [],
  mostra: (t) => {
    const id = prossimoId++;
    set((s) => ({ toast: [...s.toast, { ...t, id }] }));
    return id;
  },
  chiudi: (id) => set((s) => ({ toast: s.toast.filter((t) => t.id !== id) })),
}));

/** Scorciatoie: toast.conferma("Fattura salvata", () => ripristina()) */
export const toast = {
  conferma: (messaggio: string, annulla?: () => void) =>
    useToast.getState().mostra({ messaggio, tono: "conferma", annulla }),
  avviso: (messaggio: string) => useToast.getState().mostra({ messaggio, tono: "avviso" }),
  errore: (messaggio: string) => useToast.getState().mostra({ messaggio, tono: "errore" }),
};

const DURATA = 6000;

export function ContenitoreToast() {
  const elenco = useToast((s) => s.toast);
  const chiudi = useToast((s) => s.chiudi);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2"
    >
      {elenco.map((t) => (
        <RigaToast key={t.id} toast={t} onChiudi={() => chiudi(t.id)} />
      ))}
    </div>
  );
}

function RigaToast({ toast: t, onChiudi }: { toast: Toast; onChiudi: () => void }) {
  React.useEffect(() => {
    const timer = window.setTimeout(onChiudi, DURATA);
    return () => window.clearTimeout(timer);
  }, [onChiudi]);

  const Icona = t.tono === "conferma" ? Check : TriangleAlert;
  const colore =
    t.tono === "conferma"
      ? "text-positivo"
      : t.tono === "avviso"
        ? "text-attenzione"
        : "text-negativo";

  return (
    <div
      role="status"
      className="pointer-events-auto flex items-center gap-3 rounded-interna bg-inchiostro px-4 py-3 text-white shadow-sollevato"
    >
      <Icona className={cn("size-4 shrink-0", colore)} aria-hidden />
      <p className="flex-1 text-etichetta">{t.messaggio}</p>
      {t.annulla && (
        <button
          type="button"
          onClick={() => {
            t.annulla?.();
            onChiudi();
          }}
          className="inline-flex items-center gap-1.5 rounded-campo px-2 py-1 text-etichetta font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Undo2 className="size-3.5" aria-hidden />
          Annulla
        </button>
      )}
      <button
        type="button"
        onClick={onChiudi}
        aria-label="Chiudi la notifica"
        className="rounded-campo p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
