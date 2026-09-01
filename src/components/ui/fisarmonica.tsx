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
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center gap-3 rounded-card px-6 py-4",
          "transition-colors duration-150 hover:bg-superficie-alt/60",
          "[&::-webkit-details-marker]:hidden",
        )}
      >
        {lettera && (
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accento-tenue text-etichetta font-semibold text-accento">
            {lettera}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block font-display text-kpi-sm font-semibold">{titolo}</span>
          {sottotitolo && (
            <span className="block text-etichetta text-inchiostro-tenue">{sottotitolo}</span>
          )}
        </span>
        {sintesi && <span className="shrink-0 text-right">{sintesi}</span>}
        <ChevronDown
          className="size-4 shrink-0 text-inchiostro-tenue transition-transform duration-200 ease-quieto group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="border-t border-bordo">{children}</div>
    </details>
  );
}
