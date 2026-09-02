import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * La versione a schede di una tabella, per il telefono.
 *
 * Una tabella di otto colonne su uno schermo da 390 px non è una tabella: è un
 * riquadro che scorre di lato, in cui si legge una colonna alla volta e non si
 * confronta niente. Sotto il breakpoint la stessa riga diventa una scheda, con
 * il dato principale grande e gli altri come coppie etichetta/valore.
 *
 * I pezzi stanno qui e non copiati in ogni schermata: erano già duplicati fra
 * fatture e costi, e ogni copia in più è una che fra sei mesi ha un padding
 * diverso dalle altre.
 */

/** L'elenco. Sostituisce la tabella sotto `md`, dove la tabella resta nascosta. */
export function ElencoSchede({
  className,
  ...props
}: React.HTMLAttributes<HTMLUListElement>) {
  return <ul className={cn("divide-y divide-bordo md:hidden", className)} {...props} />;
}

export function Scheda({ className, ...props }: React.HTMLAttributes<HTMLLIElement>) {
  return <li className={cn("p-4", className)} {...props} />;
}

/**
 * La testata di una scheda: a sinistra fino a tre righe di identificazione, a
 * destra l'importo che conta. È la gerarchia che su una riga di tabella danno
 * la posizione delle colonne e che qui va ricostruita.
 */
export function SchedaTesta({
  sopra,
  titolo,
  sotto,
  valore,
  notaValore,
  className,
}: {
  sopra?: React.ReactNode;
  titolo: React.ReactNode;
  sotto?: React.ReactNode;
  valore?: React.ReactNode;
  notaValore?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        {sopra && <p className="cifre text-etichetta text-inchiostro-tenue">{sopra}</p>}
        <p className="truncate text-corpo font-medium">{titolo}</p>
        {sotto && <p className="truncate text-etichetta text-inchiostro-tenue">{sotto}</p>}
      </div>
      {valore !== undefined && (
        <div className="shrink-0 text-right">
          <p className="cifre text-kpi-sm font-semibold tabular-nums">{valore}</p>
          {notaValore && <p className="text-micro text-inchiostro-tenue">{notaValore}</p>}
        </div>
      )}
    </div>
  );
}

export type VoceScheda = {
  etichetta: string;
  valore: React.ReactNode;
  /** La voce sparisce quando non ha niente da dire, invece di mostrare uno zero. */
  mostra?: boolean;
};

/**
 * Le coppie etichetta/valore che sulla tabella erano colonne.
 *
 * Due per riga fin dove ci stanno: a 320 px una sola, perché una cifra in euro
 * mandata a capo a metà è peggio di una riga in più.
 */
export function SchedaVoci({ voci, className }: { voci: VoceScheda[]; className?: string }) {
  const visibili = voci.filter((v) => v.mostra !== false);
  if (visibili.length === 0) return null;
  return (
    <dl className={cn("mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 min-[360px]:grid-cols-2", className)}>
      {visibili.map((v) => (
        <div key={v.etichetta} className="flex items-baseline justify-between gap-2">
          <dt className="text-etichetta text-inchiostro-tenue">{v.etichetta}</dt>
          <dd className="cifre text-etichetta font-medium tabular-nums">{v.valore}</dd>
        </div>
      ))}
    </dl>
  );
}

/** La riga dei totali, che nella tabella è il piede fisso. */
export function SchedaTotale({
  etichetta = "Totale",
  valore,
  nota,
}: {
  etichetta?: string;
  valore: React.ReactNode;
  nota?: React.ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 bg-superficie-alt p-4">
      <span className="text-etichetta font-medium">{etichetta}</span>
      {nota && <span className="text-micro text-inchiostro-tenue">{nota}</span>}
      <span className="cifre text-corpo font-semibold tabular-nums">{valore}</span>
    </li>
  );
}
