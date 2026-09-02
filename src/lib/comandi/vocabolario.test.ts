import { describe, expect, it } from "vitest";
import { normalizza, riscontro, riscontroMigliore, tratti } from "./fuzzy";
import {
  DESTINAZIONI,
  cerca,
  comandi,
  perSezione,
  type ContestoComandi,
} from "./vocabolario";
import { GRUPPI_SCORCIATOIE, ROTTE_PER_TASTO } from "./scorciatoie";

const CTX: ContestoComandi = {
  annoCorrente: 2026,
  anni: [2026, 2025],
  fatture: [
    { id: "f1", numero: "2026/01", cliente: "Acme S.r.l.", imponibile: 1_500, incassata: false },
    { id: "f2", numero: "2026/02", cliente: "Bàrbero & Figli", imponibile: 800, incassata: true },
    { id: "f3", numero: "2026/03", cliente: "Cosmo Design", imponibile: 2_400, incassata: false },
  ],
  clienti: [
    { id: "c1", nome: "Acme S.r.l." },
    { id: "c2", nome: "Bàrbero & Figli" },
    { id: "c3", nome: "Cosmo Design" },
  ],
};

const TUTTI = comandi(CTX);

function etichette(query: string, n = 5) {
  return cerca(TUTTI, query).slice(0, n).map((e) => e.comando.etichetta);
}

// ————————————————————————————————————————————————————————————
// La ricerca fuzzy
// ————————————————————————————————————————————————————————————

describe("ricerca per sottosequenza", () => {
  it("trova le lettere in ordine anche se non sono di seguito", () => {
    expect(riscontro("Nuova fattura", "nvft")).not.toBeNull();
    expect(riscontro("Nuova fattura", "ftn")).toBeNull(); // l'ordine conta
  });

  it("ignora accenti e maiuscole, senza spostare gli indici", () => {
    expect(normalizza("Bàrbero & FIGLI")).toBe("barbero & figli");
    const r = riscontro("Bàrbero", "bar");
    expect(r?.indici).toEqual([0, 1, 2]);
    // Gli indici devono ritagliare la stringa *originale*, accenti compresi.
    expect(tratti("Bàrbero", r!.indici)[0]).toEqual({ testo: "Bàr", evidenziato: true });
  });

  it("premia l'inizio di parola rispetto al mezzo", () => {
    const inizio = riscontro("Confronto regimi", "cr")!.punteggio;
    const mezzo = riscontro("Scadenzario cronico", "cr")!.punteggio;
    expect(inizio).toBeGreaterThan(mezzo);
  });

  it("premia le lettere contigue", () => {
    const contiguo = riscontro("fatture", "fat")!.punteggio;
    const sparso = riscontro("federico attilio tosi", "fat")!.punteggio;
    expect(contiguo).toBeGreaterThan(sparso);
  });

  it("una query vuota è un riscontro neutro, non un fallimento", () => {
    expect(riscontro("qualsiasi", "  ")).toEqual({ punteggio: 0, indici: [] });
  });

  it("cerca nel campo che risponde meglio", () => {
    const r = riscontroMigliore(["Apri fattura 2026/01", "Acme S.r.l."], "acme");
    expect(r).not.toBeNull();
    expect(r!.punteggio).toBe(riscontro("Acme S.r.l.", "acme")!.punteggio);
  });

  it("i tratti ricompongono sempre il testo di partenza", () => {
    const r = riscontro("Cambia anno · 2025", "2025")!;
    expect(tratti("Cambia anno · 2025", r.indici).map((t) => t.testo).join("")).toBe(
      "Cambia anno · 2025",
    );
  });
});

// ————————————————————————————————————————————————————————————
// Il vocabolario minimo
// ————————————————————————————————————————————————————————————

