import * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "./card";
import { Cifra, Etichetta } from "./etichetta";

/**
 * Tessera KPI. Numero grande, etichetta piccola, nota di contesto sotto.
 * `sfondo` accende uno dei due soli gradienti del prodotto — solo per le
 * due card di testa della dashboard — oppure la singola card scura di schermata.
 */
export function Kpi({
  etichetta,
  valore,
  nota,
  sotto,
  chip,
  sfondo = "chiaro",
  taglia = "kpi",
  className,
}: {
  etichetta: string;
  valore: React.ReactNode;
  nota?: string;
  /**
   * Una riga in più sotto la nota, con dentro quello che serve.
   *
   * `nota` resta una stringa apposta — è il posto della frase breve — e questo
   * è il posto di una riga che ha un tono suo: la quota di limite forfettario
   * che diventa un avviso quando si avvicina.
   */
  sotto?: React.ReactNode;
  chip?: React.ReactNode;
  sfondo?: "chiaro" | "scuro" | "indaco" | "ambra";
  taglia?: "kpi" | "kpiSm";
  className?: string;
}) {
  const suScuro = sfondo !== "chiaro";
  return (
    <Card
      scura={sfondo === "scuro"}
      className={cn(
        "p-5",
        sfondo === "indaco" && "grad-indaco text-white",
        sfondo === "ambra" && "grad-ambra text-white",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <Etichetta chiara={suScuro}>{etichetta}</Etichetta>
        {chip}
      </div>
      <Cifra taglia={taglia} className={cn("mt-3", suScuro && "text-white")}>
        {valore}
      </Cifra>
      {nota && (
        <p
          className={cn(
            "mt-1.5 text-micro",
            suScuro ? "text-white/60" : "text-inchiostro-tenue",
          )}
        >
          {nota}
        </p>
      )}
      {sotto && <div className="mt-2 text-micro">{sotto}</div>}
    </Card>
  );
}
