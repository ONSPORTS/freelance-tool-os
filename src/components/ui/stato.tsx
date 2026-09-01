import { cn } from "@/lib/utils";

export type TonoStato = "neutro" | "positivo" | "attenzione" | "negativo" | "accento";

const toni: Record<TonoStato, string> = {
  neutro: "bg-superficie-alt text-inchiostro-tenue",
  accento: "bg-accento-tenue text-accento",
  positivo: "bg-positivo-tenue text-[#0B8A63]",
  attenzione: "bg-attenzione-tenue text-[#B8791A]",
  negativo: "bg-negativo-tenue text-[#C13237]",
};

const puntini: Record<TonoStato, string> = {
  neutro: "bg-inchiostro-tenue",
  accento: "bg-accento",
  positivo: "bg-positivo",
  attenzione: "bg-attenzione",
  negativo: "bg-negativo",
};

/** Pillola di stato con pallino: incassato, da incassare, scaduto. */
export function Stato({
  tono = "neutro",
  children,
  className,
}: {
  tono?: TonoStato;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-etichetta font-medium",
        toni[tono],
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", puntini[tono])} aria-hidden />
      {children}
    </span>
  );
}
