import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { variazione as fmtVariazione } from "@/lib/format";

const chip = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-etichetta font-medium",
  {
    variants: {
      tono: {
        neutro: "bg-superficie-alt text-inchiostro-tenue",
        accento: "bg-accento-tenue text-accento",
        positivo: "bg-positivo-tenue text-[#0B8A63]",
        attenzione: "bg-attenzione-tenue text-[#B8791A]",
        negativo: "bg-negativo-tenue text-[#C13237]",
        chiaro: "bg-white/15 text-white",
      },
    },
    defaultVariants: { tono: "neutro" },
  },
);

export function Chip({
  className,
  tono,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof chip>) {
  return <span data-slot="chip" className={cn(chip({ tono }), className)} {...props} />;
}

/**
 * Chip di variazione percentuale. Il colore segue il segno, salvo `invertito`
 * per le grandezze in cui crescere è una cattiva notizia (costi, scaduto).
 */
export function ChipVariazione({
  valore,
  invertito = false,
  chiaro = false,
  className,
}: {
  valore: number | null | undefined;
  invertito?: boolean;
  chiaro?: boolean;
  className?: string;
}) {
  if (valore == null || !Number.isFinite(valore)) return null;
  const buono = invertito ? valore < 0 : valore > 0;
  const neutro = valore === 0;
  const tono = chiaro ? "chiaro" : neutro ? "neutro" : buono ? "positivo" : "negativo";
  const Icona = valore >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <Chip tono={tono} className={cn("cifre", className)}>
      {!neutro && <Icona className="size-3.5" aria-hidden />}
      {fmtVariazione(valore)}
    </Chip>
  );
}
