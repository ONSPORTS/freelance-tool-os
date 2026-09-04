"use client";

import * as React from "react";
import Link from "next/link";
import { Check, ExternalLink, Plus, RotateCcw, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BloccoScrittura } from "@/components/ui/blocco-scrittura";
import { Card, CardCorpo, CardInterna, CardSottotitolo, CardTitolo } from "@/components/ui/card";
import { CaricamentoTabella } from "@/components/ui/caricamento";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Segmenti } from "@/components/ui/segmenti";
import { Guscio } from "@/components/guscio/guscio";
import { AvvisoParametri } from "@/components/fisco/avviso-parametri";
import {
  dichiaraEsenzione,
  dichiaraParametro,
  dichiaraScaglioni,
  ripristinaParametro,
} from "@/lib/dati/azioni";
import { useCalcoloAnno } from "@/lib/dati/hooks";
import {
  campiPertinenti,
  dichiarato,
  eAddizionale,
  elencoInTesto,
  leggiValore,
  messaggioFuoriScala,
  nellaScala,
  valoreDi,
  aliquoteIrpefNonDichiarate,
  type DefinizioneCampo,
} from "@/lib/fisco/parametri-utente";
import { controllaScaglioni } from "@/lib/fisco/addizionali";
import { frazioneDaPercentuale } from "@/lib/fisco/aritmetica";
import type { CampoAddizionale } from "@/lib/fisco/parametri-utente";
import type { Impostazioni, ScaglioneIrpef } from "@/lib/fisco/tipi";
import { usePreferenze } from "@/lib/stato/preferenze";
import { analizzaNumero, euro, perCampo } from "@/lib/format";
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
            // Cambiando anno cambiano i valori, ma i campi degli scaglioni
            // partono da `defaultValue` e resterebbero fermi su quelli
            // dell'anno prima: la chiave con l'anno li fa rinascere.
            key={`${anno}:${c.campo}`}
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
  const addizionale = eAddizionale(d.campo) ? d.campo : null;
  const scaglioni = addizionale
    ? (addizionale === "addizionaleRegionale"
        ? imp.scaglioniAddizionaleRegionale
        : imp.scaglioniAddizionaleComunale) ?? null
    : null;
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

        {addizionale && (
          <BloccoScrittura>
            <div className="mt-4">
              <Segmenti
                etichettaGruppo="Come si applica"
                valore={scaglioni ? "scaglioni" : "unica"}
                onChange={(modo) =>
                  void dichiaraScaglioni(
                    anno,
                    addizionale,
                    modo === "scaglioni" ? scaglioniIniziali(imp[d.campo] as number) : null,
                    // Scegliere la forma non è ancora rispondere: le righe
                    // partono dall'aliquota media e restano predefinite finché
                    // non le si tocca.
                    false,
                  )
                }
                opzioni={[
                  { valore: "unica", etichetta: "Aliquota unica" },
                  { valore: "scaglioni", etichetta: "A scaglioni" },
                ]}
              />
            </div>
          </BloccoScrittura>
        )}

        {addizionale && scaglioni ? (
          <EditorScaglioni
            campo={addizionale}
            scaglioni={scaglioni}
            anno={anno}
            confermato={confermato}
          />
        ) : (
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

        </div>
        )}

        {addizionale && (
          <Esenzione
            campo={addizionale}
            valore={
              (addizionale === "addizionaleRegionale"
                ? imp.esenzioneAddizionaleRegionale
                : imp.esenzioneAddizionaleComunale) ?? 0
            }
            anno={anno}
          />
        )}

        {confermato && (
          <div className="mt-3">
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
          </div>
        )}

        {/*
          L'icona del collegamento esterno c'era anche dove non c'era nessun
          collegamento: prometteva un'azione che non esisteva. Ora compare solo
          accanto a un link vero, e i link sono solo quelli che reggono nel
          tempo — i domini istituzionali, non le pagine delle singole regioni,
          che in due anni diventano collegamenti rotti dentro un prodotto
          venduto.
        */}
        <CardInterna className="mt-4 p-3">
          <p className="text-etichetta text-inchiostro-tenue">
            <span className="font-medium text-inchiostro">Dove lo trovi: </span>
            {d.doveTrovarlo}
          </p>
          {d.fonte && (
            <a
              href={d.fonte.href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-etichetta font-medium text-accento underline underline-offset-2"
            >
              <ExternalLink className="size-3.5" aria-hidden />
              {d.fonte.etichetta}
            </a>
          )}
        </CardInterna>
      </CardCorpo>
    </Card>
  );
}

/**
 * Il primo assetto quando si passa agli scaglioni.
 *
 * Si parte dall'aliquota che c'era, su due righe: una da riempire e una
 * «oltre». Partire da un elenco vuoto costringerebbe a costruire tutto prima
 * di vedere qualcosa, e nel frattempo il calcolo non avrebbe scaglioni validi.
 */
function scaglioniIniziali(aliquota: number): ScaglioneIrpef[] {
  return [
    { limite: 15_000, aliquota },
    { limite: null, aliquota },
  ];
}

/**
 * Gli scaglioni di un'addizionale, modificabili riga per riga.
 *
 * Stessa forma degli scaglioni IRPEF perché è la stessa cosa: un limite e
 * un'aliquota, l'ultima riga senza tetto. Si salva solo quando l'elenco sta in
 * piedi — limiti crescenti, una sola riga «oltre» — perché un elenco a metà
 * produrrebbe un'imposta plausibile e sbagliata a ogni tasto premuto.
 */
