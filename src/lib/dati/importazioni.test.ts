import { beforeEach, describe, expect, it } from "vitest";
import { MemoriaAdapter } from "./memoria-adapter";
import { archivio, impostaArchivio } from "./archivio";
import {
  annullaImport,
  dimenticaImport,
  eseguiImport,
  importAnnullabile,
  type DaScrivere,
} from "./importazioni";
import { salvaFattura, segnaIncassata } from "./azioni";
import type { Cliente } from "./tipi";
import type { Costo, Fattura } from "@/lib/fisco/tipi";

function fattura(id: string, clienteId = "c1", numero = id): Fattura {
  return {
    id,
    dataEmissione: "2026-02-01",
    numero,
    clienteId,
    descrizione: "",
    tipoRicavo: "progetto",
    imponibile: 1_000,
  };
}
const CLIENTE: Cliente = { id: "c1", nome: "Alfa", canaleAcquisizione: "", note: "" };

function daScrivere(extra: Partial<DaScrivere> = {}): DaScrivere {
  return {
    nomeFile: "storico.csv",
    destinazione: "fattura",
    fatture: [],
    costi: [],
    clienti: [],
    personali: [],
    fisse: false,
    scartate: 0,
    ...extra,
  };
}

beforeEach(() => impostaArchivio(new MemoriaAdapter()));

describe("scrivere un import", () => {
  it("crea righe e clienti, e registra come disfarli", async () => {
    const reg = await eseguiImport(
      daScrivere({ clienti: [CLIENTE], fatture: [fattura("f1"), fattura("f2")], scartate: 3 }),
    );
    expect(await archivio().fatture.conta()).toBe(2);
    expect(await archivio().clienti.conta()).toBe(1);
    expect(reg.conteggi).toMatchObject({ fatture: 2, clienti: 1, scartate: 3 });
    expect(await importAnnullabile()).not.toBeNull();
  });

  it("ne resta uno solo: il nuovo prende il posto del precedente", async () => {
    await eseguiImport(daScrivere({ fatture: [fattura("f1")] }));
    const secondo = await eseguiImport(daScrivere({ fatture: [fattura("f2")] }));
    expect((await archivio().importazioni.tutti()).map((i) => i.id)).toEqual([secondo.id]);
  });

  it("le spese personali confluiscono nel mese invece di diventare righe", async () => {
    await eseguiImport(
      daScrivere({
        destinazione: "costo",
        personali: [
          { anno: 2026, mese: 2, importo: 142.3 },
          { anno: 2026, mese: 2, importo: 31.5 },
          { anno: 2026, mese: 3, importo: 60 },
        ],
      }),
    );
    const mesi = await archivio().movimentiPersonali.tutti();
    expect(mesi).toHaveLength(2);
    expect(mesi.find((m) => m.mese === 2)?.speseVariabili).toBe(173.8);
    expect(mesi.find((m) => m.mese === 3)?.speseVariabili).toBe(60);
  });

  it("si sommano al mese che c'era già, senza sovrascriverlo", async () => {
    await archivio().movimentiPersonali.salva({
      id: "m1", anno: 2026, mese: 2, prelievi: 500,
      altreEntrate: 0, speseFisse: 900, speseVariabili: 100, risparmio: 0,
    });
    await eseguiImport(
      daScrivere({ destinazione: "costo", personali: [{ anno: 2026, mese: 2, importo: 50 }] }),
    );
    const m = (await archivio().movimentiPersonali.tutti())[0];
    expect(m.speseVariabili).toBe(150);
    expect(m.speseFisse).toBe(900); // il resto del mese non si tocca
    expect(m.prelievi).toBe(500);
  });
});

