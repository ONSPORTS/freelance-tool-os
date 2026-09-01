import { cn } from "@/lib/utils";

/**
 * Attesa della lettura dall'archivio.
 *
 * Esiste per non confondere «non ho ancora letto» con «non c'è nulla»: uno
 * stato vuoto mostrato durante il caricamento dice all'utente una cosa falsa
 * sui suoi dati, ed è il momento in cui più facilmente si spaventa.
 */
export function CaricamentoTabella({ righe = 6, className }: { righe?: number; className?: string }) {
  return (
    <div className={cn("p-4", className)} aria-busy="true" aria-live="polite">
      <span className="sr-only">Lettura dell&apos;archivio locale in corso…</span>
      <div className="space-y-2.5">
        {Array.from({ length: righe }, (_, i) => (
          <div
            key={i}
            className="h-9 animate-pulse rounded-campo bg-superficie-alt"
            style={{ animationDelay: `${i * 60}ms`, opacity: 1 - i * 0.1 }}
          />
        ))}
      </div>
    </div>
  );
}
