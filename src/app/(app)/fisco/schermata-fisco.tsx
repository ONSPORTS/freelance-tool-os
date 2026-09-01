"use client";

import * as React from "react";
import Link from "next/link";
import { Info } from "lucide-react";
import { Card, CardCorpo } from "@/components/ui/card";
import { CaricamentoTabella } from "@/components/ui/caricamento";
import { Chip } from "@/components/ui/chip";
import { Kpi } from "@/components/ui/kpi";
import { Sezione } from "@/components/ui/fisarmonica";
import { Guscio } from "@/components/guscio/guscio";
import { RigaDelProspetto } from "@/components/fisco/riga-prospetto";
import { useCalcoloAnno } from "@/lib/dati/hooks";
import { parametriDi, parametriSonoDellAnno } from "@/lib/fisco/parametri";
import { dettaglioSoglia, prospettoDettagliato } from "@/lib/fisco/spiegazioni";
import { usePreferenze } from "@/lib/stato/preferenze";
import { euro, percentuale } from "@/lib/format";

export function SchermataFisco() {
  const anno = usePreferenze((s) => s.periodo.anno);
  const [oggi] = React.useState(() => new Date().toISOString().slice(0, 10));
  const calcolo = useCalcoloAnno(anno, oggi);

  const sezioni = React.useMemo(() => {
    if (!calcolo) return null;
    return prospettoDettagliato(calcolo.prospetto, calcolo.impostazioni, parametriDi(anno));
  }, [calcolo, anno]);

  if (!calcolo || !sezioni) {
    return (
      <Guscio titolo="Imposte e contributi">
        <Card>
          <CaricamentoTabella righe={5} />
        </Card>
      </Guscio>
    );
  }

  const { prospetto: p, impostazioni: imp } = calcolo;
  const soglia = dettaglioSoglia(p, imp);
  const parametriStimati = !parametriSonoDellAnno(anno);

  return (
    <Guscio
      titolo="Imposte e contributi"
      descrizione={`Prospetto ${anno} · calcolo per cassa · regime ${imp.regime}`}
    >
      <div className="mx-auto max-w-4xl space-y-4">
        <section aria-label="Sintesi" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi etichetta="Reddito imponibile" valore={euro(p.imponibile)} taglia="kpiSm" />
          <Kpi etichetta="Imposte dovute" valore={euro(p.totaleImposte)} taglia="kpiSm" />
          <Kpi etichetta="Contributi dovuti" valore={euro(p.totaleContributi)} taglia="kpiSm" />
          <Kpi
            sfondo="scuro"
            etichetta="Carico totale"
            valore={euro(p.caricoTotale)}
            nota={`pressione ${percentuale(p.pressione)}`}
            taglia="kpiSm"
          />
        </section>

        {soglia && (
          <Card>
            <CardCorpo className="flex items-start gap-3 py-4">
              <Info className="mt-0.5 size-4 shrink-0 text-accento" aria-hidden />
              <p className="text-corpo">{soglia}</p>
            </CardCorpo>
          </Card>
        )}

        {parametriStimati && (
          <Card className="border border-attenzione/25 bg-attenzione-tenue">
            <CardCorpo className="py-4">
              <p className="text-etichetta text-[#B8791A]">
                Per il {anno} non ci sono ancora parametri di legge censiti: il prospetto usa
                aliquote e soglie dell&apos;ultimo anno disponibile. Verificale prima di
                usarle per decidere.
              </p>
            </CardCorpo>
          </Card>
        )}

        {p.ricaviRilevanti === 0 ? (
          <Card>
            <CardCorpo className="py-10 text-center">
              <p className="mx-auto max-w-md text-corpo text-inchiostro-tenue">
                Il prospetto si compila da solo quando registri la prima fattura incassata:
                il calcolo segue il principio di cassa, quindi guarda gli incassi, non le
                fatture emesse.
              </p>
              <Link
                href="/fatture"
                className="mt-4 inline-block rounded-campo bg-accento px-4 py-2 text-corpo font-medium text-white transition-colors hover:bg-[#3D4CE8]"
              >
                Vai alle fatture
              </Link>
            </CardCorpo>
          </Card>
        ) : (
          <div className="space-y-3">
            {sezioni.map((s, indice) => {
              const totale = [...s.righe].reverse().find((r) => r.totale) ?? s.righe[s.righe.length - 1];
              return (
                <Sezione
                  key={s.id}
                  lettera={s.lettera}
                  titolo={s.titolo}
                  sottotitolo={s.sottotitolo}
                  apertaDiDefault={indice < 2}
                  sintesi={
                    totale?.formato === "euro" ? (
                      <span className="cifre text-corpo font-semibold">
                        {euro(Number(totale.valore))}
                      </span>
                    ) : undefined
                  }
                >
                  <div className="divide-y divide-bordo/60 py-1">
                    {s.righe.map((r) => (
                      <RigaDelProspetto key={r.id} riga={r} />
                    ))}
                  </div>
                </Sezione>
              );
            })}
          </div>
        )}

        <Card>
          <CardCorpo className="py-4">
            <div className="flex flex-wrap items-center gap-2">
              <Chip tono="neutro">Parametri {parametriDi(anno).anno}</Chip>
              {parametriDi(anno).fonti.map((f) => (
                <Chip key={f} tono="neutro" className="font-normal">
                  {f}
                </Chip>
              ))}
            </div>
            <p className="mt-3 text-etichetta text-inchiostro-tenue">
              Prospetto gestionale di stima: non sostituisce la dichiarazione dei redditi.
              Non considera altri redditi che in regime ordinario concorrono a formare il
              reddito complessivo e possono spostare lo scaglione IRPEF.
            </p>
          </CardCorpo>
        </Card>
      </div>
    </Guscio>
  );
}
