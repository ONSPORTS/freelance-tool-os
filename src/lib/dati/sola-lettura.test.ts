import { beforeEach, describe, expect, it } from "vitest";
import { MemoriaAdapter } from "./memoria-adapter";
import { ErroreSolaLettura, conSolaLettura } from "./sola-lettura";
import { creaBackup, serializzaBackup } from "./backup";
import type { Fattura } from "@/lib/fisco/tipi";

const FATTURA: Fattura = {
  id: "f1",
  dataEmissione: "2026-02-01",
  numero: "2026/001",
  clienteId: "c1",
  descrizione: "Consulenza",
  tipoRicavo: "progetto",
  imponibile: 1_000,
};

let bloccato = false;
let base: MemoriaAdapter;
let archivio: ReturnType<typeof conSolaLettura>;

beforeEach(async () => {
  bloccato = false;
  base = new MemoriaAdapter();
  archivio = conSolaLettura(base, () => bloccato);
  await archivio.fatture.salva(FATTURA);
  await archivio.clienti.salva({
    id: "c1",
    nome: "Alfa Srl",
    canaleAcquisizione: "Passaparola",
    note: "",
  });
});

describe("a licenza scaduta si vede tutto", () => {
  it("le letture passano, una per una", async () => {
    bloccato = true;
    expect(await archivio.fatture.tutti()).toHaveLength(1);
    expect((await archivio.fatture.leggi("f1"))?.numero).toBe("2026/001");
    expect(await archivio.fatture.conta()).toBe(1);
    expect(await archivio.vuoto()).toBe(false);
  });

  it("l'archivio si legge tutto insieme: è da lì che esce il backup", async () => {
    bloccato = true;
    const contenuto = await archivio.leggiTutto();
    expect(contenuto.fatture).toHaveLength(1);
  });

  it("**l'esportazione resta possibile**: i dati non sono in ostaggio", async () => {
    bloccato = true;
    const testo = serializzaBackup(creaBackup(await archivio.leggiTutto()));
    expect(JSON.parse(testo).dati.fatture[0].numero).toBe("2026/001");
  });
});

describe("a licenza scaduta non si scrive niente", () => {
  it("nessuna delle quattro scritture passa, su nessuna collezione", async () => {
    bloccato = true;
    const prova = [
      () => archivio.fatture.salva({ ...FATTURA, id: "f2" }),
      () => archivio.fatture.salvaMolti([{ ...FATTURA, id: "f3" }]),
      () => archivio.fatture.elimina("f1"),
      () => archivio.fatture.eliminaMolti(["f1"]),
      () => archivio.costi.salva({} as never),
      () => archivio.impostazioni.salva({} as never),
      () => archivio.patrimonio.elimina("x"),
      () => archivio.percorsi.salva({} as never),
    ];
    for (const scrittura of prova) {
      await expect(scrittura()).rejects.toThrow(ErroreSolaLettura);
    }
    // E niente è cambiato davvero.
    expect(await base.fatture.conta()).toBe(1);
  });

  it("nemmeno importare un backup o svuotare l'archivio", async () => {
    const contenuto = await archivio.leggiTutto();
    bloccato = true;
    await expect(archivio.scriviTutto(contenuto, "sostituisci")).rejects.toThrow(
      ErroreSolaLettura,
    );
    await expect(archivio.svuota()).rejects.toThrow(ErroreSolaLettura);
    expect(await base.fatture.conta()).toBe(1);
  });

  it("l'errore dice perché, e che l'export resta attivo", async () => {
    bloccato = true;
    await expect(archivio.fatture.salva(FATTURA)).rejects.toThrow(/sola lettura/);
    await expect(archivio.fatture.salva(FATTURA)).rejects.toThrow(/esportazione/i);
  });
});

describe("la guardia si interroga a ogni scrittura", () => {
  it("con licenza valida si scrive come sempre", async () => {
    await archivio.fatture.salva({ ...FATTURA, id: "f9" });
    expect(await archivio.fatture.conta()).toBe(2);
  });

  it("la licenza che scade mentre l'app è aperta blocca subito", async () => {
    await archivio.fatture.salva({ ...FATTURA, id: "f9" });
    bloccato = true;
    await expect(archivio.fatture.salva({ ...FATTURA, id: "f10" })).rejects.toThrow(
      ErroreSolaLettura,
    );
    // E che torni valida (una chiave nuova incollata) rimette tutto a posto,
    // senza ricaricare la pagina.
    bloccato = false;
    await archivio.fatture.salva({ ...FATTURA, id: "f10" });
    expect(await archivio.fatture.conta()).toBe(3);
  });
});
