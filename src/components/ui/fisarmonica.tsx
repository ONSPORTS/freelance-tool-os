"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Sezione apribile. Usa `details`/`summary`: si apre anche da tastiera senza
 * che io debba gestire nulla, e resta leggibile quando si stampa la pagina.
 */
export function Sezione({
  lettera,
  titolo,
  sottotitolo,
  sintesi,
  apertaDiDefault = false,
  children,
  className,
}: {
  lettera?: string;
  titolo: string;
  sottotitolo?: string;
  /** Il numero che vale la pena vedere anche a sezione chiusa. */
  sintesi?: React.ReactNode;
  apertaDiDefault?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <details
      open={apertaDiDefault}
      className={cn("group rounded-card bg-superficie shadow-riposo", className)}
    >
      {/*
        `flex-wrap` più un minimo sul titolo: senza, su 375 px il titolo si
        restringeva a una colonna da 110 px — «Base di / calcolo» e un
        sottotitolo su quattro righe — pur di tenere l'importo di fianco.
        Adesso l'importo scende sotto e il titolo ha la riga intera.
      */}
      <summary
        className={cn(
          "flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 rounded-card px-4 py-4 sm:flex-nowrap sm:px-6",
          "transition-colors duration-150 hover:bg-superficie-alt/60",
          "[&::-webkit-details-marker]:hidden",
        )}
      >
        {lettera && (
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accento-tenue text-etichetta font-semibold text-accento">
            {lettera}
          </span>
        )}
        <span className="min-w-40 flex-1">
          <span className="block font-display text-kpi-sm font-semibold">{titolo}</span>
          {sottotitolo && (
            <span className="block text-etichetta text-inchiostro-tenue">{sottotitolo}</span>
          )}
        </span>
        {/* Importo e freccia restano insieme: andando a capo separati, la
            freccia finiva su una riga tutta sua sotto la lettera. */}
        <span className="ml-auto flex shrink-0 items-center gap-3">
          {sintesi && <span className="text-right">{sintesi}</span>}
          <ChevronDown
            className="size-4 shrink-0 text-inchiostro-tenue transition-transform duration-200 ease-quieto group-open:rotate-180"
            aria-hidden
          />
        </span>
      </summary>
      <div className="border-t border-bordo">{children}</div>
    </details>
  );
}
