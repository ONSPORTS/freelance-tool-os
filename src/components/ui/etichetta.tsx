import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Micro-etichetta sopra un numero. Sentence case, mai maiuscoletto spaziato.
 */
export function Etichetta({
  className,
  chiara = false,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { chiara?: boolean }) {
  return (
    <span
      data-slot="etichetta"
      className={cn(
        "block text-etichetta",
        chiara ? "text-white/60" : "text-inchiostro-tenue",
        className,
      )}
      {...props}
    />
  );
}

/** Il numero grande. Sempre in cifre tabellari. */
export function Cifra({
  className,
  taglia = "kpi",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { taglia?: "semaforo" | "kpi" | "kpiSm" | "corpo" }) {
  const scala = {
    semaforo: "text-semaforo",
    kpi: "text-kpi",
    kpiSm: "text-kpi-sm",
    corpo: "text-corpo",
  }[taglia];
  return (
    <span
      data-slot="cifra"
      className={cn("cifre block font-semibold", scala, className)}
      {...props}
    />
  );
}
