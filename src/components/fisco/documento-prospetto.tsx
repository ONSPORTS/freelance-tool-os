import { euro, percentuale } from "@/lib/format";
import type { DocumentoProspetto } from "@/lib/fisco/stampa";
import type { RigaProspetto } from "@/lib/fisco/spiegazioni";

/**
 * Il prospetto fiscale impaginato per la carta.
 *
 * Vive nel DOM sempre, nascosto a schermo e visibile solo in stampa: così
 * `window.print()` lo trova già pronto senza aprire finestre, senza librerie e
 * senza che l'app debba montare qualcosa al volo. Il guscio dell'applicazione
 * fa l'opposto — `print:hidden` — e in stampa resta solo questo.
 *
 * Le classi di stampa sono deliberatamente essenziali: niente colori di sfondo
 * pieni (le stampanti li rendono male e molti browser li omettono), righe
 * separate da filetti, e `break-inside-avoid` su ogni blocco perché una sezione
 * non si spezzi lasciando l'intestazione sola in fondo alla pagina.
 *
 * L'impaginato sta dentro una tabella di una riga sola. Non è una tabella per
 * far quadrare le colonne: è l'unico modo, senza librerie, di ottenere una
 * testata che si ripete su ogni foglio — il browser ripete il `<thead>` a ogni
 * salto di pagina. Il secondo foglio, staccato dal primo sulla scrivania di un
 * commercialista, deve dire da solo di chi è e di che anno parla.
 */
export function DocumentoProspettoStampa({ doc }: { doc: DocumentoProspetto }) {
  const emessoIl = doc.identificazione.find((v) => v.etichetta === "Documento emesso il")?.valore;

  return (
    <article className="hidden print:block" aria-hidden data-documento="prospetto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <td className="p-0">
              <div className="break-inside-avoid border-b border-black/25 pb-2">
                <div className="flex items-baseline justify-between gap-4">
                  <h1 className="font-display text-[15pt] font-semibold leading-tight">
                    {doc.titolo}
                  </h1>
                  <span className="text-[8pt] uppercase tracking-wider text-black/50">
                    Flowlance
                  </span>
                </div>
                <p className="mt-0.5 text-[9pt] text-black/60">
                  {doc.intestatario} · emesso il {emessoIl}
                </p>
              </div>
            </td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="p-0 align-top">
              <div className="grid grid-cols-2 gap-x-6 pt-3" data-blocco="identificazione">
                <BloccoVoci titolo="Identificazione" voci={doc.identificazione} />
                <BloccoVoci titolo="Regime e parametri applicati" voci={doc.parametri} />
              </div>

              <section className="mt-3 border-y border-black/20 py-2" data-blocco="sintesi">
                <div className="grid grid-cols-4 gap-x-4">
                  {doc.sintesi.map((s) => (
                    <div key={s.etichetta}>
                      <p className="text-[7.5pt] uppercase tracking-wide text-black/50">
                        {s.etichetta}
                      </p>
                      <p className="cifre text-[12pt] font-semibold tabular-nums">{s.valore}</p>
                      {s.nota && <p className="text-[7.5pt] text-black/50">{s.nota}</p>}
                    </div>
                  ))}
                </div>
              </section>

              {doc.sezioni.map((sezione) => (
                <section key={sezione.id} className="mt-2">
                  <h2 className="border-b border-black/20 pb-1 text-[10pt] font-semibold">
                    <span className="mr-1.5 text-black/40">{sezione.lettera}</span>
                    {sezione.titolo}
                    <span className="ml-2 text-[8pt] font-normal text-black/50">
                      {sezione.sottotitolo}
                    </span>
                  </h2>
                  <table className="w-full border-collapse">
                    <tbody>
                      {sezione.righe.map((riga) => (
                        <RigaStampa key={riga.id} riga={riga} />
                      ))}
                    </tbody>
                  </table>
                </section>
              ))}

              <footer className="mt-3 break-inside-avoid border-t border-black/25 pt-2">
                <p className="text-[7.5pt] leading-snug text-black/60">{doc.nota}</p>
                {doc.fonti.length > 0 && (
                  <p className="mt-1 text-[7.5pt] leading-snug text-black/50">
                    <span className="font-medium">Parametri {doc.anno}:</span>{" "}
                    {doc.fonti.join(" · ")}
                  </p>
                )}
              </footer>
            </td>
          </tr>
        </tbody>
      </table>
    </article>
  );
}

function BloccoVoci({ titolo, voci }: { titolo: string; voci: { etichetta: string; valore: string }[] }) {
  return (
    <div>
      <h2 className="text-[7.5pt] uppercase tracking-wide text-black/50">{titolo}</h2>
      <dl className="mt-1">
        {voci.map((v) => (
          <div key={v.etichetta} className="flex items-baseline gap-2 border-b border-black/10 py-[2px]">
            <dt className="shrink-0 text-[8.5pt] text-black/60">{v.etichetta}</dt>
            <dd className="ml-auto text-right text-[8.5pt] font-medium">{v.valore}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * Una riga della catena di calcolo.
 *
 * La formula finisce sotto l'etichetta, in corpo minore: sulla carta non c'è un
 * popover da aprire, e il commercialista deve poter rifare il conto senza
 * chiedere a nessuno da dove esca il numero.
 */
function RigaStampa({ riga }: { riga: RigaProspetto }) {
  const valore =
    riga.formato === "euro"
      ? euro(Number(riga.valore))
      : riga.formato === "percentuale"
        ? percentuale(Number(riga.valore))
        : String(riga.valore);

  return (
    <tr className="border-b border-black/10 align-baseline">
      <td className="py-[2px] pr-3">
        <span className={riga.totale ? "text-[9pt] font-semibold" : "text-[9pt]"}>
          {riga.etichetta}
        </span>
        {riga.formula && (
          <span className="block text-[7pt] leading-[1.25] text-black/50">{riga.formula}</span>
        )}
        {riga.nota && (
          <span className="block text-[7pt] leading-[1.25] text-black/50">{riga.nota}</span>
        )}
      </td>
      <td
        className={`cifre w-[32%] py-[2px] text-right tabular-nums ${
          riga.totale ? "text-[10pt] font-semibold" : "text-[9pt]"
        }`}
      >
        {valore}
      </td>
    </tr>
  );
}
