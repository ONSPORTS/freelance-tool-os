import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { calcolaProspetto } from "@/lib/fisco/motore";
import { PARAMETRI_2026 } from "@/lib/fisco/parametri/2026";
import type { StorageAdapter } from "./adapter";
import { analizzaBackup, creaBackup, nomeFileBackup, serializzaBackup } from "./backup";
import { ANNO_DEMO, datiDemo } from "./demo";
import { DatabaseFinanze, VERSIONE_SCHEMA } from "./db";
import { DexieAdapter } from "./dexie-adapter";
import { MemoriaAdapter } from "./memoria-adapter";
import { COLLEZIONI, datiVuoti, nuovoId, type Dati } from "./tipi";

// ————————————————————————————————————————————————————————————
// Il contratto dell'adapter, verificato su entrambe le implementazioni.
// ————————————————————————————————————————————————————————————

const implementazioni: [string, () => StorageAdapter][] = [
  ["memoria", () => new MemoriaAdapter()],
  ["indexeddb", () => new DexieAdapter(new DatabaseFinanze(`prova-${nuovoId()}`))],
];

describe.each(implementazioni)("StorageAdapter · %s", (_nome, crea) => {
  let adapter: StorageAdapter;

  beforeEach(() => {
    adapter = crea();
  });

  it("parte vuoto", async () => {
    expect(await adapter.vuoto()).toBe(true);
    expect(await adapter.fatture.conta()).toBe(0);
  });

  it("salva, rilegge e cancella una singola entità", async () => {
    const fattura = datiDemo().fatture[0];
    await adapter.fatture.salva(fattura);
    expect(await adapter.fatture.leggi(fattura.id)).toEqual(fattura);
    expect(await adapter.vuoto()).toBe(false);

    await adapter.fatture.elimina(fattura.id);
    expect(await adapter.fatture.leggi(fattura.id)).toBeUndefined();
    expect(await adapter.vuoto()).toBe(true);
  });

  it("sovrascrive per chiave invece di duplicare", async () => {
    const fattura = datiDemo().fatture[0];
    await adapter.fatture.salva(fattura);
    await adapter.fatture.salva({ ...fattura, imponibile: 9999 });
    expect(await adapter.fatture.conta()).toBe(1);
    expect((await adapter.fatture.leggi(fattura.id))?.imponibile).toBe(9999);
  });

  it("indicizza le impostazioni per anno, non per identificatore", async () => {
    const [impostazioni] = datiDemo().impostazioni;
    await adapter.impostazioni.salva(impostazioni);
    await adapter.impostazioni.salva({ ...impostazioni, anno: 2027 });
    expect(await adapter.impostazioni.conta()).toBe(2);
    expect((await adapter.impostazioni.leggi(ANNO_DEMO))?.anno).toBe(ANNO_DEMO);
  });

  it("scrive e rilegge il dataset dimostrativo per intero", async () => {
    const dati = datiDemo();
    const esito = await adapter.scriviTutto(dati, "sostituisci");
    expect(esito.totale).toBeGreaterThan(100);

    const riletti = await adapter.leggiTutto();
    for (const collezione of COLLEZIONI) {
      expect(ordina(riletti[collezione])).toEqual(ordina(dati[collezione]));
    }
  });

  it("«sostituisci» rimpiazza, «unisci» fonde", async () => {
    const dati = datiDemo();
    await adapter.scriviTutto(dati, "sostituisci");

    const soloUnCliente: Dati = {
      ...datiVuoti(),
      clienti: [{ id: "cli-nuovo", nome: "Omega Srl", canaleAcquisizione: "Fiera", note: "" }],
    };

    await adapter.scriviTutto(soloUnCliente, "unisci");
    expect(await adapter.clienti.conta()).toBe(dati.clienti.length + 1);
    expect(await adapter.fatture.conta()).toBe(dati.fatture.length);

    await adapter.scriviTutto(soloUnCliente, "sostituisci");
    expect(await adapter.clienti.conta()).toBe(1);
    expect(await adapter.fatture.conta()).toBe(0);
  });

  it("svuota tutto", async () => {
    await adapter.scriviTutto(datiDemo(), "sostituisci");
    await adapter.svuota();
    expect(await adapter.vuoto()).toBe(true);
  });

  it("il giro completo export → svuota → import restituisce lo stesso stato", async () => {
    await adapter.scriviTutto(datiDemo(), "sostituisci");
    const prima = await adapter.leggiTutto();

    const file = serializzaBackup(creaBackup(prima));
    await adapter.svuota();
    expect(await adapter.vuoto()).toBe(true);

    const letto = analizzaBackup(file);
    expect(letto.ok).toBe(true);
    if (!letto.ok) return;
    await adapter.scriviTutto(letto.backup.dati, "sostituisci");

    const dopo = await adapter.leggiTutto();
    for (const collezione of COLLEZIONI) {
      expect(ordina(dopo[collezione])).toEqual(ordina(prima[collezione]));
    }
  });
});

