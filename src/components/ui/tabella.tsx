import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Tabella disciplinata: righe alternate sulla superficie alternativa,
 * intestazione ferma in alto, riga dei totali fissa in basso.
 * I contenitori scrollano da soli: il body della pagina non scorre mai in orizzontale.
 */
/**
 * Il riquadro che scorre. Contiene la tabella su entrambi gli assi, così
 * l'intestazione e la riga dei totali possono agganciarsi ai suoi bordi e il
 * corpo della pagina non scorre mai in orizzontale.
 */
export function ContenitoreTabella({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("w-full overflow-auto", className)} {...props} />;
}

export function Tabella({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full border-collapse text-corpo", className)} {...props} />;
}

/**
 * L'aggancio in alto va messo sulle celle, non sulla sezione: su `thead` e
 * `tfoot` i browser ignorano `position: sticky`, e la riga se ne va scorrendo.
 */
export function TabellaTesta({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn("[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-superficie", className)}
      {...props}
    />
  );
}

export function TabellaCorpo({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("[&_tr:nth-child(even)]:bg-superficie-alt/60", className)} {...props} />;
}

export function TabellaPiede({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tfoot
      className={cn(
        "font-medium",
        "[&_td]:sticky [&_td]:bottom-0 [&_td]:z-10 [&_td]:border-t [&_td]:border-bordo [&_td]:bg-superficie",
        className,
      )}
      {...props}
    />
  );
}

export function TabellaRiga({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn("border-b border-bordo/70 transition-colors last:border-0", className)}
      {...props}
    />
  );
}

export function TabellaIntestazione({
  className,
  numerica = false,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { numerica?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b border-bordo px-2.5 py-2.5 text-etichetta font-medium text-inchiostro-tenue",
        numerica ? "text-right" : "text-left",
        className,
      )}
      {...props}
    />
  );
}

export function TabellaCella({
  className,
  numerica = false,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { numerica?: boolean }) {
  return (
    <td
      className={cn(
        "px-2.5 py-2.5 align-middle",
        numerica && "cifre text-right",
        className,
      )}
      {...props}
    />
  );
}
