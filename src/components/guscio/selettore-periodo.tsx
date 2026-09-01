"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmenti } from "@/components/ui/segmenti";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { etichettaPeriodo, type Periodo, type TipoPeriodo } from "@/lib/periodo";
import { nomeMese } from "@/lib/format";

const TIPI: { valore: TipoPeriodo; etichetta: string }[] = [
  { valore: "mese", etichetta: "Mese" },
  { valore: "trimestre", etichetta: "Trimestre" },
  { valore: "anno", etichetta: "Anno" },
  { valore: "personalizzato", etichetta: "Personalizzato" },
];

/**
 * Selettore di periodo persistente. Cambia il periodo e la schermata si
 * ricalcola: i registri si filtrano sulla data del documento.
 */
export function SelettorePeriodo({
  periodo,
  onChange,
  className,
}: {
  periodo: Periodo;
  onChange: (p: Periodo) => void;
  className?: string;
}) {
  const oggi = React.useMemo(() => new Date(), []);

  function cambiaTipo(tipo: TipoPeriodo) {
    if (tipo === periodo.tipo) return;
    onChange({
      tipo,
      anno: periodo.anno,
      mese: periodo.mese ?? oggi.getMonth() + 1,
      trimestre: periodo.trimestre ?? Math.floor(oggi.getMonth() / 3) + 1,
      da: periodo.da,
      a: periodo.a,
    });
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Segmenti
        etichettaGruppo="Tipo di periodo"
        valore={periodo.tipo}
        onChange={cambiaTipo}
        opzioni={TIPI}
      />

      <div className="flex items-center gap-1 rounded-full bg-superficie-alt p-1">
        <Button
          variante="quieto"
          taglia="icona"
          className="size-7 rounded-full"
          aria-label="Anno precedente"
          onClick={() => onChange({ ...periodo, anno: periodo.anno - 1 })}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="cifre min-w-12 text-center text-etichetta font-medium">
          {periodo.anno}
        </span>
        <Button
          variante="quieto"
          taglia="icona"
          className="size-7 rounded-full"
          aria-label="Anno successivo"
          onClick={() => onChange({ ...periodo, anno: periodo.anno + 1 })}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {periodo.tipo === "mese" && (
        <Select
          value={String(periodo.mese ?? 1)}
          onValueChange={(v) => onChange({ ...periodo, mese: Number(v) })}
        >
          <SelectTrigger className="h-9 w-36" aria-label="Mese">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 12 }, (_, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>
                {maiuscola(nomeMese(i + 1))}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {periodo.tipo === "trimestre" && (
        <Select
          value={String(periodo.trimestre ?? 1)}
          onValueChange={(v) => onChange({ ...periodo, trimestre: Number(v) })}
        >
          <SelectTrigger className="h-9 w-36" aria-label="Trimestre">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4].map((t) => (
              <SelectItem key={t} value={String(t)}>
                {t}° trimestre
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {periodo.tipo === "personalizzato" && (
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            aria-label="Data di inizio"
            className="h-9 w-40"
            value={periodo.da ?? `${periodo.anno}-01-01`}
            onChange={(e) => onChange({ ...periodo, da: e.target.value })}
          />
          <span className="text-etichetta text-inchiostro-tenue">–</span>
          <Input
            type="date"
            aria-label="Data di fine"
            className="h-9 w-40"
            value={periodo.a ?? `${periodo.anno}-12-31`}
            onChange={(e) => onChange({ ...periodo, a: e.target.value })}
          />
        </div>
      )}

      <span className="sr-only" aria-live="polite">
        Periodo: {etichettaPeriodo(periodo)}
      </span>
    </div>
  );
}

function maiuscola(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
