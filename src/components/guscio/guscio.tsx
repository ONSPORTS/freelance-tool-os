"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Segmenti } from "@/components/ui/segmenti";
import { useCalcoloAnno } from "@/lib/dati/hooks";
import { cambiaRegime } from "@/lib/dati/azioni";
import { usePreferenze } from "@/lib/stato/preferenze";
import { GRUPPI, type Voce } from "./navigazione";
import { SelettorePeriodo } from "./selettore-periodo";

/**
 * Il guscio dell'applicazione: navigazione a sinistra, selettore di periodo e
 * regime in testa. Il toggle di regime scrive nelle impostazioni dell'anno, e
 * ogni schermata si riconfigura da sola perché tutto discende dai dati grezzi.
 */
export function Guscio({
  titolo,
  descrizione,
  azioni,
  children,
}: {
  titolo: string;
  descrizione?: string;
  azioni?: React.ReactNode;
  children: React.ReactNode;
}) {
  const periodo = usePreferenze((s) => s.periodo);
  const impostaPeriodo = usePreferenze((s) => s.impostaPeriodo);

  // Lo stato di interfaccia è persistito: va reidratato dopo il montaggio,
  // altrimenti il primo render nel browser partirebbe da uno stato diverso
  // da quello generato staticamente.
  React.useEffect(() => {
    void usePreferenze.persist.rehydrate();
  }, []);

  const oggi = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const calcolo = useCalcoloAnno(periodo.anno, oggi);
  const regime = calcolo?.impostazioni.regime ?? "forfettario";

  return (
    <div className="flex min-h-dvh">
      <BarraLaterale />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-bordo bg-fondo/85 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 lg:px-8">
            <div className="flex min-w-0 items-center gap-2">
              <MenuMobile />
              <div className="min-w-0">
              <h1 className="truncate font-display text-kpi-sm font-semibold">{titolo}</h1>
              {descrizione && (
                <p className="truncate text-etichetta text-inchiostro-tenue">{descrizione}</p>
              )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SelettorePeriodo periodo={periodo} onChange={impostaPeriodo} />
              <Segmenti
                etichettaGruppo="Regime fiscale"
                valore={regime}
                onChange={(r) => void cambiaRegime(periodo.anno, r)}
                opzioni={[
                  { valore: "forfettario", etichetta: "Forfettario" },
                  { valore: "ordinario", etichetta: "Ordinario" },
                ]}
              />
              {azioni}
            </div>
          </div>
        </header>

        <main className="flex-1 px-5 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function Marchio() {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-2">
      <span className="flex size-8 items-center justify-center rounded-campo bg-inchiostro text-white">
        <Wallet className="size-4" aria-hidden />
      </span>
      <span className="font-display text-corpo font-semibold leading-tight">
        Freelance Flow
      </span>
    </Link>
  );
}

function ElencoSezioni({ onNaviga }: { onNaviga?: () => void }) {
  const percorso = usePathname();
  return (
    <div className="flex flex-col gap-5">
      {GRUPPI.map((gruppo) => {
        const voci = gruppo.voci;
        return (
          <div key={gruppo.titolo}>
            <p className="px-2 pb-1.5 text-micro text-inchiostro-tenue">{gruppo.titolo}</p>
            <ul className="flex flex-col gap-0.5">
              {voci.map((voce) => (
                <li key={voce.href}>
                  <VoceNav voce={voce} attiva={percorso === voce.href} onNaviga={onNaviga} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function BarraLaterale() {
  return (
    <nav
      aria-label="Sezioni"
      className="hidden w-60 shrink-0 flex-col gap-6 border-r border-bordo bg-superficie px-3 py-5 lg:flex"
    >
      <Marchio />
      <ElencoSezioni />
    </nav>
  );
}

/** Sotto i 1024 px la barra laterale non c'è: senza questo il telefono resta
 *  bloccato sulla schermata da cui è partito. */
function MenuMobile() {
  const [aperto, setAperto] = React.useState(false);
  return (
    <Dialog open={aperto} onOpenChange={setAperto}>
      <DialogTrigger asChild>
        <Button variante="contorno" taglia="icona" className="lg:hidden" aria-label="Apri le sezioni">
          <Menu className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent
        titolo="Sezioni"
        className="left-0 top-0 h-dvh w-[min(18rem,85vw)] max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none rounded-r-card"
      >
        <ElencoSezioni onNaviga={() => setAperto(false)} />
        <DialogClose className="sr-only">Chiudi</DialogClose>
      </DialogContent>
    </Dialog>
  );
}

function VoceNav({
  voce,
  attiva,
  onNaviga,
}: {
  voce: Voce;
  attiva: boolean;
  onNaviga?: () => void;
}) {
  const contenuto = (
    <>
      <voce.icona className="size-4 shrink-0" aria-hidden />
      <span className="truncate">{voce.etichetta}</span>
      {!voce.pronta && (
        <span className="ml-auto text-micro text-inchiostro-tenue/70">presto</span>
      )}
    </>
  );

  const classi = cn(
    "flex w-full items-center gap-2.5 rounded-campo px-2 py-2 text-etichetta transition-colors duration-150",
    attiva
      ? "bg-accento-tenue font-medium text-accento"
      : voce.pronta
        ? "text-inchiostro hover:bg-superficie-alt"
        : "cursor-not-allowed text-inchiostro-tenue/60",
  );

  if (!voce.pronta) {
    return (
      <span className={classi} aria-disabled="true">
        {contenuto}
      </span>
    );
  }
  return (
    <Link
      href={voce.href}
      className={classi}
      aria-current={attiva ? "page" : undefined}
      onClick={onNaviga}
    >
      {contenuto}
    </Link>
  );
}