// ————————————————————————————————————————————————————————————
// Backup
// ————————————————————————————————————————————————————————————

describe("file di backup", () => {
  it("ha un nome parlante e un marcatore di formato", () => {
    expect(nomeFileBackup(new Date("2026-09-01T10:00:00Z"))).toBe(
      "freelance-flow-2026-09-01.json",
    );
    const backup = creaBackup(datiDemo());
    expect(backup.formato).toBe("freelance-flow");
    expect(backup.versioneSchema).toBe(VERSIONE_SCHEMA);
  });

  it("rifiuta un file che non è JSON", () => {
    const esito = analizzaBackup("non sono json");
    expect(esito.ok).toBe(false);
    if (esito.ok) return;
    expect(esito.errori[0]).toContain("JSON");
  });

  it("rifiuta un JSON valido che non è un nostro backup", () => {
    const esito = analizzaBackup(JSON.stringify({ utenti: [], versione: 3 }));
    expect(esito.ok).toBe(false);
    if (esito.ok) return;
    expect(esito.errori[0]).toContain("Freelance Flow");
  });

  it("importa ancora i backup esportati col nome precedente del progetto", () => {
    // Il rename in Freelance Flow non deve rendere illeggibile un archivio
    // salvato prima: il marcatore vecchio resta accettato in lettura.
    const esito = analizzaBackup(
      JSON.stringify({
        formato: "freelance-finance-os",
        versioneSchema: VERSIONE_SCHEMA,
        esportatoIl: "2026-09-01T00:00:00.000Z",
        dati: datiVuoti(),
      }),
    );
    expect(esito.ok).toBe(true);
  });

  it("rifiuta un backup creato da una versione più recente", () => {
    const esito = analizzaBackup(
      JSON.stringify({ formato: "freelance-flow", versioneSchema: 99, dati: datiVuoti() }),
    );
    expect(esito.ok).toBe(false);
    if (esito.ok) return;
    expect(esito.errori[0]).toContain("Aggiorna l'app");
  });

  it("segnala le righe rotte invece di importarle a metà", () => {
    const dati = datiDemo();
    const rotto = {
      formato: "freelance-flow",
      versioneSchema: 1,
      esportatoIl: "2026-09-01T00:00:00.000Z",
      dati: {
        ...dati,
        fatture: [
          dati.fatture[0],
          { ...dati.fatture[1], dataEmissione: "01/02/2026" },
          { ...dati.fatture[2], imponibile: "tremila" },
        ],
      },
    };
    const esito = analizzaBackup(JSON.stringify(rotto));
    expect(esito.ok).toBe(false);
    if (esito.ok) return;
    expect(esito.errori).toHaveLength(2);
    expect(esito.errori[0]).toContain("aaaa-mm-gg");
    expect(esito.errori[1]).toContain("non numerico");
  });

  it("scarta i campi derivati che non devono stare nell'archivio", () => {
    const dati = datiDemo();
    const conDerivati = {
      formato: "freelance-flow",
      versioneSchema: 1,
      esportatoIl: "2026-09-01T00:00:00.000Z",
      dati: {
        ...datiVuoti(),
        fatture: [{ ...dati.fatture[0], totale: 99_999, stato: "incassato", giorniRitardo: 4 }],
      },
    };
    const esito = analizzaBackup(JSON.stringify(conDerivati));
    expect(esito.ok).toBe(true);
    if (!esito.ok) return;
    const fattura = esito.backup.dati.fatture[0] as Record<string, unknown>;
    expect(fattura.totale).toBeUndefined();
    expect(fattura.stato).toBeUndefined();
    expect(fattura.giorniRitardo).toBeUndefined();
    expect(fattura.imponibile).toBe(dati.fatture[0].imponibile);
  });

  it("avvisa delle fatture orfane senza rifiutare il file", () => {
    const dati = datiDemo();
    const esito = analizzaBackup(
      serializzaBackup(creaBackup({ ...dati, clienti: [] })),
    );
    expect(esito.ok).toBe(true);
    if (!esito.ok) return;
    expect(esito.avvisi.some((a) => a.includes("non presenti nel backup"))).toBe(true);
  });

  it("accetta un backup più vecchio avvisando", () => {
    const esito = analizzaBackup(
      JSON.stringify({ formato: "freelance-flow", versioneSchema: 0, dati: datiVuoti() }),
    );
    expect(esito.ok).toBe(true);
    if (!esito.ok) return;
    expect(esito.avvisi[0]).toContain("più vecchio");
  });
});

// ————————————————————————————————————————————————————————————
// Dataset dimostrativo
// ————————————————————————————————————————————————————————————

