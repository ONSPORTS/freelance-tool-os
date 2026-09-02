"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarClock, Check, Info, TriangleAlert } from "lucide-react";
import { Card, CardCorpo, CardSottotitolo, CardTitolo } from "@/components/ui/card";
import { CaricamentoTabella } from "@/components/ui/caricamento";
import { Chip } from "@/components/ui/chip";
import { Kpi } from "@/components/ui/kpi";
import { COLORI_SEMAFORO, SemaforoFiscale } from "@/components/fisco/semaforo-fiscale";
import { GraficoAndamento } from "@/components/grafici/andamento";
import { GraficoConcentrazione } from "@/components/grafici/concentrazione";
import { Guscio } from "@/components/guscio/guscio";
import { InvitoPercorso } from "@/components/guscio/invito-percorso";
import { andamentoMensile, giorniMediIncasso, portafoglioClienti } from "@/lib/analisi/dashboard";
import { generaAvvisi, type Avviso } from "@/lib/analisi/avvisi";
import { useCalcoloAnno, useDati } from "@/lib/dati/hooks";
import { giorniAllaData } from "@/lib/fisco/calendario";
import { parametriDi } from "@/lib/fisco/parametri";
import { prossimeScadenze, scadenzeAnno, type Adempimento } from "@/lib/fisco/scadenze";
import { usePreferenze } from "@/lib/stato/preferenze";
import { coloreDaNome, data as fmtData, euro, percentuale } from "@/lib/format";
import { cn } from "@/lib/utils";