describe("annullare un import", () => {
  it("toglie esattamente quello che aveva messo", async () => {
    const reg = await eseguiImport(
      daScrivere({ clienti: [CLIENTE], fatture: [fattura("f1"), fattura("f2")] }),
    );
    await annullaImport(reg);
    expect(await archivio().fatture.conta()).toBe(0);
    expect(await archivio().clienti.conta()).toBe(0);
    expect(await importAnnullabile()).toBeNull();
  });

  it("**non tocca quello che è stato inserito dopo, a mano**", async () => {
    // È il motivo per cui l'annulla è chirurgico e non un'istantanea: fra
    // l'import e il ripensamento passa un giorno, e in mezzo si lavora.
    const reg = await eseguiImport(daScrivere({ clienti: [CLIENTE], fatture: [fattura("f1")] }));
    await archivio().fatture.salva(fattura("mano", "c1", "scritta a mano"));
    await archivio().costi.salva({
      id: "k9", dataDocumento: "2026-03-01", fornitore: "Enel", categoria: "Altro",
      descrizione: "", natura: "variabile", imponibile: 90, aliquotaIva: 0.22,
      percentualeDeducibilita: 1,
    } as Costo);

    await annullaImport(reg);
    const rimaste = await archivio().fatture.tutti();
    expect(rimaste.map((f) => f.id)).toEqual(["mano"]);
    expect(await archivio().costi.conta()).toBe(1);
  });

  it("**un cliente ancora usato non si cancella**, o resterebbe una fattura orfana", async () => {
    const reg = await eseguiImport(daScrivere({ clienti: [CLIENTE], fatture: [fattura("f1")] }));
    await archivio().fatture.salva(fattura("mano", "c1"));
    const esito = await annullaImport(reg);
    expect(await archivio().clienti.conta()).toBe(1);
    expect(esito.clientiTenuti).toBe(1);
  });

  it("una riga sostituita torna com'era, non sparisce", async () => {
    const originale = fattura("f1", "c1", "2026/001");
    await archivio().fatture.salva({ ...originale, imponibile: 999, descrizione: "originale" });
    const reg = await eseguiImport(
      daScrivere({ fatture: [{ ...originale, imponibile: 1_500, descrizione: "dal csv" }] }),
    );
    expect((await archivio().fatture.leggi("f1"))?.imponibile).toBe(1_500);
    await annullaImport(reg);
    const tornata = await archivio().fatture.leggi("f1");
    expect(tornata?.imponibile).toBe(999);
    expect(tornata?.descrizione).toBe("originale");
  });

  it("**la spesa personale si sottrae, e regge una modifica fatta nel frattempo**", async () => {
    const reg = await eseguiImport(
      daScrivere({ destinazione: "costo", personali: [{ anno: 2026, mese: 2, importo: 142.3 }] }),
    );
    // L'utente aggiusta il mese a mano dopo l'import.
    const mese = (await archivio().movimentiPersonali.tutti())[0];
    await archivio().movimentiPersonali.salva({ ...mese, speseVariabili: mese.speseVariabili + 60 });

    await annullaImport(reg);
    // Torna il suo 60, non uno zero che cancellerebbe la correzione.
    expect((await archivio().movimentiPersonali.tutti())[0].speseVariabili).toBe(60);
  });

  it("annullare due volte non fa danni: la registrazione è già sparita", async () => {
    const reg = await eseguiImport(daScrivere({ fatture: [fattura("f1")] }));
    await annullaImport(reg);
    await expect(annullaImport(reg)).resolves.toMatchObject({ annullate: 0 });
    expect(await archivio().fatture.conta()).toBe(0);
  });

  it("la chiusura d'anno toglie l'annulla: i riporti poggiano su quei numeri", async () => {
    await eseguiImport(daScrivere({ fatture: [fattura("f1")] }));
    await dimenticaImport();
    expect(await importAnnullabile()).toBeNull();
    expect(await archivio().fatture.conta()).toBe(1); // i dati restano
  });
});

// ————————————————————————————————————————————————————————————
// Nel database non entra nulla che si possa ricalcolare
// ————————————————————————————————————————————————————————————

describe("i campi derivati non finiscono in archivio", () => {
  it("**salvare una fattura calcolata scrive i soli campi grezzi**", async () => {
    // Le azioni della riga — «segna incassata», «annulla l'incasso», «elimina»
    // — ricevono la fattura *calcolata*. Senza normalizzazione finivano in
    // archivio anche `stato`, `iva`, `totale`, `scadenza` e gli altri derivati:
    // 23 campi invece di 9. Nessun numero sbagliato oggi, perché il motore
    // ricalcola tutto, ma una copia congelata dentro l'archivio è esattamente
    // la premessa di un numero plausibile e sbagliato domani.
    const calcolata = {
      ...fattura("f1"),
      stato: "daIncassare",
      scadenza: "2026-03-03",
      giorniRitardo: 12,
      nettoIncasso: 1_000,
      iva: 220,
      totale: 1_220,
      ritenuta: 0,
      rivalsa: 0,
      bollo: 0,
      ricavoRilevante: 1_000,
    } as unknown as Fattura;

    await salvaFattura(calcolata);
    const salvata = await archivio().fatture.leggi("f1");
    expect(Object.keys(salvata ?? {}).sort()).toEqual([
      "clienteId",
      "dataEmissione",
      "dataIncasso",
      "descrizione",
      "id",
      "imponibile",
      "numero",
      "tipoRicavo",
    ]);
  });

  it("segnare incassata non riporta dentro i derivati", async () => {
    await archivio().fatture.salva(fattura("f2"));
    const calcolata = { ...fattura("f2"), stato: "daIncassare", totale: 1_220 } as unknown as Fattura;
    await segnaIncassata(calcolata, "2026-04-01");
    const salvata = await archivio().fatture.leggi("f2");
    expect(salvata?.dataIncasso).toBe("2026-04-01");
    expect(Object.keys(salvata ?? {})).not.toContain("stato");
    expect(Object.keys(salvata ?? {})).not.toContain("totale");
  });
});
