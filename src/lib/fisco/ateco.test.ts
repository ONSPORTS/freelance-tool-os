import { describe, expect, it } from "vitest";
import { cercaGruppi, normalizza, SINONIMI } from "./ateco";
import { PARAMETRI_2026 } from "./parametri/2026";

const gruppi = PARAMETRI_2026.gruppiAteco;
const primo = (q: string) => cercaGruppi(q, gruppi)[0]?.gruppo.codice ?? null;

describe("trovare il gruppo ATECO partendo dal mestiere", () => {
  it("i mestieri più comuni fra i freelance cadono nel gruppo giusto", () => {
    // È il caso da cui nasce la ricerca: consulente marketing, 78 %.
    expect(primo("consulente marketing")).toBe("professionali");
    expect(primo("grafico")).toBe("professionali");
    expect(primo("sviluppatore")).toBe("professionali");
    expect(primo("avvocato")).toBe("professionali");
    expect(primo("idraulico")).toBe("costruzioni");
    expect(primo("imbianchino")).toBe("costruzioni");
    expect(primo("e-commerce")).toBe("commercio");
    expect(primo("negozio")).toBe("commercio");
    expect(primo("agente di commercio")).toBe("intermediari");
    expect(primo("personal trainer")).toBe("altre");
    expect(primo("pizzeria")).toBe("ristorazione");
    expect(primo("pasticceria")).toBe("alimentari");
    expect(primo("ambulante")).toBe("ambulanteAltri");
  });

  it("basta l'inizio della parola", () => {
    expect(primo("idra")).toBe("costruzioni");
    expect(primo("consul")).toBe("professionali");
  });

  it("accenti, maiuscole e trattini non contano", () => {
    expect(normalizza("E-Commerce")).toBe("e commerce");
    expect(primo("ECOMMERCE")).toBe("commercio");
  });

  it("una parola che non c'entra non allarga la ricerca", () => {
    // «consulente» da solo troverebbe le professionali: aggiungendo una parola
    // che non esiste da nessuna parte il risultato dev'essere vuoto, non un
    // gruppo qualsiasi che contiene «consulente».
    expect(cercaGruppi("consulente banana", gruppi)).toEqual([]);
  });

  it("senza ricerca l'elenco resta quello di legge, nell'ordine di legge", () => {
    const tutti = cercaGruppi("   ", gruppi);
    expect(tutti.map((e) => e.gruppo.codice)).toEqual(gruppi.map((g) => g.codice));
    expect(tutti.every((e) => e.perche === null)).toBe(true);
  });

  it("dice quale mestiere ha fatto centro", () => {
    const esito = cercaGruppi("dentista", gruppi)[0];
    expect(esito.perche).toBe("dentista");
    // Cercando le parole della legge non c'è un mestiere da mostrare.
    expect(cercaGruppi("ristorazione", gruppi)[0].perche).toBe(null);
  });

  it("ogni sinonimo punta a un gruppo che esiste davvero", () => {
    // Un refuso nel codice del gruppo renderebbe invisibile un intero elenco
    // di mestieri, senza che niente fallisca.
    const codici = new Set(gruppi.map((g) => g.codice));
    for (const s of SINONIMI) expect(codici.has(s.gruppo)).toBe(true);
    expect(SINONIMI.length).toBe(gruppi.length);
  });

  it("nessun mestiere è elencato in due gruppi diversi", () => {
    const visti = new Map<string, string>();
    for (const s of SINONIMI) {
      for (const parola of s.parole) {
        const chiave = normalizza(parola);
        expect(visti.get(chiave) ?? s.gruppo).toBe(s.gruppo);
        visti.set(chiave, s.gruppo);
      }
    }
  });
});