export function Cruscotto() {
  const anno = usePreferenze((s) => s.periodo.anno);
  const [oggi] = React.useState(() => new Date().toISOString().slice(0, 10));
  const dati = useDati();
  const calcolo = useCalcoloAnno(anno, oggi);

  const analisi = React.useMemo(() => {
    if (!dati || !calcolo) return null;
    const { prospetto, impostazioni, iva } = calcolo;
    const scadenze = scadenzeAnno(impostazioni, parametriDi(anno), prospetto, iva);
    return {
      mesi: andamentoMensile(prospetto.fattureCalcolate, prospetto.costiCalcolati, anno),
      portafoglio: portafoglioClienti(prospetto.fattureCalcolate, dati.clienti, anno, coloreDaNome),
      giorniMedi: giorniMediIncasso(prospetto.fattureCalcolate),
      scadenze,
      prossime: prossimeScadenze(scadenze, oggi, 4),
      avvisi: generaAvvisi({
        prospetto,
        impostazioni,
        fatture: prospetto.fattureCalcolate,
        costi: prospetto.costiCalcolati,
        scadenze,
        oggi,
      }),
    };
  }, [dati, calcolo, anno, oggi]);

  const titolo = calcolo?.impostazioni.nome?.trim() || "Cruscotto";
  const descrizione = calcolo
    ? `Anno ${anno} · regime ${calcolo.impostazioni.regime} · ${nomeGestione(calcolo.impostazioni.gestione)}`
    : undefined;

  if (!calcolo || !analisi) {
    return (
      <Guscio titolo="Cruscotto">
        <Card>
          <CaricamentoTabella righe={4} />
        </Card>
      </Guscio>
    );
  }

  const { prospetto: p, iva } = calcolo;
  const nettoSemaforo = p.incassatoLordo - p.caricoTotale - p.ivaIncassata;
  const scaduto = p.fattureCalcolate
    .filter((f) => f.stato === "scaduto")
    .reduce((a, f) => a + f.nettoIncasso, 0);
  const costiAnno = p.costiPagatiTotale;
  const margine = p.ricaviRilevanti - p.costiNettiACarico;

  return (
    <Guscio titolo={titolo} descrizione={descrizione}>
      <div className="space-y-6">
        <InvitoPercorso anno={anno} oggi={oggi} />

        <SemaforoFiscale
          totale={p.incassatoLordo}
          segmenti={[
            {
              chiave: "netto",
              etichetta: "Netto tuo",
              valore: nettoSemaforo,
              colore: COLORI_SEMAFORO.netto,
              dettaglio: `Prima dei costi dell'attività. Al netto anche di quelli restano ${euro(p.nettoDisponibile)}.`,
            },
            {
              chiave: "imposte",
              etichetta: "Imposte",
              valore: p.totaleImposte,
              colore: COLORI_SEMAFORO.imposte,
              dettaglio:
                p.regime === "forfettario"
                  ? `Imposta sostitutiva: ${euro(p.imponibile)} × ${percentuale(calcolo.impostazioni.aliquotaSostitutiva, 0)} = ${euro(p.impostaSostitutiva)}.`
                  : `IRPEF ${euro(p.irpefNetta)} più addizionali per ${euro(p.addizionaleRegionale + p.addizionaleComunale)}.`,
            },
            {
              chiave: "contributi",
              etichetta: "Contributi",
              valore: p.totaleContributi,
              colore: COLORI_SEMAFORO.contributi,
              dettaglio: `${euro(p.baseContributiva)} × ${percentuale(calcolo.impostazioni.aliquotaGestioneSeparata, 2)}, fino al massimale di ${euro(calcolo.impostazioni.massimaleGs)}.`,
            },
            {
              chiave: "iva",
              etichetta: "IVA incassata",
              valore: p.ivaIncassata,
              colore: COLORI_SEMAFORO.iva,
              dettaglio: `Riscossa dai clienti e da girare all'erario. Da versare nell'anno: ${euro(iva.totaleDaVersare)}.`,
            },
          ]}
        />

        <section aria-label="Indicatori principali" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            sfondo="indaco"
            etichetta="Incassato"
            valore={euro(p.ricaviRilevanti)}
            nota={`su ${euro(p.fatturatoEmesso)} emessi`}
            chip={
              p.fatturatoEmesso > 0 ? (
                <Chip tono="chiaro" className="cifre">
                  {percentuale(p.ricaviRilevanti / p.fatturatoEmesso, 0)}
                </Chip>
              ) : undefined
            }
          />
          <Kpi
            sfondo="ambra"
            etichetta="Da incassare"
            valore={euro(p.soglia.inSospeso)}
            nota={scaduto > 0 ? `di cui ${euro(scaduto)} già scaduti` : "tutto nei termini"}
          />
          <Kpi
            etichetta="Carico totale"
            valore={euro(p.caricoTotale)}
            nota={`imposte ${euro(p.totaleImposte)} · contributi ${euro(p.totaleContributi)}`}
          />
          <Kpi
            sfondo="scuro"
            etichetta="Pressione effettiva"
            valore={percentuale(p.pressione)}
            nota="su ogni euro incassato"
          />

          <Kpi taglia="kpiSm" etichetta="Costi dell'anno" valore={euro(costiAnno)} nota="uscita di cassa, IVA compresa" />
          <Kpi
            taglia="kpiSm"
            etichetta="Margine lordo"
            valore={euro(margine)}
            nota={p.ricaviRilevanti > 0 ? `${percentuale(margine / p.ricaviRilevanti, 0)} dell'incassato` : "—"}
          />
          <Kpi
            taglia="kpiSm"
            etichetta="Netto disponibile"
            valore={euro(p.nettoDisponibile)}
            nota="prima delle spese personali"
          />
          <Kpi
            taglia="kpiSm"
            etichetta="Da accantonare al mese"
            valore={euro(p.accantonamentoMensile)}
            nota="su un conto separato"
          />
        </section>

        <section aria-label="Cosa richiede attenzione">
          <Card>
            <CardCorpo className="pb-2">
              <CardTitolo>Cosa richiede la tua attenzione</CardTitolo>
              <CardSottotitolo>
                {analisi.giorniMedi !== null
                  ? `I tuoi clienti pagano in media in ${analisi.giorniMedi} giorni.`
                  : "Le prime fatture incassate diranno quanto ci mettono i tuoi clienti a pagare."}
              </CardSottotitolo>
            </CardCorpo>
            <ul className="divide-y divide-bordo/70">
              {analisi.avvisi.map((a) => (
                <RigaAvviso key={a.id} avviso={a} />
              ))}
            </ul>
          </Card>
        </section>

        <section aria-label="Grafici" className="grid gap-4 xl:grid-cols-2">
          <GraficoAndamento mesi={analisi.mesi} />
          <GraficoConcentrazione righe={analisi.portafoglio} />
        </section>

        <section aria-label="Prossime scadenze">
          <Card>
            <CardCorpo className="pb-2">
              <CardTitolo>Prossime scadenze</CardTitolo>
              <CardSottotitolo>
                Le date che cadono di sabato o in un festivo sono già spostate al primo
                giorno lavorativo utile.
              </CardSottotitolo>
            </CardCorpo>
            {analisi.prossime.length === 0 ? (
              <p className="px-4 pb-5 text-corpo text-inchiostro-tenue sm:px-6 sm:pb-6">
                Nessun adempimento resta nel {anno}. Il prossimo appuntamento è il saldo di
                giugno, che si calcola sulla dichiarazione di quest&apos;anno.
              </p>
            ) : (
              <ul className="divide-y divide-bordo/70">
                {analisi.prossime.map((s) => (
                  <RigaScadenza key={s.id} scadenza={s} oggi={oggi} />
                ))}
              </ul>
            )}
          </Card>
        </section>

        <p className="max-w-3xl pb-2 text-etichetta text-inchiostro-tenue">
          Strumento gestionale di pianificazione: produce stime, non dichiarazioni. Non
          considera altri redditi che in regime ordinario concorrono a formare il reddito
          complessivo e possono spostare lo scaglione IRPEF. I numeri definitivi restano
          quelli del tuo commercialista.
        </p>
      </div>
    </Guscio>
  );
}

