"use client";

import * as React from "react";
import Link from "next/link";
import { Check, ExternalLink, RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BloccoScrittura } from "@/components/ui/blocco-scrittura";
import { Card, CardCorpo, CardInterna, CardSottotitolo, CardTitolo } from "@/components/ui/card";
import { CaricamentoTabella } from "@/components/ui/caricamento";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Guscio } from "@/components/guscio/guscio";
import { AvvisoParametri } from "@/components/fisco/avviso-parametri";
import { dichiaraParametro, ripristinaParametro } from "@/lib/dati/azioni";
import { useCalcoloAnno } from "@/lib/dati/hooks";
import {
  campiPertinenti,
  dichiarato,
  elencoInTesto,
  leggiValore,
  messaggioFuoriScala,
  nellaScala,
  valoreDi,
  aliquoteIrpefNonDichiarate,
  type DefinizioneCampo,
} from "@/lib/fisco/parametri-utente";
import type { Impostazioni } from "@/lib/fisco/tipi";
import { usePreferenze } from "@/lib/stato/preferenze";
import { perCampo } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * I parametri che l'app non può conoscere.
 *
 * Non è un pannello di preferenze: è la schermata in cui l'utente prende in
 * carico i numeri che riguardano solo lui. Finché non lo fa, il calcolo gira su
 * medie — deve girare, altrimenti l'app non direbbe niente — e ogni schermata
 * che li mostra li chiama predefiniti. Il prospetto in PDF invece non esce
 * proprio: è l'unico documento che lascia l'app e va da un'altra persona.
 */
export function SchermataParametri() {
  const anno = usePreferenze((s) => s.periodo.anno);
  const [oggi] = React.useState(() => new Date().toISOString().slice(0, 10));
  const calcolo = useCalcoloAnno(anno, oggi);

  if (!calcolo) {
    return (
      <Guscio titolo="Parametri">
        <Card>
          <CaricamentoTabella righe={5} />
        </Card>
      </Guscio>
    );
  }

  const imp = calcolo.impostazioni;
  const campi = campiPertinenti(imp);
  const mancanti = campi.filter((c) => !dichiarato(imp, c.campo));
  const bloccanti = aliquoteIrpefNonDichiarate(imp);

  return (
    <Guscio
      titolo="Parametri"
      descrizione={`Anno ${anno} · ${campi.length - mancanti.length} su ${campi.length} confermati`}
    >
      <div className="mx-auto max-w-3xl space-y-4">
        <AvvisoParametri anno={anno} />

        <Card>
          <CardCorpo>
            <CardTitolo>I numeri che dipendono da te</CardTitolo>
            <CardSottotitolo>
              Le aliquote nazionali le sa l&apos;app e si aggiornano da sole. Queste no:
              cambiano con la regione in cui vivi, il comune, la cassa a cui versi. Finché non
              le confermi il calcolo gira su una media — deve girare, altrimenti l&apos;app non
              direbbe niente — e ovunque compaiano sono marcate come predefinite.
            </CardSottotitolo>

            {bloccanti.length > 0 ? (
              <CardInterna className="mt-4 border border-attenzione/25 bg-attenzione-tenue p-4">
                <p className="flex items-start gap-2 text-etichetta text-[#B8791A]">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    <span className="font-semibold">
                      L&apos;export del prospetto è bloccato.
                    </span>{" "}
                    {elencoInTesto(bloccanti)} non{" "}
                    {bloccanti.length === 1 ? "è confermata" : "sono confermate"}, e il
                    prospetto è il documento che va dal commercialista: non deve contenere
                    aliquote che non hai mai dichiarato. Il calcolo a schermo continua, con la
                    media.
                  </span>
                </p>
              </CardInterna>
            ) : (
              mancanti.length === 0 && (
                <p className="mt-4 flex items-start gap-2 text-etichetta text-[#0B8A63]">
                  <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
                  Tutti i parametri del {anno} sono tuoi. Il prospetto si esporta e ogni numero
                  è difendibile.
                </p>
              )
            )}

            {/*
              Le aliquote cambiano ogni gennaio, e l'anno nuovo eredita quelle
              dichiarate l'anno prima: sono un punto di partenza ragionevole, non
              una conferma. Dirlo qui evita che restino lì per anni.
            */}
            <p className="mt-4 text-etichetta text-inchiostro-tenue">
              Valgono per il {anno}: regioni e comuni le ritoccano ogni anno, e l&apos;anno
              nuovo parte da quelle che hai dichiarato qui. Quando cambia l&apos;anno vale la
              pena ricontrollarle.
            </p>
          </CardCorpo>
        </Card>

        {campi.map((c) => (
          <SchedaParametro
            key={c.campo}
            definizione={c}
            impostazioni={imp}
            anno={anno}
          />
        ))}

        <p className="px-1 text-etichetta text-inchiostro-tenue">
          Il resto della configurazione — regime, coefficiente, cassa, termini di pagamento —
          si risponde dalla{" "}
          <Link href="/avvio" className="underline underline-offset-2">
            Configurazione
          </Link>
          .
        </p>
      </div>
    </Guscio>
  );
}