describe("il vocabolario copre quello che si fa ogni giorno", () => {
  it("contiene le sei voci minime", () => {
    const tipi = TUTTI.map((c) => c.azione.tipo);
    for (const atteso of [
      "vai",
      "nuovaFattura",
      "nuovoCosto",
      "segnaIncassata",
      "cambiaAnno",
      "esportaBackup",
    ]) {
      expect(tipi).toContain(atteso);
    }
  });

  it("porta una voce per ogni schermata pronta", () => {
    const href = TUTTI.filter((c) => c.azione.tipo === "vai").map((c) =>
      c.azione.tipo === "vai" ? c.azione.href : "",
    );
    for (const d of DESTINAZIONI.filter((x) => x.pronta)) expect(href).toContain(d.href);
    // Le schermate non pronte non compaiono: un comando che porta a una pagina
    // vuota è peggio di un comando assente.
    for (const d of DESTINAZIONI.filter((x) => !x.pronta)) expect(href).not.toContain(d.href);
  });

  it("propone «segna incassata» solo sulle fatture aperte", () => {
    const incassa = TUTTI.filter((c) => c.azione.tipo === "segnaIncassata");
    expect(incassa).toHaveLength(2);
    expect(incassa.map((c) => c.etichetta)).toEqual([
      "Segna incassata 2026/01",
      "Segna incassata 2026/03",
    ]);
  });

  it("offre un comando per ciascun anno, non un menu dentro il menu", () => {
    const anni = TUTTI.filter((c) => c.azione.tipo === "cambiaAnno");
    expect(anni.map((c) => c.etichetta)).toEqual(["Cambia anno · 2026", "Cambia anno · 2025"]);
    expect(anni[0].dettaglio).toBe("anno corrente");
  });

  it("gli id sono unici: la lista è anche una lista di chiavi React", () => {
    const id = TUTTI.map((c) => c.id);
    expect(new Set(id).size).toBe(id.length);
  });
});

describe("in sola lettura restano solo i comandi che leggono", () => {
  const bloccati = comandi({ ...CTX, solaLettura: true });
  const tipi = bloccati.map((c) => c.azione.tipo);

  it("niente «nuova fattura», «nuovo costo», «segna incassata»", () => {
    expect(tipi).not.toContain("nuovaFattura");
    expect(tipi).not.toContain("nuovoCosto");
    expect(tipi).not.toContain("segnaIncassata");
  });

  it("**«esporta backup» resta**: i dati non sono in ostaggio della licenza", () => {
    expect(tipi).toContain("esportaBackup");
    // «Dati e backup» — la schermata — e «Esporta backup» si contendono la
    // cima e va bene così: la cosa che conta è che il comando ci sia.
    expect(cerca(bloccati, "esporta backup")[0].comando.azione.tipo).toBe("esportaBackup");
  });

  it("navigare, aprire una fattura e cambiare anno si possono ancora", () => {
    expect(tipi).toContain("vai");
    expect(tipi).toContain("apriFattura");
    expect(tipi).toContain("apriCliente");
    expect(tipi).toContain("cambiaAnno");
  });
});

// ————————————————————————————————————————————————————————————
// Cosa trova chi digita
// ————————————————————————————————————————————————————————————

