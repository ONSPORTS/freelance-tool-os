"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Download, RotateCcw, Upload } from "lucide-react";
import { Guscio } from "@/components/guscio/guscio";
import { Button } from "@/components/ui/button";
import { Card, CardCorpo, CardIntestazione, CardSottotitolo, CardTitolo } from "@/components/ui/card";
import { Segmenti } from "@/components/ui/segmenti";
import { toast } from "@/components/ui/toast";
import { archivio } from "@/lib/dati/archivio";
import { scaricaTesto, scegliFileTesto } from "@/lib/dati/file";
import { useCalcoloAnno, useDati } from "@/lib/dati/hooks";
import {
  annullaImport,
  eseguiImport,
  importAnnullabile,
} from "@/lib/dati/importazioni";
import { costiCsv, fattureCsv, nomeFileCsv } from "@/lib/csv/esporta";
import { leggiCsv, type Tabella } from "@/lib/csv/parser";
import { mappaturaAutomatica, type Destinazione, type Mappatura } from "@/lib/csv/campi";
import {
  interpreta,
  sembraPersonale,
  valoriDistinti,
  type Lettura,
  type SuiDuplicati,
} from "@/lib/csv/importa";
import { usePreferenze } from "@/lib/stato/preferenze";
import { useRichiesta } from "@/lib/stato/comandi";
import { useSolaLettura } from "@/lib/stato/licenza";
import type { Importazione } from "@/lib/dati/tipi";
import { data as fmtData } from "@/lib/format";
import { Anteprima, Mappa, ScelteNature } from "./passi-import";

type Passo = "file" | "mappa" | "esito";

/**
 * L'import CSV, in quattro momenti: il file, la mappatura, l'anteprima e
 * l'esito. Una schermata sua e non una card dentro `/dati` perché quattro passi
 * dentro un riquadro, su un telefono, non si leggono.
 *
 * Niente viene scritto finché non si preme «Importa»: fino a lì tutto vive in
 * memoria, e la mappatura si può correggere quante volte serve guardando
 * l'anteprima.
 */
