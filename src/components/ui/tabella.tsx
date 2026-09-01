import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Tabella disciplinata: righe alternate sulla superficie alternativa,
 * intestazione ferma in alto, riga dei totali fissa in basso.
 * I contenitori scrollano da soli: il body della pagina non scorre mai in orizzontale.
 */
export function Tabella({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        className={cn("w-full border-collapse text-corpo", className)}
        {...props}
      />
    </div>
  );
}

export function TabellaTesta({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn("sticky top-0 z-10 bg-superficie", className)}
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
        "sticky bottom-0 z-10 bg-superficie font-medium [&_td]:border-t [&_td]:border-bordo",
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
        "border-b border-bordo px-3 py-2.5 text-etichetta font-medium text-inchiostro-tenue",
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
        "px-3 py-2.5 align-middle",
        numerica && "cifre text-right",
        className,
      )}
      {...props}
    />
  );
}
