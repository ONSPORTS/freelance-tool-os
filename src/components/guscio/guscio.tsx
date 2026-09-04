"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useCalcoloAnno } from "@/lib/dati/hooks";
import { usePreferenze } from "@/lib/stato/preferenze";
import { useComandi } from "@/lib/stato/comandi";
import { useAvvioLicenza } from "@/lib/stato/licenza";
import { ErroreSolaLettura } from "@/lib/dati/sola-lettura";
import { toast } from "@/components/ui/toast";
import { BarraLicenza } from "./barra-licenza";
import { SegnoFlowlance } from "./marchio";
import { RegimeAttuale } from "./regime-attuale";
import { Paletta, Tasto } from "@/components/comandi/paletta";
import { ScorciatoieGlobali } from "@/components/comandi/tasti";
import { GRUPPI, type Voce } from "./navigazione";
import { SelettorePeriodo } from "./selettore-periodo";
import type { StatoDellAnno } from "./stato-anno";
import type { Periodo } from "@/lib/periodo";
import type { Regime } from "@/lib/fisco/tipi";

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

  // Verifica la chiave salvata e accende la guardia dell'archivio.
  useAvvioLicenza(oggi);
  useAvvisoSolaLettura();

  // I parametri provvisori vincono sullo stato di chiusura: sono la cosa che
  // cambia il significato dei numeri a schermo, non solo la loro modificabilità.
  const statoAnno: StatoDellAnno | undefined = calcolo
    ? calcolo.parametri.provvisorio
      ? "provvisorio"
      : calcolo.chiuso
        ? "chiuso"
        : "aperto"
    : undefined;

  return (
    // `print:block` scioglie il flex: in stampa non c'è una colonna laterale
    // accanto a cui stare, e il documento deve partire dal margine.
    <div className="flex min-h-dvh print:block">
      {/* La palette e i tasti stanno nel guscio: valgono su ogni schermata, e
          il guscio è l'unica cosa che ogni schermata ha davvero in comune. */}
      <Paletta />
      <ScorciatoieGlobali />
      <BarraLaterale />

      <div className="flex min-w-0 flex-1 flex-col">
        <BarraLicenza />
        <header className="sticky top-0 z-30 border-b border-bordo bg-fondo/85 backdrop-blur-sm print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 sm:gap-3 sm:px-5 sm:py-3 lg:px-8">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <MenuMobile />
              <BottoneCerca />
              <div className="min-w-0">
                <h1 className="truncate font-display text-kpi-sm font-semibold">{titolo}</h1>
                {/* La descrizione sul telefono si riduceva a «Registro…», che non
                    dice niente e ruba al titolo lo spazio per essere letto. */}
                {descrizione && (
                  <p className="hidden truncate text-etichetta text-inchiostro-tenue sm:block">
                    {descrizione}
                  </p>
                )}
              </div>
              {/*
                Sul telefono i quattro controlli della testata — anno, stato,
                regime, parametri — occupavano da soli centottantatré pixel su
                cinquecentosessantotto: più di un terzo dello schermo, fermo lì
                a ogni schermata. Qui diventano un riepilogo che li dice tutti e
                quattro in una riga e si apre per cambiarli.
              */}
              <RiepilogoPeriodo
                periodo={periodo}
                onChange={impostaPeriodo}
                statoAnno={statoAnno}
                regime={regime}
                className="ml-auto shrink-0 sm:hidden"
              />
            </div>
            <div className="hidden w-full flex-wrap items-center gap-2 sm:flex lg:w-auto">
              <SelettorePeriodo
                periodo={periodo}
                onChange={impostaPeriodo}
                statoAnno={statoAnno}
              />
              <RegimeAttuale regime={regime} />
            </div>
            {/*
              Le azioni prendono tutta la riga sul telefono e si dividono lo
              spazio: due pulsanti mezzi tagliati non si premono, e uno stretto
              accanto a uno largo sembra un errore di impaginazione.
            */}
            {azioni && (
              <span className="flex w-full flex-wrap items-center gap-2 [&>*]:flex-1 [&>*]:basis-[calc(50%-0.25rem)] sm:ml-auto sm:w-auto sm:justify-end sm:[&>*]:flex-none sm:[&>*]:basis-auto">
                {azioni}
              </span>
            )}
          </div>
        </header>

        <main className="flex-1 px-4 py-5 sm:px-5 sm:py-6 lg:px-8 print:p-0">{children}</main>
      </div>
    </div>
  );
}

/**
 * La rete di sicurezza per una scrittura che l'interfaccia non ha spento.
 *
 * I pulsanti che scrivono sono disabilitati a licenza scaduta, ma sono tanti e
 * ne verranno altri: se uno sfugge, la guardia dell'archivio rifiuta comunque
 * la scrittura. Senza questo, quel rifiuto sarebbe una promessa non gestita in
 * console — l'utente cliccherebbe e non succederebbe niente, che è il modo
 * peggiore di dire di no.
 */
function useAvvisoSolaLettura() {
  React.useEffect(() => {
    function suRifiuto(e: PromiseRejectionEvent) {
      if (!(e.reason instanceof ErroreSolaLettura)) return;
      e.preventDefault();
      toast.avviso("Licenza scaduta: l'app è in sola lettura.");
    }
    window.addEventListener("unhandledrejection", suRifiuto);
    return () => window.removeEventListener("unhandledrejection", suRifiuto);
  }, []);
}