export function SchermataImporta() {
  const dati = useDati();
  const anno = usePreferenze((s) => s.periodo.anno);
  const oggi = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const calcolo = useCalcoloAnno(anno, oggi);
  const bloccata = useSolaLettura();

  const [passo, setPasso] = React.useState<Passo>("file");
  const [nomeFile, setNomeFile] = React.useState("");
  const [tabella, setTabella] = React.useState<Tabella | null>(null);
  const [destinazione, setDestinazione] = React.useState<Destinazione>("fattura");
  const [mappatura, setMappatura] = React.useState<Mappatura>({});
  const [personali, setPersonali] = React.useState<Set<string>>(new Set());
  const [suiDuplicati, setSuiDuplicati] = React.useState<SuiDuplicati>("importa");
  const [fisse, setFisse] = React.useState(false);
  const [esito, setEsito] = React.useState<Importazione | null>(null);
  const [annullabile, setAnnullabile] = React.useState<Importazione | null>(null);
  const [inCorso, setInCorso] = React.useState(false);

  React.useEffect(() => {
    void importAnnullabile().then(setAnnullabile);
  }, [esito]);

  // Il tipo arriva già scelto da chi apre l'import da Fatture o da Costi.
  useRichiesta("importaCsv", (r) => setDestinazione(r.destinazione));

  const aliquotaPredefinita =
    calcolo?.impostazioni.regime === "forfettario" ? 0 : (calcolo?.parametri.aliquotaIvaOrdinaria ?? 0.22);

  async function scegliFile() {
    const testo = await scegliFileTesto("text/csv,.csv,text/plain,.txt");
    if (testo === null) return;
    const t = leggiCsv(testo);
    if (t.righe.length === 0) {
      toast.errore("Il file non contiene righe di dati.");
      return;
    }
    setTabella(t);
    setNomeFile("il file scelto");
    const m = mappaturaAutomatica(t.intestazioni, destinazione);
    setMappatura(m);
    setPersonali(new Set(valoriDistinti(t.righe, m.natura ?? null).filter(sembraPersonale)));
    setPasso("mappa");
  }

  function cambiaDestinazione(d: Destinazione) {
    setDestinazione(d);
    if (!tabella) return;
    const m = mappaturaAutomatica(tabella.intestazioni, d);
    setMappatura(m);
    setPersonali(new Set(valoriDistinti(tabella.righe, m.natura ?? null).filter(sembraPersonale)));
  }

  const lettura: Lettura | null = React.useMemo(() => {
    if (!tabella || !dati) return null;
    return interpreta(
      tabella.righe,
      {
        destinazione,
        mappatura,
        valoriPersonali: [...personali],
        suiDuplicati,
        aliquotaPredefinita,
        spesePersonaliFisse: fisse,
      },
      { fatture: dati.fatture, costi: dati.costi, clienti: dati.clienti },
    );
  }, [tabella, dati, destinazione, mappatura, personali, suiDuplicati, aliquotaPredefinita, fisse]);

  const nature = React.useMemo(
    () => (tabella && destinazione === "costo" ? valoriDistinti(tabella.righe, mappatura.natura ?? null) : []),
    [tabella, destinazione, mappatura],
  );

  const obbligatoriMancanti =
    destinazione === "fattura"
      ? mappatura.data === null || mappatura.imponibile === null || mappatura.controparte === null
      : mappatura.data === null || mappatura.imponibile === null || mappatura.controparte === null;

  const daImportare =
    (lettura?.fatture.length ?? 0) +
    (lettura?.note.length ?? 0) +
    (lettura?.costi.length ?? 0) +
    (lettura?.personali.length ?? 0);

  async function importa() {
    if (!lettura || !dati) return;
    setInCorso(true);
    try {
      const clientiNuovi = lettura.clientiDaCreare.map((nome) => {
        const id =
          lettura.fatture.find((f) => f.nomeCliente === nome)?.fattura.clienteId ??
          lettura.note.find((n) => n.nomeCliente === nome)?.nota.clienteId;
        return { id: id ?? crypto.randomUUID(), nome, canaleAcquisizione: "Altro", note: "" };
      });
      const registrazione = await eseguiImport({
        nomeFile,
        destinazione,
        fatture: lettura.fatture.map((f) => f.fattura),
        note: lettura.note.map((n) => n.nota),
        costi: lettura.costi.map((c) => c.costo),
        clienti: clientiNuovi,
        personali: lettura.personali,
        fisse,
        scartate: lettura.scartate.length,
      });
      setEsito(registrazione);
      setPasso("esito");
    } catch (e) {
      toast.errore(e instanceof Error ? e.message : "Importazione non riuscita.");
    } finally {
      setInCorso(false);
    }
  }

  async function annulla(importazione: Importazione) {
    const r = await annullaImport(importazione);
    toast.conferma(
      r.clientiTenuti > 0
        ? `Import annullato. ${r.clientiTenuti} clienti sono stati tenuti perché usati da altre fatture.`
        : "Import annullato",
    );
    setEsito(null);
    setAnnullabile(null);
    setPasso("file");
    setTabella(null);
  }

  async function esporta(cosa: "fatture" | "costi") {
    const contenuto = await archivio().leggiTutto();
    const csv =
      cosa === "fatture"
        ? fattureCsv(contenuto.fatture, contenuto.clienti)
        : costiCsv(contenuto.costi);
    scaricaTesto(nomeFileCsv(cosa, anno), csv, "text/csv");
    toast.conferma(`${cosa === "fatture" ? "Fatture" : "Costi"} esportati in CSV`);
  }

  return (
    <Guscio
      titolo="Importa da CSV"
      descrizione="Il tuo file, con le tue colonne: l'app si adatta al tracciato che hai"
    >
      <div className="mx-auto max-w-4xl space-y-4">
        {annullabile && passo !== "esito" && (
          <RiquadroAnnulla importazione={annullabile} onAnnulla={() => void annulla(annullabile)} />
        )}

        {passo === "file" && (
          <>
            <Card>
              <CardIntestazione>
                <CardTitolo>1 · Scegli il file</CardTitolo>
                <CardSottotitolo>
                  CSV separato da punto e virgola o da virgola, com&apos;esce da Excel, dal
                  gestionale o dalla banca. Resta tutto nel browser: il file non viene caricato da
                  nessuna parte.
                </CardSottotitolo>
              </CardIntestazione>
              <CardCorpo className="space-y-4 pt-0">
                <div>
                  <p className="mb-1.5 text-etichetta font-medium">Che cosa contiene</p>
                  <Segmenti
                    etichettaGruppo="Tipo di documenti nel file"
                    valore={destinazione}
                    onChange={cambiaDestinazione}
                    disabilitato={bloccata}
                    opzioni={[
                      { valore: "fattura", etichetta: "Fatture emesse" },
                      { valore: "costo", etichetta: "Costi e spese" },
                    ]}
                  />
                </div>
                <Button scrive onClick={() => void scegliFile()}>
                  <Upload className="size-4" aria-hidden />
                  Scegli un file CSV
                </Button>
              </CardCorpo>
            </Card>

            <Card>
              <CardIntestazione>
                <CardTitolo>Esporta in CSV</CardTitolo>
                <CardSottotitolo>
                  Per il giro inverso — correggere nel foglio e reimportare — e per dare al
                  commercialista un file che sa aprire. Funziona anche a licenza scaduta.
                </CardSottotitolo>
              </CardIntestazione>
              <CardCorpo className="flex flex-wrap gap-2 pt-0">
                <Button variante="contorno" onClick={() => void esporta("fatture")}>
                  <Download className="size-4" aria-hidden />
                  Fatture in CSV
                </Button>
                <Button variante="contorno" onClick={() => void esporta("costi")}>
                  <Download className="size-4" aria-hidden />
                  Costi in CSV
                </Button>
              </CardCorpo>
            </Card>
          </>
        )}

        {passo === "mappa" && tabella && (
          <>
            <Card>
              <CardIntestazione>
                <CardTitolo>2 · Associa le colonne</CardTitolo>
                <CardSottotitolo>
                  {tabella.righe.length} righe, {tabella.intestazioni.length} colonne, separatore
                  «{tabella.separatore === "\t" ? "tabulazione" : tabella.separatore}». Quello che
                  l&apos;app ha indovinato è già impostato: correggi solo dove sbaglia.
                </CardSottotitolo>
              </CardIntestazione>
              <CardCorpo className="space-y-4 pt-0">
                {/* Il tipo si può correggere anche qui: che un file sia di
                    costi e non di fatture si capisce guardando l'anteprima, e
                    obbligare a ricominciare dal file sarebbe una punizione. */}
                <div>
                  <p className="mb-1.5 text-etichetta font-medium">Che cosa contiene</p>
                  <Segmenti
                    etichettaGruppo="Tipo di documenti nel file"
                    valore={destinazione}
                    onChange={cambiaDestinazione}
                    disabilitato={bloccata}
                    opzioni={[
                      { valore: "fattura", etichetta: "Fatture emesse" },
                      { valore: "costo", etichetta: "Costi e spese" },
                    ]}
                  />
                </div>
                <Mappa
                  destinazione={destinazione}
                  intestazioni={tabella.intestazioni}
                  esempio={tabella.righe[0] ?? []}
                  mappatura={mappatura}
                  onCambia={(chiave, colonna) =>
                    setMappatura((m) => ({ ...m, [chiave]: colonna }))
                  }
                />
              </CardCorpo>
            </Card>

            {destinazione === "costo" && (
              <>
                <ScelteNature
                  valori={nature}
                  personali={personali}
                  onCambia={(v) =>
                    setPersonali((s) => {
                      const nuovo = new Set(s);
                      if (nuovo.has(v)) nuovo.delete(v);
                      else nuovo.add(v);
                      return nuovo;
                    })
                  }
                />
                {personali.size > 0 && (
                  <Card>
                    <CardCorpo className="flex flex-wrap items-center gap-3">
                      <span className="text-etichetta">Le spese personali importate sono</span>
                      <Segmenti
                        etichettaGruppo="Natura delle spese personali"
                        valore={fisse ? "fisse" : "variabili"}
                        onChange={(v) => setFisse(v === "fisse")}
                        opzioni={[
                          { valore: "variabili", etichetta: "Variabili" },
                          { valore: "fisse", etichetta: "Fisse" },
                        ]}
                      />
                    </CardCorpo>
                  </Card>
                )}
              </>
            )}

            {obbligatoriMancanti ? (
              <Card className="border border-negativo/25 bg-negativo-tenue/40">
                <CardCorpo>
                  <p className="text-corpo">
                    Prima di vedere l&apos;anteprima serve associare i campi obbligatori.
                  </p>
                </CardCorpo>
              </Card>
            ) : (
              lettura && (
                <>
                  <p className="text-etichetta font-medium">3 · Anteprima</p>
                  <Anteprima
                    lettura={lettura}
                    destinazione={destinazione}
                    suiDuplicati={suiDuplicati}
                    onDuplicati={setSuiDuplicati}
                  />
                </>
              )
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                scrive
                onClick={() => void importa()}
                disabled={obbligatoriMancanti || daImportare === 0 || inCorso}
              >
                <Check className="size-4" aria-hidden />
                {inCorso ? "Importo…" : `Importa ${daImportare} righe`}
              </Button>
              <Button variante="quieto" onClick={() => { setPasso("file"); setTabella(null); }}>
                Scegli un altro file
              </Button>
            </div>
          </>
        )}

        {passo === "esito" && esito && (
          <Card>
            <CardIntestazione>
              <CardTitolo>Importazione completata</CardTitolo>
              <CardSottotitolo>
                Si può annullare fino al prossimo import o alla chiusura d&apos;anno, quello che
                viene prima. L&apos;annulla resta anche chiudendo l&apos;app.
              </CardSottotitolo>
            </CardIntestazione>
            <CardCorpo className="space-y-4 pt-0">
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Conteggio etichetta="Fatture" valore={esito.conteggi.fatture} />
                <Conteggio etichetta="Note di credito" valore={esito.conteggi.note} />
                <Conteggio etichetta="Costi" valore={esito.conteggi.costi} />
                <Conteggio etichetta="Spese personali" valore={esito.conteggi.personali} />
                <Conteggio etichetta="Clienti creati" valore={esito.conteggi.clienti} />
              </dl>
              {esito.conteggi.scartate > 0 && (
                <p className="text-etichetta text-inchiostro-tenue">
                  {esito.conteggi.scartate} righe non sono state importate perché non leggibili.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variante="contorno" asChild>
                  <Link href={esito.destinazione === "fattura" ? "/fatture" : "/costi"}>
                    Vedi il risultato
                  </Link>
                </Button>
                <Button scrive variante="quieto" onClick={() => void annulla(esito)}>
                  <RotateCcw className="size-4" aria-hidden />
                  Annulla l&apos;importazione
                </Button>
              </div>
            </CardCorpo>
          </Card>
        )}
      </div>
    </Guscio>
  );
}

function Conteggio({ etichetta, valore }: { etichetta: string; valore: number }) {
  return (
    <div>
      <dt className="text-etichetta text-inchiostro-tenue">{etichetta}</dt>
      <dd className="cifre text-kpi-sm font-semibold tabular-nums">{valore}</dd>
    </div>
  );
}

/** L'annulla che sopravvive alla chiusura dell'app: è il punto della fase. */
function RiquadroAnnulla({
  importazione,
  onAnnulla,
}: {
  importazione: Importazione;
  onAnnulla: () => void;
}) {
  const c = importazione.conteggi;
  return (
    <Card className="border border-bordo bg-superficie-alt">
      <CardCorpo className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 text-etichetta">
          <span className="font-medium">Ultimo import del {fmtData(importazione.eseguitaIl)}</span>
          <span className="text-inchiostro-tenue">
            {" "}
            · {c.fatture + c.costi + c.personali} righe, {c.clienti} clienti
          </span>
        </p>
        <Button scrive variante="contorno" taglia="sm" onClick={onAnnulla}>
          <RotateCcw className="size-4" aria-hidden />
          Annulla
        </Button>
      </CardCorpo>
    </Card>
  );
}
