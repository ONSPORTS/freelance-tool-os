"use client";

import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

/** Riga di ricerca e filtri sopra una tabella. */
export function BarraStrumenti({
  ricerca,
  onRicerca,
  segnaposto,
  children,
  className,
}: {
  ricerca: string;
  onRicerca: (v: string) => void;
  segnaposto: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="relative min-w-52 flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-inchiostro-tenue"
          aria-hidden
        />
        <Input
          type="search"
          // Il tasto «/» cerca questo campo per portarci il cursore: la ricerca
          // della schermata viene prima della palette, quando c'è.
          data-ricerca
          value={ricerca}
          onChange={(e) => onRicerca(e.target.value)}
          placeholder={segnaposto}
          aria-label={segnaposto}
          className="pl-9 pr-9"
        />
        {ricerca && (
          <button
            type="button"
            onClick={() => onRicerca("")}
            aria-label="Cancella la ricerca"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-campo p-1 text-inchiostro-tenue transition-colors hover:bg-superficie-alt hover:text-inchiostro"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      {/*
        Sul telefono i filtri stanno in griglia a due colonne: uno per riga,
        largo poco più di metà schermo, sembrava un campo troncato — e le due
        tendine insieme mangiavano due righe intere sopra i dati.
      */}
      {children && (
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center [&>*]:w-full sm:[&>*]:w-auto">
          {children}
        </div>
      )}
    </div>
  );
}