/**
 * L'ingresso della palette per chi non conosce ⌘K.
 *
 * Le scorciatoie sono un acceleratore, non un requisito: tutto quello che
 * fanno deve restare a un clic di distanza. Il badge accanto insegna la
 * combinazione a chi la userà la prossima volta.
 */
function BottoneCerca() {
  const apri = useComandi((s) => s.apriPaletta);
  return (
    <button
      type="button"
      onClick={apri}
      aria-label="Apri i comandi"
      className={cn(
        // Sul telefono è un quadrato da premere, non un'etichetta: sotto i
        // quarantaquattro pixel il pollice manca il bersaglio.
        "flex size-11 shrink-0 items-center justify-center gap-2 rounded-campo border border-bordo bg-superficie text-inchiostro-tenue transition-colors sm:size-auto sm:px-2 sm:py-1.5",
        "hover:border-inchiostro-tenue/40 hover:text-inchiostro",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accento focus-visible:ring-offset-2 focus-visible:ring-offset-fondo",
      )}
    >
      <Search className="size-4" aria-hidden />
      <span className="hidden text-etichetta sm:inline">Cerca</span>
      <span className="hidden sm:inline">
        <Tasto>⌘K</Tasto>
      </span>
    </button>
  );
}

function Marchio() {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-2">
      <SegnoFlowlance className="size-8 shrink-0" />
      <span className="font-display text-corpo font-semibold leading-tight">
        Flowlance
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
      className="hidden w-60 shrink-0 flex-col gap-6 border-r border-bordo bg-superficie px-3 py-5 lg:flex print:!hidden"
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
      {/*
        `shrink-0`: senza, il flex della testata comprimeva il bersaglio a 26 px
        di larghezza su uno schermo da 320, contro i 36 dichiarati.
      */}
      <DialogTrigger asChild>
        <Button
          variante="contorno"
          taglia="icona"
          className="shrink-0 lg:hidden"
          aria-label="Apri le sezioni"
        >
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

/**
 * Il riepilogo del periodo, per il telefono.
 *
 * Dice le stesse quattro cose della testata larga — che anno stai guardando,
 * se è chiuso, in che regime, se i parametri sono provvisori — in una riga
 * sola, e si apre per cambiarle. Non è una scorciatoia nascosta: è la testata,
 * ripiegata. Su schermo largo non esiste.
 */
function RiepilogoPeriodo({
  periodo,
  onChange,
  statoAnno,
  regime,
  className,
}: {
  periodo: Periodo;
  onChange: (p: Periodo) => void;
  statoAnno?: StatoDellAnno;
  regime: Regime;
  className?: string;
}) {
  const [aperto, setAperto] = React.useState(false);

  return (
    <Dialog open={aperto} onOpenChange={setAperto}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex min-h-11 items-center gap-1.5 rounded-full border border-bordo bg-superficie px-3 text-etichetta font-medium",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accento focus-visible:ring-offset-2",
            className,
          )}
        >
          <span className="cifre">{periodo.anno}</span>
          {statoAnno && <PalliniStato stato={statoAnno} />}
          {/* Sotto i 360 px il regime esce dal riepilogo: il titolo della
              schermata viene prima, e il regime resta dentro, a un tocco. */}
          <span className="hidden text-inchiostro-tenue min-[360px]:inline">
            {regime === "forfettario" ? "forf." : "ord."}
          </span>
          <ChevronDown className="size-3.5 text-inchiostro-tenue" aria-hidden />
        </button>
      </DialogTrigger>
      <DialogContent
        titolo="Periodo e regime"
        descrizione="Vale per tutte le schermate: quello che vedi è sempre di questo periodo."
      >
        <div className="space-y-4">
          <SelettorePeriodo periodo={periodo} onChange={onChange} statoAnno={statoAnno} />
          {/*
            Anno e stato qui dentro si cambiano; il regime no. Messo accanto a
            loro come una tendina qualsiasi prometterebbe la stessa cosa: resta
            un rimando, con la freccia e la frase che dicono dove porta.
          */}
          <div>
            <p className="mb-1.5 text-etichetta text-inchiostro-tenue">Regime fiscale</p>
            <RegimeAttuale regime={regime} onNaviga={() => setAperto(false)} />
            <p className="mt-1.5 text-etichetta text-inchiostro-tenue">
              Si cambia dalla configurazione, che spiega prima cosa comporta: IVA in
              fattura, deducibilità dei costi, imposta.
            </p>
          </div>
          <p className="text-etichetta text-inchiostro-tenue">
            Le aliquote che dipendono da te — addizionali, contributi — si dichiarano nei{" "}
            <Link href="/parametri" className="underline underline-offset-2" onClick={() => setAperto(false)}>
              Parametri
            </Link>
            .
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Il pallino di stato dell'anno: colore e basta, la parola sta nel dialogo. */
function PalliniStato({ stato }: { stato: StatoDellAnno }) {
  const colore =
    stato === "provvisorio"
      ? "bg-[#B8791A]"
      : stato === "chiuso"
        ? "bg-inchiostro-tenue"
        : "bg-[#0B8A63]";
  return (
    <span
      className={cn("size-1.5 rounded-full", colore)}
      title={
        stato === "provvisorio"
          ? "Parametri provvisori"
          : stato === "chiuso"
            ? "Anno chiuso"
            : "Anno aperto"
      }
    />
  );
}
