"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { euro, euroTondo } from "@/lib/format";
import type { MeseCassa } from "@/lib/analisi/cashflow";

/**
 * Saldo di cassa e liquidità netta: due stadi della stessa somma, quindi due
 * passi dello stesso indaco. La distanza fra le due linee è il denaro che sta
 * sul conto ma non è tuo — le tasse accantonate.
 */
const COLORE_SALDO = "#9BA6FA";
const COLORE_NETTA = "#4C5BF5";

export function AndamentoCassa({ mesi }: { mesi: MeseCassa[] }) {
  const [attivo, setAttivo] = React.useState<number | null>(null);
  const ultimo = mesi[mesi.length - 1];
  const mese = attivo !== null ? mesi[attivo] : ultimo;
  const vuoto = mesi.every((m) => m.totaleEntrate === 0 && m.totaleUscite === 0);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 px-6 pb-2">
        <dl className="flex gap-6">
          <Voce colore={COLORE_SALDO} etichetta="Saldo di cassa" valore={mese.saldoCassa} />
          <Voce colore={COLORE_NETTA} etichetta="Liquidità netta" valore={mese.liquiditaNetta} />
        </dl>
        <p className="max-w-72 text-right text-etichetta text-inchiostro-tenue">
          {attivo === null
            ? `A fine anno ${euro(ultimo.accantonamentoCumulato)} sul conto sono tasse accantonate, non tuoi.`
            : `A ${nomeMese(mese.mese)} restano ${euro(mese.accantonamentoCumulato)} da versare all'erario.`}
        </p>
      </div>

      {vuoto ? (
        <p className="px-6 pb-8 text-etichetta text-inchiostro-tenue">
          Il grafico si riempie con i primi incassi e pagamenti registrati.
        </p>
      ) : (
        <div className="h-64 px-2 pb-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={mesi}
              margin={{ top: 8, right: 12, bottom: 0, left: 4 }}
              accessibilityLayer
              onMouseMove={(stato) => {
                const i = stato?.activeTooltipIndex;
                setAttivo(typeof i === "number" ? i : null);
              }}
              onMouseLeave={() => setAttivo(null)}
            >
              <defs>
                <linearGradient id="sfumaturaSaldo" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORE_SALDO} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={COLORE_SALDO} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#E4E8F0" />
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
                width={64}
                tick={{ fill: "#6B7392", fontSize: 11 }}
                tickFormatter={(v: number) => (v === 0 ? "0" : euroTondo(v))}
              />
              <Tooltip cursor={{ stroke: "#6B7392", strokeDasharray: "3 3" }} content={() => null} />
              <ReferenceLine y={0} stroke="#E5484D" strokeWidth={1} />
              <Area
                type="monotone"
                dataKey="saldoCassa"
                name="Saldo di cassa"
                stroke={COLORE_SALDO}
                strokeWidth={2}
                fill="url(#sfumaturaSaldo)"
                activeDot={{ r: 5, strokeWidth: 2, stroke: "#FFFFFF" }}
              />
              <Area
                type="monotone"
                dataKey="liquiditaNetta"
                name="Liquidità netta"
                stroke={COLORE_NETTA}
                strokeWidth={2}
                fill="none"
                activeDot={{ r: 5, strokeWidth: 2, stroke: "#FFFFFF" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function Voce({ colore, etichetta, valore }: { colore: string; etichetta: string; valore: number }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-micro text-inchiostro-tenue">
        <span className="size-2 rounded-full" style={{ backgroundColor: colore }} aria-hidden />
        {etichetta}
      </dt>
      <dd className="cifre mt-0.5 text-kpi-sm font-semibold">{euro(valore)}</dd>
    </div>
  );
}

const NOMI = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];
function nomeMese(m: number) {
  return NOMI[m - 1] ?? "";
}