function RigaAvviso({ avviso }: { avviso: Avviso }) {
  const Icona =
    avviso.tono === "positivo" ? Check : avviso.tono === "accento" ? Info : TriangleAlert;
  const colore = {
    positivo: "text-positivo",
    attenzione: "text-attenzione",
    negativo: "text-negativo",
    accento: "text-accento",
  }[avviso.tono];

  return (
    <li className="flex flex-wrap items-start gap-3 px-4 py-3 sm:px-6">
      <Icona className={cn("mt-0.5 size-4 shrink-0", colore)} aria-hidden />
      {/* Sul telefono il testo si stringe quanto serve; da tablet in su resta
          largo abbastanza da non spezzarsi in righe di due parole. */}
      <p className="min-w-0 flex-1 text-corpo sm:min-w-64">{avviso.testo}</p>
      {avviso.azione && (
        <Link
          href={avviso.azione.href}
          className="shrink-0 rounded-campo px-2 py-2 text-etichetta font-medium text-accento transition-colors hover:bg-accento-tenue sm:py-1"
        >
          {avviso.azione.etichetta}
        </Link>
      )}
    </li>
  );
}

function RigaScadenza({ scadenza, oggi }: { scadenza: Adempimento; oggi: string }) {
  const giorni = giorniAllaData(scadenza.data, oggi);
  const imminente = giorni <= 15;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
      <span className="flex min-w-0 items-center gap-3">
        <CalendarClock
          className={cn("size-4 shrink-0", imminente ? "text-attenzione" : "text-inchiostro-tenue")}
          aria-hidden
        />
        <span className="min-w-0">
          <span className="block truncate text-corpo">{scadenza.titolo}</span>
          <span className="block text-micro text-inchiostro-tenue">
            {fmtData(scadenza.data)} · {giorni === 0 ? "oggi" : giorni === 1 ? "domani" : `fra ${giorni} giorni`}
            {scadenza.dataDiCalendario &&
              ` · spostata dal ${fmtData(scadenza.dataDiCalendario)}, festivo`}
          </span>
        </span>
      </span>
      <span className="cifre shrink-0 text-corpo font-medium">
        {scadenza.importo === null ? (
          <span className="text-etichetta font-normal text-inchiostro-tenue">
            adempimento dichiarativo
          </span>
        ) : (
          euro(scadenza.importo)
        )}
      </span>
    </li>
  );
}

function nomeGestione(gestione: string): string {
  return gestione === "separata"
    ? "Gestione Separata INPS"
    : gestione === "artigiani"
      ? "Artigiani e commercianti"
      : "Cassa professionale";
}

