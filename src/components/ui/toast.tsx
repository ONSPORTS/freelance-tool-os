"use client";

import * as React from "react";
import { Check, TriangleAlert, Undo2, X } from "lucide-react";
import { useToast, type Toast, type TonoToast } from "@/lib/stato/toast";
import { cn } from "@/lib/utils";

// Le notifiche si continuano a importare da qui: `toast` e `useToast` restano
// raggiungibili dal punto in cui il resto dell'app le ha sempre cercate.
export { toast, useToast, type Raggruppamento, type Toast } from "@/lib/stato/toast";

/**
 * Quanto resta a schermo.
 *
 * La conferma è breve: dice una cosa che l'utente ha appena fatto e che vede
 * già confermata nella riga. Un errore resta il doppio, perché è l'unica volta
 * in cui va letto per intero.
 */
const DURATA: Record<TonoToast, number> = {
  conferma: 3500,
  avviso: 5000,
  errore: 7000,
};

export function ContenitoreToast() {
  const t = useToast((s) => s.toast);
  const chiudi = useToast((s) => s.chiudi);
  const annulla = useToast((s) => s.annulla);

  return (
    // In basso a destra: al centro copriva le righe della tabella su cui si sta
    // lavorando, che è esattamente il contenuto che serve mentre si modifica.
    // Su schermo stretto resta in basso e prende la larghezza che c'è.
    <div
      aria-live="polite"
      // Sul telefono la barra di sistema e l'indicatore home stanno in fondo:
      // senza il margine di sicurezza il toast ci finisce sotto, e l'Annulla —
      // che è il motivo per cui il toast esiste — diventa impossibile da premere.
      className="pointer-events-none fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col print:hidden"
    >
      {t && (
        <RigaToast
          key={t.id}
          toast={t}
          onChiudi={() => chiudi(t.id)}
          onAnnulla={() => void annulla(t.id)}
        />
      )}
    </div>
  );
}

function RigaToast({
  toast: t,
  onChiudi,
  onAnnulla,
}: {
  toast: Toast;
  onChiudi: () => void;
  onAnnulla: () => void;
}) {
  React.useEffect(() => {
    const timer = window.setTimeout(onChiudi, DURATA[t.tono]);
    return () => window.clearTimeout(timer);
  }, [onChiudi, t.tono]);

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
      <p className="min-w-0 flex-1 text-etichetta">{t.messaggio}</p>
      {t.annullamenti.length > 0 && (
        <button
          type="button"
          onClick={onAnnulla}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-campo px-2 py-1 text-etichetta font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Undo2 className="size-3.5" aria-hidden />
          Annulla
        </button>
      )}
      <button
        type="button"
        onClick={onChiudi}
        aria-label="Chiudi la notifica"
        className="shrink-0 rounded-campo p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
