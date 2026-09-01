"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { TabellaIntestazione } from "@/components/ui/tabella";
import type { Ordinamento } from "./ordinamento";

export function IntestazioneOrdinabile<C extends string>({
  colonna,
  ordinamento,
  onOrdina,
  numerica = false,
  className,
  children,
}: {
  colonna: C;
  ordinamento: Ordinamento<C>;
  onOrdina: (colonna: C) => void;
  numerica?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const attiva = ordinamento.colonna === colonna;
  const Icona = !attiva ? ChevronsUpDown : ordinamento.verso === "crescente" ? ArrowUp : ArrowDown;

  return (
    <TabellaIntestazione
      numerica={numerica}
      className={cn("p-0", className)}
      aria-sort={attiva ? (ordinamento.verso === "crescente" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onOrdina(colonna)}
        className={cn(
          "flex w-full items-center gap-1 px-2.5 py-2.5 text-etichetta font-medium",
          "transition-colors duration-150 hover:text-inchiostro",
          attiva ? "text-inchiostro" : "text-inchiostro-tenue",
          numerica && "justify-end",
        )}
      >
        {numerica && <Icona className={cn("size-3.5", !attiva && "opacity-40")} aria-hidden />}
        <span>{children}</span>
        {!numerica && <Icona className={cn("size-3.5", !attiva && "opacity-40")} aria-hidden />}
      </button>
    </TabellaIntestazione>
  );
}
