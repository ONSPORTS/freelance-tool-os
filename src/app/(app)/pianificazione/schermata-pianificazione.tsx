"use client";

import * as React from "react";
import { ArrowDown, Target } from "lucide-react";
import { Card, CardCorpo, CardSottotitolo, CardTitolo } from "@/components/ui/card";
import { CaricamentoTabella } from "@/components/ui/caricamento";
import { Campo, Input } from "@/components/ui/input";
import { Kpi } from "@/components/ui/kpi";
import { Guscio } from "@/components/guscio/guscio";
import { calcolaPianificazione } from "@/lib/analisi/pianificazione";
import { useCalcoloAnno } from "@/lib/dati/hooks";
import { oreFatturabiliAnno } from "@/lib/fisco/impostazioni";
import { usePreferenze } from "@/lib/stato/preferenze";
import { analizzaNumero, analizzaPercentuale, euro, num, perCampo, percentuale } from "@/lib/format";
import { cn } from "@/lib/utils";

export function SchermataPianificazione() {
  const anno = usePreferenze((s) => s.periodo.anno);
  const [oggi] = React.useState(() => new Date().toISOString().slice(0, 10));
  const calcolo = useCalcoloAnno(anno, oggi);

  const [campi, setCampi] = React.useState<{
    netto: number; costi: number; pressione: number; ticket: number;
    chiusura: number; conversione: number; tariffa: number; costiFissi: number;
  } | null>(null);

  React.useEffect(() => {
    if (!calcolo || campi) return;
    const imp = calcolo.impostazioni;
    const p = calcolo.prospetto;
    const fatture = p.fattureCalcolate.filter((f) => f.dataEmissione.startsWith(String(anno)));
    const clientiServiti = new Set(fatture.map((f) => f.clienteId)).size;
    const ticket = clientiServiti > 0
      ? Math.round(fatture.reduce((a, f) => a + f.imponibile, 0) / clientiServiti)
      : 3000;
    setCampi({
      netto: imp.nettoDesiderato,
      costi: imp.costiFissiAnnui,
      // Se c'è già uno storico si parte dalla pressione vera, non da una stima.
      pressione: p.pressione > 0 ? Math.round(p.pressione * 1000) / 1000 : 0.35,
      ticket,
      chiusura: 0.25,
      conversione: 0.3,
      tariffa: imp.tariffaOraria,
      costiFissi: imp.costiFissiAnnui,
    });
  }, [calcolo, campi, anno]);

  if (!calcolo || !campi) {
    return (
      <Guscio titolo="Pianificazione">
        <Card>
          <CaricamentoTabella righe={5} />
        </Card>
      </Guscio>
    );
  }

  const imp = calcolo.impostazioni;
  const ore = oreFatturabiliAnno(imp);
  const piano = calcolaPianificazione({
    nettoDesiderato: campi.netto,
    costiPrevisti: campi.costi,
    pressione: campi.pressione,
    ticketMedio: campi.ticket,
    tassoChiusura: campi.chiusura,
    tassoConversione: campi.conversione,
    oreFatturabiliAnno: ore,
    oreFatturabiliGiorno: imp.oreFatturabiliGiorno,
    tariffaOraria: campi.tariffa,
    costiFissiAnnui: campi.costiFissi,
  });

  const aggiorna = (chiave: keyof typeof campi) => (v: number) =>
    setCampi((c) => (c ? { ...c, [chiave]: v } : c));

  return (
    <Guscio
      titolo="Pianificazione"
      descrizione={`Anno ${anno} · dal netto che vuoi in tasca ai contatti da coltivare ogni mese`}
    >
      <div className="mx-auto max-w-4xl space-y-4">
        <Card scura className="p-6">
          <span className="flex items-center gap-2 text-etichetta text-white/60">
            <Target className="size-4" aria-hidden />
            Per portare a casa {euro(campi.netto)} netti
          </span>
          <p className="mt-2 font-display text-semaforo font-semibold tracking-tight">
            {euro(piano.fatturatoNecessario)}
          </p>
          <p className="mt-1 text-corpo text-white/70">
            di fatturato all&apos;anno, cioè {euro(piano.fatturatoMensile)} al mese, con una
            pressione fiscale del {percentuale(campi.pressione, 1)} e {euro(campi.costi)} di
            costi.
          </p>
        </Card>

        <Card>
          <CardCorpo>
            <CardTitolo>Da cosa parte il calcolo</CardTitolo>
            <CardSottotitolo>
              La pressione è precompilata con quella reale del {anno}, non con una stima.
            </CardSottotitolo>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <CampoValore id="p-netto" etichetta="Netto desiderato" aiuto="all'anno, in tasca"
                valore={campi.netto} onChange={aggiorna("netto")} />
              <CampoValore id="p-costi" etichetta="Costi previsti" aiuto="dell'attività, all'anno"
                valore={campi.costi} onChange={aggiorna("costi")} />
              <CampoPercentuale id="p-pressione" etichetta="Pressione attesa"
                aiuto="imposte e contributi sui ricavi" valore={campi.pressione}
                onChange={aggiorna("pressione")} />
              <CampoValore id="p-ticket" etichetta="Ticket medio" aiuto="per cliente o progetto"
                valore={campi.ticket} onChange={aggiorna("ticket")} />
            </div>
          </CardCorpo>
        </Card>

        <Card>
          <CardCorpo className="pb-2">
            <CardTitolo>Dal fatturato ai contatti</CardTitolo>
            <CardSottotitolo>
              L&apos;ultimo numero è quello che deve guidare la tua attività commerciale.
            </CardSottotitolo>
          </CardCorpo>
          <ol className="px-4 pb-5 sm:px-6 sm:pb-6">
            <Gradino
              etichetta="Fatturato necessario"
              valore={euro(piano.fatturatoNecessario)}
              spiegazione={`(${euro(campi.netto)} + ${euro(campi.costi)}) ÷ ${percentuale(1 - campi.pressione, 1)}`}
            />
            <Gradino
              etichetta="Clienti o progetti nell'anno"
              valore={num(piano.clientiNecessari)}
              spiegazione={`${euro(piano.fatturatoNecessario)} ÷ ${euro(campi.ticket)} di ticket medio`}
              controllo={
                <CampoPercentuale id="p-chiusura" etichetta="Tasso di chiusura"
                  aiuto="quante proposte diventano incarichi" valore={campi.chiusura}
                  onChange={aggiorna("chiusura")} compatto />
              }
            />
            <Gradino
              etichetta="Proposte da presentare"
              valore={num(piano.proposteNecessarie)}
              spiegazione={`${num(piano.clientiNecessari)} clienti ÷ ${percentuale(campi.chiusura, 0)} di chiusura`}
              controllo={
                <CampoPercentuale id="p-conversione" etichetta="Da contatto a proposta"
                  aiuto="quanti contatti arrivano a preventivo" valore={campi.conversione}
                  onChange={aggiorna("conversione")} compatto />
              }
            />
            <Gradino
              etichetta="Contatti necessari nell'anno"
              valore={num(piano.contattiNecessari)}
              spiegazione={`${num(piano.proposteNecessarie)} proposte ÷ ${percentuale(campi.conversione, 0)} di conversione`}
            />
            <Gradino
              etichetta="Contatti al mese"
              valore={num(piano.contattiAlMese)}
              spiegazione="È il numero che deve guidare tutta la tua attività commerciale."
              finale
            />
          </ol>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardCorpo>
              <CardTitolo>Tariffa e capacità</CardTitolo>
              <CardSottotitolo>
                {num(ore)} ore fatturabili all&apos;anno: {imp.giorniLavorativi} giorni per{" "}
                {imp.oreFatturabiliGiorno} ore.
              </CardSottotitolo>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <CampoValore id="p-tariffa" etichetta="Tariffa oraria attuale" aiuto="quella che applichi oggi"
                  valore={campi.tariffa} onChange={aggiorna("tariffa")} />
                <div className="rounded-interna bg-superficie-alt p-3">
                  <p className="text-micro text-inchiostro-tenue">Tariffa oraria minima</p>
                  <p className="cifre mt-1 text-kpi-sm font-semibold">{euro(piano.tariffaMinima)}</p>
                  <p className="mt-1 text-micro text-inchiostro-tenue">
                    {euro(piano.tariffaGiornalieraMinima)} al giorno
                  </p>
                </div>
              </div>
              <p
                className={cn(
                  "mt-4 rounded-interna px-3 py-2 text-etichetta",
                  piano.tariffaSufficiente
                    ? "bg-positivo-tenue text-[#0B8A63]"
                    : "bg-attenzione-tenue text-[#B8791A]",
                )}
              >
                {piano.tariffaSufficiente
                  ? `Obiettivo raggiungibile riempiendo il ${percentuale(piano.saturazioneNecessaria, 0)} delle ore fatturabili.`
                  : `A ${euro(campi.tariffa)} l'ora dovresti vendere più ore di quelle che hai. Alza la tariffa ad almeno ${euro(piano.tariffaMinima)} oppure rivedi l'obiettivo.`}
              </p>
            </CardCorpo>
          </Card>

          <Card>
            <CardCorpo>
              <CardTitolo>Punto di pareggio</CardTitolo>
              <CardSottotitolo>
                Sotto questa cifra lavori in perdita, tasse e contributi compresi.
              </CardSottotitolo>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <CampoValore id="p-fissi" etichetta="Costi fissi annui" aiuto="quelli che paghi comunque"
                  valore={campi.costiFissi} onChange={aggiorna("costiFissi")} />
                <div className="rounded-interna bg-superficie-alt p-3">
                  <p className="text-micro text-inchiostro-tenue">Fatturato di pareggio</p>
                  <p className="cifre mt-1 text-kpi-sm font-semibold">{euro(piano.pareggioFatturato)}</p>
                  <p className="mt-1 text-micro text-inchiostro-tenue">
                    {euro(piano.pareggioMensile)} al mese
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-interna bg-superficie-alt p-3">
                  <p className="text-micro text-inchiostro-tenue">Ore da vendere</p>
                  <p className="cifre mt-1 text-kpi-sm font-semibold">{num(Math.ceil(piano.pareggioOre))}</p>
                </div>
                <div className="rounded-interna bg-superficie-alt p-3">
                  <p className="text-micro text-inchiostro-tenue">Giorni di lavoro</p>
                  <p className="cifre mt-1 text-kpi-sm font-semibold">{num(Math.ceil(piano.pareggioGiorni))}</p>
                </div>
              </div>
              <p className="mt-3 text-etichetta text-inchiostro-tenue">
                Da quel giorno in poi, quello che fatturi inizia a diventare tuo.
              </p>
            </CardCorpo>
          </Card>
        </div>

        <Kpi
          etichetta="Fatturato potenziale alla tariffa attuale"
          valore={euro(piano.fatturatoPotenziale)}
          nota={`${euro(campi.tariffa)} l'ora per ${num(ore)} ore fatturabili`}
          taglia="kpiSm"
        />
      </div>
    </Guscio>
  );
}

