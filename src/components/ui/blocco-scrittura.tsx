"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useSolaLettura } from "@/lib/stato/licenza";

/**
 * Un gruppo di controlli che scrivono, spento in blocco a licenza scaduta.
 *
 * È un `fieldset` disabilitato: il browser spegne da sé ogni campo, menu e
 * pulsante là dentro, compresi quelli aggiunti domani. Sui moduli — registrare
 * un versamento, aggiungere una voce di patrimonio, rispondere alle domande
 * della configurazione — vale molto più che marcare un controllo alla volta,
 * perché il modulo cresce e l'elenco dei controlli marcati no.
 *
 * Attorno a un pulsante isolato è meglio `<Button scrive>`: qui il fieldset
 * porterebbe un contenitore in più solo per spegnerne uno.
 *
 * Dentro un `form` già impaginato si passa `className="contents"`: il fieldset
 * sparisce dal layout e la disabilitazione, che segue il DOM e non il rendering,
 * arriva lo stesso a tutti i controlli.
 */
export function BloccoScrittura({
  children,
  className,
  ...props
}: React.FieldsetHTMLAttributes<HTMLFieldSetElement>) {
  const bloccato = useSolaLettura();
  return (
    <fieldset
      disabled={bloccato}
      title={bloccato ? "Licenza scaduta: l'app è in sola lettura." : undefined}
      // `min-w-0`: un fieldset ha una larghezza minima implicita legata al
      // contenuto, e dentro un flex fa uscire la riga dallo schermo.
      className={cn("min-w-0 disabled:opacity-60", className)}
      {...props}
    >
      {children}
    </fieldset>
  );
}
