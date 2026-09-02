"use client";

import * as React from "react";
import Link from "next/link";
import { CircleAlert, Clock } from "lucide-react";
import { descrizione, giorniInParole, preavviso, solaLettura } from "@/lib/licenza/stato";
import { useStatoLicenza } from "@/lib/stato/licenza";

/**
 * La riga sulla licenza, sopra il contenuto.
 *
 * Compare in due soli casi: negli ultimi quindici giorni, e quando la licenza è
 * finita. Nel primo è una riga sottile che si legge e si ignora — un avviso che
 * si ripete a ogni schermata per due settimane diventa rumore, e il rumore si
 * smette di leggere proprio quando conta. Nel secondo è più netta, perché a quel
 * punto metà dei pulsanti non risponde e va detto perché.
 *
 * In stampa non c'è: il prospetto per il commercialista non parla di licenze.
 */
export function BarraLicenza() {
  const oggi = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const stato = useStatoLicenza(oggi);
  const giorni = preavviso(stato);
  const bloccata = solaLettura(stato);

  if (!bloccata && giorni === null) return null;

  if (bloccata) {
    return (
      <div
        role="status"
        className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-negativo/25 bg-negativo/10 px-4 py-2 sm:px-5 lg:px-8 print:hidden"
      >
        <CircleAlert className="size-4 shrink-0 text-negativo" aria-hidden />
        <p className="min-w-0 text-etichetta">
          <span className="font-medium">{descrizione(stato)}.</span>{" "}
          <span className="text-inchiostro-tenue">
            L&apos;app è in sola lettura: si consulta tutto, non si inserisce niente.
            L&apos;esportazione dei dati resta attiva.
          </span>
        </p>
        <Link
          href="/licenza"
          className="ml-auto shrink-0 text-etichetta font-medium text-accento underline underline-offset-2"
        >
          Inserisci una chiave
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-bordo bg-superficie-alt px-4 py-1.5 sm:px-5 lg:px-8 print:hidden">
      <Clock className="size-3.5 shrink-0 text-inchiostro-tenue" aria-hidden />
      <p className="min-w-0 text-micro text-inchiostro-tenue">
        {descrizione(stato)}: {giorniInParole(giorni as number)}.
      </p>
      <Link
        href="/licenza"
        className="ml-auto shrink-0 text-micro text-inchiostro-tenue underline underline-offset-2 hover:text-inchiostro"
      >
        Gestisci
      </Link>
    </div>
  );
}