describe("dataset dimostrativo", () => {
  const dati = datiDemo();

  it("è deterministico", () => {
    expect(serializzaBackup(creaBackup(datiDemo(), new Date(0)))).toBe(
      serializzaBackup(creaBackup(datiDemo(), new Date(0))),
    );
  });

  it("descrive un anno plausibile", () => {
    const emesso = dati.fatture.reduce((a, f) => a + f.imponibile, 0);
    expect(emesso).toBe(46_050);
    expect(dati.fatture).toHaveLength(24);
    expect(dati.clienti).toHaveLength(7);
    expect(dati.movimentiPersonali).toHaveLength(12);
  });

  it("ha identificatori univoci e riferimenti validi", () => {
    const idFatture = new Set(dati.fatture.map((f) => f.id));
    expect(idFatture.size).toBe(dati.fatture.length);
    const numeri = new Set(dati.fatture.map((f) => f.numero));
    expect(numeri.size).toBe(dati.fatture.length);

    const idClienti = new Set(dati.clienti.map((c) => c.id));
    for (const f of dati.fatture) expect(idClienti.has(f.clienteId)).toBe(true);
  });

  it("non contiene campi derivati", () => {
    const vietati = ["iva", "totale", "stato", "scadenza", "giorniRitardo", "nettoIncasso"];
    for (const f of dati.fatture) {
      for (const campo of vietati) expect(f).not.toHaveProperty(campo);
    }
    for (const c of dati.costi) {
      for (const campo of ["totale", "costoDeducibile", "ivaDetraibile", "stato"]) {
        expect(c).not.toHaveProperty(campo);
      }
    }
  });

  it("lascia aperto un credito commerciale plausibile", () => {
    const aperte = dati.fatture.filter((f) => !f.dataIncasso);
    expect(aperte).toHaveLength(4);
    const credito = aperte.reduce((a, f) => a + f.imponibile, 0);
    expect(credito).toBe(6100);
    // Il credito aperto sta sotto un sesto del fatturato: un tenore realistico.
    expect(credito / 46_050).toBeLessThan(0.17);
  });

  it("attraversa il motore fiscale producendo numeri sensati", () => {
    const [impostazioni] = dati.impostazioni;
    const p = calcolaProspetto({
      impostazioni,
      parametri: PARAMETRI_2026,
      fatture: dati.fatture,
      costi: dati.costi,
      versamenti: dati.versamenti,
      oggi: "2026-09-01",
    });

    expect(p.fatturatoEmesso).toBe(46_050);
    expect(p.ricaviRilevanti).toBe(39_950);
    expect(p.soglia.inSospeso).toBe(6100);
    expect(p.ricaviRilevanti).toBeLessThan(p.fatturatoEmesso);
    expect(p.soglia.stato).toBe("neiLimiti");
    expect(p.pressione).toBeGreaterThan(0.2);
    expect(p.pressione).toBeLessThan(0.4);
    expect(p.nettoDisponibile).toBeGreaterThan(0);
    // Ci sono F24 registrati: il motore deduce i contributi per cassa.
    expect(p.fonteContributiDedotti).toBe("versamenti");
    expect(p.contributiDedotti).toBe(6690);
  });
});

function ordina(righe: readonly unknown[]): unknown[] {
  return [...righe].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

// ————————————————————————————————————————————————————————————
// Evoluzione dello schema
// ————————————————————————————————————————————————————————————

describe("versioni dello schema", () => {
  it("un backup della versione 1 si importa ancora, con le collezioni nuove vuote", () => {
    const dati = datiDemo();
    const vecchio = {
      formato: "freelance-flow",
      versioneSchema: 1,
      esportatoIl: "2026-06-01T00:00:00.000Z",
      dati: {
        impostazioni: dati.impostazioni,
        clienti: dati.clienti,
        fatture: dati.fatture,
        costi: dati.costi,
        movimentiPersonali: dati.movimentiPersonali,
        movimentiAttivita: dati.movimentiAttivita,
        versamenti: dati.versamenti,
        patrimonio: dati.patrimonio,
        // «spunte» non esisteva ancora.
      },
    };
    const esito = analizzaBackup(JSON.stringify(vecchio));
    expect(esito.ok).toBe(true);
    if (!esito.ok) return;
    expect(esito.avvisi.some((a) => a.includes("più vecchio"))).toBe(true);
    expect(esito.backup.dati.spunte).toEqual([]);
    expect(esito.backup.dati.fatture).toHaveLength(24);
  });

  it("le spunte sopravvivono al giro completo di export e import", async () => {
    const adapter = new MemoriaAdapter();
    await adapter.scriviTutto(datiDemo(), "sostituisci");
    await adapter.spunte.salva({
      id: "2026:secondo-acconto",
      anno: 2026,
      idAdempimento: "secondo-acconto",
      completatoIl: "2026-11-30",
    });

    const file = serializzaBackup(creaBackup(await adapter.leggiTutto()));
    await adapter.svuota();
    const letto = analizzaBackup(file);
    expect(letto.ok).toBe(true);
    if (!letto.ok) return;
    await adapter.scriviTutto(letto.backup.dati, "sostituisci");

    const spunte = await adapter.spunte.tutti();
    expect(spunte).toHaveLength(2);
    expect(spunte.map((s) => s.idAdempimento).sort()).toEqual([
      "saldo-e-primo-acconto",
      "secondo-acconto",
    ]);
  });
});