function SchedaParametro({
  definizione: d,
  impostazioni: imp,
  anno,
}: {
  definizione: DefinizioneCampo;
  impostazioni: Impostazioni;
  anno: number;
}) {
  const confermato = dichiarato(imp, d.campo);
  const id = React.useId();
  const [bozza, setBozza] = React.useState<string | null>(null);
  const [fuoriScala, setFuoriScala] = React.useState(false);

  // Il valore a schermo: quello che si sta scrivendo, altrimenti quello salvato
  // nel formato del campo — percentuale in centesimi, gli altri così come sono.
  const valoreCampo =
    bozza ??
    (d.formato === "percentuale"
      ? perCampo((imp[d.campo] as number) * 100, 2)
      : perCampo(imp[d.campo] as number, 0));

  function scrivi(testo: string) {
    setBozza(testo);
    const letto = leggiValore(testo, d);
    // Campo ancora a metà («0,», «» dopo un fill): non è un errore, si aspetta.
    if (letto === null) return setFuoriScala(false);
    if (!nellaScala(letto, d)) return setFuoriScala(true);
    setFuoriScala(false);
    void dichiaraParametro(anno, d.campo, letto);
  }

  return (
    <Card>
      <CardCorpo>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-corpo font-semibold">{d.etichetta}</p>
            <p className="mt-0.5 text-etichetta text-inchiostro-tenue">{d.aCosaServe}</p>
          </div>
          <Chip tono={confermato ? "positivo" : "attenzione"} className="shrink-0">
            {confermato ? "dichiarato da te" : "predefinito"}
          </Chip>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <BloccoScrittura>
            <div>
              <label htmlFor={id} className="block text-etichetta text-inchiostro-tenue">
                {d.formato === "percentuale"
                  ? "Aliquota"
                  : d.formato === "euro"
                    ? "Importo annuo"
                    : "Quanti"}
              </label>
              <div className="mt-1.5 flex items-center gap-2">
                <Input
                  id={id}
                  numerico
                  inputMode="decimal"
                  className="w-40"
                  value={valoreCampo}
                  onChange={(e) => scrivi(e.target.value)}
                  onBlur={() => {
                    setBozza(null);
                    setFuoriScala(false);
                  }}
                />
                <span className="text-etichetta text-inchiostro-tenue">
                  {d.formato === "percentuale" ? "%" : d.formato === "euro" ? "€" : ""}
                </span>
              </div>
            </div>
          </BloccoScrittura>

          <p
            className={cn(
              "flex-1 text-etichetta",
              fuoriScala
                ? "text-[#C13237]"
                : confermato
                  ? "text-inchiostro-tenue"
                  : "text-[#B8791A]",
            )}
          >
            {fuoriScala
              ? messaggioFuoriScala(d)
              : confermato
                ? `In uso: ${valoreDi(imp, d.campo)}. Valore dichiarato da te.`
                : d.incideSu === "imposte"
                  ? `In uso: ${valoreDi(imp, d.campo)}. Media dell'app: non è detto che sia quella giusta per te.`
                  : `In uso: ${valoreDi(imp, d.campo)}. Valore predefinito: mettici il tuo.`}
          </p>

          {confermato && (
            <Button
              scrive
              variante="quieto"
              taglia="sm"
              onClick={() => {
                setBozza(null);
                void ripristinaParametro(anno, d.campo);
              }}
            >
              <RotateCcw className="size-3.5" aria-hidden />
              Non lo so
            </Button>
          )}
        </div>

        <CardInterna className="mt-4 flex items-start gap-2 p-3">
          <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-inchiostro-tenue" aria-hidden />
          <p className="min-w-0 text-etichetta text-inchiostro-tenue">
            <span className="font-medium text-inchiostro">Dove lo trovi: </span>
            {d.doveTrovarlo}
          </p>
        </CardInterna>
      </CardCorpo>
    </Card>
  );
}
