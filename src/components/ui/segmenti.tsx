"use client";

import { cn } from "@/lib/utils";

/**
 * Controllo a segmenti in pillola: selettore di periodo, toggle di regime.
 * Una sola superficie, nessuna ombra sulle opzioni non attive.
 */
export function Segmenti<T extends string>({
  opzioni,
  valore,
  onChange,
  className,
  etichettaGruppo,
  disabilitato = false,
}: {
  opzioni: readonly { valore: T; etichetta: string }[];
  valore: T;
  onChange: (v: T) => void;
  className?: string;
  etichettaGruppo: string;
  /** In sola lettura resta leggibile — dice ancora com'è impostato — e non si tocca. */
  disabilitato?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={etichettaGruppo}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full bg-superficie-alt p-1",
        className,
      )}
    >
      {opzioni.map((o) => {
        const attivo = o.valore === valore;
        return (
          <button
            key={o.valore}
            type="button"
            role="radio"
            aria-checked={attivo}
            disabled={disabilitato && !attivo}
            onClick={() => onChange(o.valore)}
            className={cn(
              // 34 px di altezza sul telefono, 30 da tablet in su: con il dito
              // servono, con il mouse no e ruberebbero spazio alla testata.
              "rounded-full px-3.5 py-2 text-etichetta font-medium sm:py-1.5",
              "transition-[background-color,color] duration-200 ease-quieto",
              attivo
                ? "bg-superficie text-inchiostro shadow-riposo"
                : "text-inchiostro-tenue hover:text-inchiostro",
              "disabled:cursor-not-allowed disabled:text-inchiostro-tenue/50 disabled:hover:text-inchiostro-tenue/50",
            )}
          >
            {o.etichetta}
          </button>
        );
      })}
    </div>
  );
}