function Gradino({
  etichetta,
  valore,
  spiegazione,
  controllo,
  finale = false,
}: {
  etichetta: string;
  valore: string;
  spiegazione: string;
  controllo?: React.ReactNode;
  finale?: boolean;
}) {
  return (
    <li className="relative">
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-interna px-4 py-3",
          finale ? "bg-accento-tenue" : "bg-superficie-alt",
        )}
      >
        <span className="min-w-0">
          <span className={cn("block text-corpo", finale && "font-medium text-accento")}>
            {etichetta}
          </span>
          <span className="block text-micro text-inchiostro-tenue">{spiegazione}</span>
        </span>
        <span className={cn("cifre shrink-0 text-kpi font-semibold", finale && "text-accento")}>
          {valore}
        </span>
      </div>
      {controllo ? (
        <div className="flex items-center gap-3 py-2 pl-4">
          <ArrowDown className="size-4 shrink-0 text-inchiostro-tenue" aria-hidden />
          <div className="w-56">{controllo}</div>
        </div>
      ) : (
        !finale && (
          <div className="py-2 pl-4">
            <ArrowDown className="size-4 text-inchiostro-tenue" aria-hidden />
          </div>
        )
      )}
    </li>
  );
}

function CampoValore({
  id, etichetta, aiuto, valore, onChange,
}: {
  id: string; etichetta: string; aiuto: string; valore: number; onChange: (v: number) => void;
}) {
  const [bozza, setBozza] = React.useState<string | null>(null);
  return (
    <Campo etichetta={etichetta} aiuto={aiuto} htmlFor={id}>
      <Input
        id={id}
        numerico
        inputMode="decimal"
        value={bozza ?? perCampo(valore, 0)}
        onChange={(e) => {
          setBozza(e.target.value);
          const n = analizzaNumero(e.target.value);
          if (n !== null) onChange(n);
        }}
        onBlur={() => setBozza(null)}
      />
    </Campo>
  );
}

function CampoPercentuale({
  id, etichetta, aiuto, valore, onChange, compatto = false,
}: {
  id: string; etichetta: string; aiuto: string; valore: number;
  onChange: (v: number) => void; compatto?: boolean;
}) {
  const [bozza, setBozza] = React.useState<string | null>(null);
  return (
    <Campo etichetta={etichetta} aiuto={compatto ? undefined : aiuto} htmlFor={id}>
      <Input
        id={id}
        numerico
        inputMode="decimal"
        value={bozza ?? perCampo(valore * 100, 1)}
        onChange={(e) => {
          setBozza(e.target.value);
          const n = analizzaPercentuale(e.target.value);
          if (n !== null && n > 0 && n < 1) onChange(n);
        }}
        onBlur={() => setBozza(null)}
      />
    </Campo>
  );
}