function EditorScaglioni({
  campo,
  scaglioni,
  anno,
  confermato,
}: {
  campo: CampoAddizionale;
  scaglioni: ScaglioneIrpef[];
  anno: number;
  confermato: boolean;
}) {
  const [bozza, setBozza] = React.useState<ScaglioneIrpef[] | null>(null);
  const righe = bozza ?? scaglioni;
  const errore = controllaScaglioni(righe);

  function cambia(prossime: ScaglioneIrpef[]) {
    setBozza(prossime);
    if (controllaScaglioni(prossime) === null) void dichiaraScaglioni(anno, campo, prossime);
  }

  function modifica(indice: number, campoRiga: "limite" | "aliquota", testo: string) {
    const n = analizzaNumero(testo);
    const prossime = righe.map((r, i) =>
      i !== indice
        ? r
        : campoRiga === "limite"
          ? { ...r, limite: n }
          : { ...r, aliquota: n === null ? 0 : frazioneDaPercentuale(n) },
    );
    cambia(prossime);
  }

  return (
    <BloccoScrittura>
      <div className="mt-4 space-y-2">
        {righe.map((r, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <span className="w-16 shrink-0 text-etichetta text-inchiostro-tenue">
              {i === 0 ? "fino a" : r.limite === null ? "oltre" : "fino a"}
            </span>
            {r.limite === null ? (
              <span className="w-32 shrink-0 text-etichetta text-inchiostro-tenue">
                il resto
              </span>
            ) : (
              <div className="flex items-center gap-1.5">
                <Input
                  numerico
                  inputMode="decimal"
                  aria-label={`Limite dello scaglione ${i + 1}`}
                  className="w-28"
                  defaultValue={perCampo(r.limite, 0)}
                  onChange={(e) => modifica(i, "limite", e.target.value)}
                />
                <span className="text-etichetta text-inchiostro-tenue">€</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Input
                numerico
                inputMode="decimal"
                aria-label={`Aliquota dello scaglione ${i + 1}`}
                className="w-24"
                defaultValue={perCampo(r.aliquota * 100, 2)}
                onChange={(e) => modifica(i, "aliquota", e.target.value)}
              />
              <span className="text-etichetta text-inchiostro-tenue">%</span>
            </div>
            {righe.length > 2 && (
              <button
                type="button"
                aria-label={`Togli lo scaglione ${i + 1}`}
                onClick={() => cambia(righe.filter((_, k) => k !== i))}
                className="rounded-campo p-1.5 text-inchiostro-tenue transition-colors hover:bg-superficie-alt hover:text-negativo"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button
            scrive
            variante="quieto"
            taglia="sm"
            onClick={() => {
              // Il nuovo scaglione entra prima dell'ultimo, che è «oltre»:
              // aggiungerlo in fondo produrrebbe due righe senza tetto.
              const penultimo = righe[righe.length - 2];
              const nuovo: ScaglioneIrpef = {
                limite: (penultimo?.limite ?? 0) + 10_000,
                aliquota: righe[righe.length - 1].aliquota,
              };
              cambia([...righe.slice(0, -1), nuovo, righe[righe.length - 1]]);
            }}
          >
            <Plus className="size-3.5" aria-hidden />
            Aggiungi uno scaglione
          </Button>
          <p className={cn("text-etichetta", errore ? "text-[#C13237]" : "text-inchiostro-tenue")}>
            {errore ??
              (confermato
                ? "Scaglioni dichiarati da te: si applicano progressivamente, come l'IRPEF."
                : "Si applicano progressivamente: ogni fetta di reddito paga la sua aliquota.")}
          </p>
        </div>
      </div>
    </BloccoScrittura>
  );
}

/**
 * La soglia sotto la quale l'addizionale non è dovuta.
 *
 * Non è una franchigia, ed è l'errore facile da fare: superata la soglia si
 * paga sull'intero imponibile, non sull'eccedenza. Chi la trattasse come una
 * franchigia sottostimerebbe l'imposta di chi le sta appena sopra.
 */
function Esenzione({
  campo,
  valore,
  anno,
}: {
  campo: CampoAddizionale;
  valore: number;
  anno: number;
}) {
  const id = React.useId();
  return (
    <BloccoScrittura>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor={id} className="block text-etichetta text-inchiostro-tenue">
            Soglia di esenzione
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <Input
              id={id}
              numerico
              inputMode="decimal"
              className="w-32"
              defaultValue={valore > 0 ? perCampo(valore, 0) : ""}
              placeholder="nessuna"
              onChange={(e) => {
                const n = analizzaNumero(e.target.value);
                void dichiaraEsenzione(anno, campo, n ?? 0);
              }}
            />
            <span className="text-etichetta text-inchiostro-tenue">€</span>
          </div>
        </div>
        <p className="flex-1 text-etichetta text-inchiostro-tenue">
          {valore > 0
            ? `Fino a ${euro(valore)} di imponibile non è dovuta. Sopra si paga sull'intero imponibile, non sulla parte eccedente: è una soglia, non una franchigia.`
            : "Molti comuni e diverse regioni esentano i redditi bassi. Lascia vuoto se non è il tuo caso."}
        </p>
      </div>
    </BloccoScrittura>
  );
}