describe("la ricerca porta in cima quello che si stava cercando", () => {
  it("«nuova fattura» in due lettere", () => {
    expect(etichette("nf")[0]).toBe("Nuova fattura");
  });

  it("il numero di fattura trova quella fattura", () => {
    const primi = etichette("2026/03", 3);
    expect(primi.some((e) => e.includes("2026/03"))).toBe(true);
    expect(primi.every((e) => !e.includes("2026/01"))).toBe(true);
  });

  it("il nome del cliente trova le sue fatture e la sua scheda", () => {
    const trovati = cerca(TUTTI, "acme").map((e) => e.comando.id);
    expect(trovati).toContain("cliente:c1");
    expect(trovati).toContain("incassa:f1");
  });

  it("il cliente si trova anche scritto senza accento", () => {
    expect(cerca(TUTTI, "barbero").map((e) => e.comando.id)).toContain("cliente:c2");
  });

  it("«incassa» porta le fatture da incassare, non quelle già incassate", () => {
    const trovati = cerca(TUTTI, "segna incassata").map((e) => e.comando.id);
    expect(trovati.filter((id) => id.startsWith("incassa:"))).toHaveLength(2);
    expect(trovati).not.toContain("incassa:f2");
  });

  it("cercare una schermata la trova col suo sinonimo", () => {
    expect(etichette("tasse")[0]).toBe("Imposte e contributi");
    expect(etichette("liquidita")[0]).toBe("Cashflow");
    expect(etichette("dashboard")[0]).toBe("Cruscotto");
  });

  it("una query senza riscontri torna vuota invece di mostrare tutto", () => {
    expect(cerca(TUTTI, "zzzqx")).toEqual([]);
  });

  it("a palette appena aperta le sezioni lunghe sono troncate", () => {
    const molte: ContestoComandi = {
      ...CTX,
      fatture: Array.from({ length: 40 }, (_, i) => ({
        id: `f${i}`,
        numero: `2026/${i}`,
        cliente: "Acme S.r.l.",
        imponibile: 100,
        incassata: false,
      })),
    };
    const vuota = cerca(comandi(molte), "");
    const fatture = vuota.filter((e) => e.comando.sezione === "Fatture");
    expect(fatture.length).toBeLessThanOrEqual(6);
    // Ma le azioni e la navigazione ci sono tutte: è il menu principale.
    expect(vuota.filter((e) => e.comando.sezione === "Azioni")).toHaveLength(3);
    // Digitando, il troncamento sparisce.
    expect(cerca(comandi(molte), "2026/").length).toBeGreaterThan(6);
  });

  it("evidenzia solo le lettere dell'etichetta, non quelle di un sinonimo", () => {
    // «studio» trova la fattura passando dal nome del cliente: sull'etichetta
    // «Segna incassata 2026/023» quelle posizioni illuminerebbero lettere a caso.
    const perSinonimo = cerca(TUTTI, "cosmo").find((e) => e.comando.id === "incassa:f3")!;
    expect(perSinonimo.punteggio).toBeGreaterThan(0);
    expect(perSinonimo.indici).toEqual([]);

    const perEtichetta = cerca(TUTTI, "segna")[0];
    expect(perEtichetta.indici).toEqual([0, 1, 2, 3, 4]);
  });

  it("le sezioni escono raggruppate e nell'ordine dei risultati", () => {
    const gruppi = perSezione(cerca(TUTTI, ""));
    expect(gruppi.map((g) => g.sezione).slice(0, 2)).toEqual(["Azioni", "Vai a"]);
    expect(gruppi.reduce((a, g) => a + g.esiti.length, 0)).toBe(cerca(TUTTI, "").length);
  });
});

// ————————————————————————————————————————————————————————————
// Le scorciatoie dichiarate sono quelle che funzionano
// ————————————————————————————————————————————————————————————

describe("la tabella delle scorciatoie e il vocabolario non divergono", () => {
  it("ogni lettera di `g` porta a una schermata pronta", () => {
    const pronte = new Set(DESTINAZIONI.filter((d) => d.pronta).map((d) => d.href));
    for (const [tasto, href] of Object.entries(ROTTE_PER_TASTO)) {
      expect(tasto).toMatch(/^[a-z]$/);
      expect(pronte.has(href)).toBe(true);
    }
  });

  it("nessuna lettera è assegnata a due schermate", () => {
    const tasti = DESTINAZIONI.filter((d) => d.tasto).map((d) => d.tasto);
    expect(new Set(tasti).size).toBe(tasti.length);
  });

  it("la schermata di aiuto elenca tutte le lettere di navigazione", () => {
    const navigazione = GRUPPI_SCORCIATOIE.find((g) => g.titolo === "Navigazione")!;
    const elencate = navigazione.voci
      .filter((v) => v.tasti[0] === "G" && v.tasti[1]?.length === 1)
      .map((v) => v.tasti[1].toLowerCase());
    expect(elencate.sort()).toEqual(Object.keys(ROTTE_PER_TASTO).sort());
  });

  it("la scorciatoia mostrata sul comando è quella che il tasto esegue", () => {
    for (const c of TUTTI) {
      if (c.azione.tipo !== "vai" || !c.scorciatoia) continue;
      const lettera = c.scorciatoia.replace("G ", "").toLowerCase();
      expect(ROTTE_PER_TASTO[lettera]).toBe(c.azione.href);
    }
    expect(TUTTI.find((c) => c.id === "azione:nuova-fattura")?.scorciatoia).toBe("N");
  });
});
