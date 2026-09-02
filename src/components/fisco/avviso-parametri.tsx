import { TriangleAlert } from "lucide-react";
import { Card, CardCorpo } from "@/components/ui/card";
import { parametriDi, parametriSonoDellAnno } from "@/lib/fisco/parametri";

/**
 * L'avviso sui parametri di legge non definitivi.
 *
 * Due casi diversi che meritano la stessa cautela: l'anno non è censito
 * affatto, oppure è censito ma con valori ereditati in attesa della Legge di
 * Bilancio. In entrambi i numeri sono stime, e un numero stimato che ha l'aria
 * di un numero esatto è il modo più efficace di sbagliare.
 */
export function AvvisoParametri({ anno }: { anno: number }) {
  const par = parametriDi(anno);
  const censito = parametriSonoDellAnno(anno);
  if (censito && !par.provvisorio) return null;

  return (
    <Card className="border border-attenzione/25 bg-attenzione-tenue">
      <CardCorpo className="flex items-start gap-3 py-4">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-[#B8791A]" aria-hidden />
        <div className="space-y-1">
          <p className="text-etichetta font-semibold text-[#B8791A]">
            Parametri {anno} provvisori
          </p>
          <p className="text-etichetta text-[#B8791A]">
            {censito
              ? `Aliquote, scaglioni e soglie sono quelli del ${par.anno - 1}, ereditati in attesa della Legge di Bilancio ${anno}. I numeri di questa schermata sono stime: l'export del prospetto resta bloccato finché non escono i valori definitivi.`
              : `Per il ${anno} non ci sono parametri censiti: il calcolo usa quelli dell'ultimo anno disponibile. Verificali prima di usarli per decidere.`}
          </p>
        </div>
      </CardCorpo>
    </Card>
  );
}
