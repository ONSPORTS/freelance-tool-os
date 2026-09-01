import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Stato vuoto che indica l'azione, non la mancanza.
 * Nessuna schermata di questo prodotto ha uno stato vuoto muto.
 */
export function Vuoto({
  icona: Icona,
  titolo,
  azione,
  className,
}: {
  icona?: LucideIcon;
  titolo: string;
  azione?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-6 py-12 text-center", className)}>
      {Icona && (
        <span className="flex size-11 items-center justify-center rounded-interna bg-superficie-alt text-inchiostro-tenue">
          <Icona className="size-5" aria-hidden />
        </span>
      )}
      <p className="max-w-sm text-corpo text-inchiostro-tenue">{titolo}</p>
      {azione}
    </div>
  );
}
