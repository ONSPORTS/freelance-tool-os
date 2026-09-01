"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardCorpo, CardSottotitolo, CardTitolo } from "@/components/ui/card";
import { euro, euroTondo } from "@/lib/format";
import type { MeseAndamento } from "@/lib/analisi/dashboard";

/**
 * I due passi dello stesso indaco: emesso e incassato sono la stessa somma in
 * due momenti diversi, non due grandezze indipendenti. La coppia è stata
 * verificata per contrasto e per le tre forme di daltonismo.
 */
const COLORE_EMESSO = "#9BA6FA";
const COLORE_INCASSATO = "#4C5BF5";

/**
 * Andamento dell'anno. Un solo asse: emesso e incassato sono entrambi euro,
 * quindi si confrontano direttamente.
 *
 * Niente tooltip fluttuante: il valore del mese sotto il cursore compare in
 * testa alla card, dove l'occhio è già, e tutte e due le serie si aggiornano
 * insieme.
 */
export function GraficoAndamento({ mesi }: { mesi: MeseAndamento[] }) {
  const [attivo, setAttivo] = React.useState<number | null>(null);

  const totali = React.useMemo(
    () => ({
      emesso: mesi.reduce((a, m) => a + m.emesso, 0),
      incassato: mesi.reduce((a, m) => a + m.incassato, 0),
    }),
    [mesi],
  );

  const mese = attivo !== null ? mesi[attivo] : null;
  const emesso = mese ? mese.emesso : totali.emesso;
  const incassato = mese ? mese.incassato : totali.incassato;
  const vuoto = totali.emesso === 0 && totali.incassato === 0;

  return (
    <Card>
      <CardCorpo className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitolo>Andamento dell&apos;anno</CardTitolo>
            <CardSottotitolo>
              {mese ? nomeMeseEsteso(mese.mese) : "Totale dei dodici mesi"}
            </CardSottotitolo>
          </div>
          {/* La legenda è anche la lettura del mese sotto il cursore. */}
          <dl className="flex gap-6">
            <Voce colore={COLORE_EMESSO} etichetta="Emesso" valore={emesso} />
            <Voce colore={COLORE_INCASSATO} etichetta="Incassato" valore={incassato} />
          </dl>
        </div>
      </CardCorpo>

      {vuoto ? (
        <p className="px-6 pb-8 pt-4 text-etichetta text-inchiostro-tenue">
          Il grafico si riempie con le prime fatture registrate.
        </p>
      ) : (
        <div className="h-64 px-2 pb-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={mesi}
              margin={{ top: 8, right: 12, bottom: 0, left: 4 }}
              barGap={2}
              accessibilityLayer
              onMouseMove={(stato) => {
                const indice = stato?.activeTooltipIndex;
                setAttivo(typeof indice === "number" ? indice : Number(indice) || null);
              }}
              onMouseLeave={() => setAttivo(null)}
            >
              <CartesianGrid vertical={false} stroke="#E4E8F0" strokeDasharray="0" />
              <XAxis
                dataKey="etichetta"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#6B7392", fontSize: 11 }}
                dy={4}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={56}
                tick={{ fill: "#6B7392", fontSize: 11 }}
                tickFormatter={(v: number) => (v === 0 ? "0" : euroTondo(v))}
              />
              {/* Il cursore serve solo a segnare la colonna: la lettura sta in testa. */}
              <Tooltip cursor={{ fill: "rgba(76, 91, 245, 0.06)" }} content={() => null} />
              <Bar dataKey="emesso" name="Emesso" fill={COLORE_EMESSO} radius={[4, 4, 0, 0]} maxBarSize={18} />
              <Bar dataKey="incassato" name="Incassato" fill={COLORE_INCASSATO} radius={[4, 4, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

function Voce({ colore, etichetta, valore }: { colore: string; etichetta: string; valore: number }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-micro text-inchiostro-tenue">
        <span className="size-2 rounded-full" style={{ backgroundColor: colore }} aria-hidden />
        {etichetta}
      </dt>
      <dd className="cifre mt-0.5 text-kpi-sm font-semibold tabular-nums">{euro(valore)}</dd>
    </div>
  );
}

const NOMI = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

function nomeMeseEsteso(mese: number): string {
  return NOMI[mese - 1] ?? "";
}
