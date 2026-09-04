import { describe, expect, it } from "vitest";
import { calcolaProspetto } from "@/lib/fisco/motore";
import { COSTI_FIXTURE, FATTURE_FIXTURE, OGGI_FIXTURE, impostazioniForfettario, impostazioniOrdinario } from "@/lib/fisco/fixture";
import { PARAMETRI_2026 } from "@/lib/fisco/parametri/2026";
import type { Impostazioni } from "@/lib/fisco/tipi";
import { euro } from "@/lib/format";
import {
  avanzamento,
  chiavePercorso,
  contestoSuggerito,
  passiDi,
  percorsoVuoto,
  statoDelPasso,
  CONTESTI,
  DESCRIZIONE_CONTESTO,
  NOME_CONTESTO,
  PASSI,
  type ContestoCalcolo,
  type ContestoPercorso,
  type StatoPercorso,
} from "./percorso";

function calcoloCon(imp: Impostazioni): ContestoCalcolo {
  return {
    impostazioni: imp,
    parametri: PARAMETRI_2026,
    prospetto: calcolaProspetto({
      impostazioni: imp,
      parametri: PARAMETRI_2026,
      fatture: FATTURE_FIXTURE,
      costi: COSTI_FIXTURE,
      oggi: OGGI_FIXTURE,
    }),
  };
}

const forfettario = calcoloCon(impostazioniForfettario());
const ordinario = calcoloCon(impostazioniOrdinario());

// ————————————————————————————————————————————————————————————
// Un percorso solo, parametrizzato
// ————————————————————————————————————————————————————————————

describe("un percorso, tre contesti", () => {
  it("le domande di configurazione sono le stesse in tutti e tre", () => {
    const domande = (c: ContestoPercorso) =>
      passiDi(c, forfettario)
        .filter((p) => !p.soloLettura && p.id !== "partenza")
        .map((p) => p.id);

    expect(domande("primoAvvio")).toEqual(domande("aperturaAnno"));
    expect(domande("aperturaAnno")).toEqual(domande("cambioRegime"));
    // Sono definite una volta sola: nessun id compare due volte nell'elenco.
    expect(new Set(PASSI.map((p) => p.id)).size).toBe(PASSI.length);
  });

  it("ogni contesto ha il suo passo di apertura, e uno solo", () => {
    expect(passiDi("aperturaAnno", forfettario)[0].id).toBe("riporti");
    expect(passiDi("cambioRegime", forfettario)[0].id).toBe("confronto");
    expect(passiDi("primoAvvio", forfettario)[0].id).toBe("regime");

    // I passi di sola lettura non compaiono dove non c'entrano.
    expect(passiDi("primoAvvio", forfettario).map((p) => p.id)).not.toContain("riporti");
    expect(passiDi("aperturaAnno", forfettario).map((p) => p.id)).not.toContain("confronto");
  });

  it("la scelta di come partire si propone solo al primo avvio", () => {
    expect(passiDi("primoAvvio", forfettario).map((p) => p.id)).toContain("partenza");
    expect(passiDi("aperturaAnno", forfettario).map((p) => p.id)).not.toContain("partenza");
    expect(passiDi("cambioRegime", forfettario).map((p) => p.id)).not.toContain("partenza");
    // Ed è l'ultimo: prima si configura, poi si sceglie da dove partire.
    const passi = passiDi("primoAvvio", forfettario);
    expect(passi[passi.length - 1].id).toBe("partenza");
  });

  it("il passo finale nomina tutt'e due le strade, non solo la demo", () => {
    const passo = PASSI.find((p) => p.id === "partenza");
    if (!passo) throw new Error("il passo di partenza deve esistere");
    const testo = `${passo.domanda} ${passo.perche} ${passo.seSalti(forfettario)}`;
    // Chi arriva a metà anno ha già lo storico: se il passo parlasse solo del
    // dataset dimostrativo lo lascerebbe davanti a schermate vuote.
    expect(testo).toMatch(/storico/i);
    expect(testo).toMatch(/dimostrativ/i);
    // E il terzo esito — non fare nessuna delle due — resta dichiarato.
    expect(passo.seSalti(forfettario)).toMatch(/vuoto/i);
  });

  it("mostra solo le domande che hanno senso nel regime attuale", () => {
    const inForfettario = passiDi("primoAvvio", forfettario).map((p) => p.id);
    expect(inForfettario).toContain("ateco");
    expect(inForfettario).toContain("sostitutiva");
    expect(inForfettario).not.toContain("iva");

    const inOrdinario = passiDi("primoAvvio", ordinario).map((p) => p.id);
    expect(inOrdinario).toContain("iva");
    expect(inOrdinario).not.toContain("ateco");
    expect(inOrdinario).not.toContain("sostitutiva");
  });

  it("i passi restano in ordine crescente in ogni contesto", () => {
    for (const c of CONTESTI) {
      const ordini = passiDi(c, forfettario).map((p) => p.ordine);
      expect([...ordini].sort((a, b) => a - b)).toEqual(ordini);
    }
  });
});

// ————————————————————————————————————————————————————————————
// Ogni domanda si spiega
// ————————————————————————————————————————————————————————————

describe("ogni domanda dice perché la sta facendo", () => {
  it.each(PASSI.map((p) => [p.id, p] as const))("%s", (_id, passo) => {
    expect(passo.titolo.length).toBeGreaterThan(0);
    expect(passo.domanda.endsWith("?") || passo.soloLettura).toBe(true);
    // Non una nota d'aiuto generica: deve spiegare cosa muove.
    expect(passo.perche.length).toBeGreaterThan(120);
    expect(passo.contesti.length).toBeGreaterThan(0);
  });

  it("ogni passo dichiara cosa resta impostato se lo si salta", () => {
    for (const passo of PASSI) {
      const testo = passo.seSalti(forfettario);
      expect(testo.length).toBeGreaterThan(20);
      // Un default dichiarato, non «verrà usato un valore predefinito».
      expect(testo.toLowerCase()).not.toContain("un valore predefinito");
    }
  });

  it("l'effetto è calcolato sui numeri di chi risponde, non su un esempio", () => {
    // Le cifre si confrontano con il formatter, mai con una stringa scritta a
    // mano: fra il numero e l'euro c'è uno spazio unificatore, non uno normale.
    const regime = PASSI.find((p) => p.id === "regime");
    expect(regime?.effetto?.(forfettario)).toContain(euro(7_500));

    const ateco = PASSI.find((p) => p.id === "ateco");
    // 7.500 × 78 % = 5.850: la cifra è quella del fixture, non un tondo inventato.
    expect(ateco?.effetto?.(forfettario)).toContain(euro(5_850));
  });

  it("senza numeri l'effetto tace invece di inventarsi un esempio", () => {
    const vuoto = calcoloCon(impostazioniForfettario());
    const senzaDocumenti: ContestoCalcolo = {
      ...vuoto,
      prospetto: calcolaProspetto({
        impostazioni: impostazioniForfettario(),
        parametri: PARAMETRI_2026,
        fatture: [],
        costi: [],
        oggi: OGGI_FIXTURE,
      }),
    };
    for (const passo of PASSI) {
      expect(passo.effetto?.(senzaDocumenti) ?? null).toBeNull();
    }
  });

  it("ogni contesto ha nome e descrizione", () => {
    for (const c of CONTESTI) {
      expect(NOME_CONTESTO[c].length).toBeGreaterThan(0);
      expect(DESCRIZIONE_CONTESTO[c].length).toBeGreaterThan(40);
    }
  });
});

// ————————————————————————————————————————————————————————————
// Saltare e riprendere
// ————————————————————————————————————————————————————————————

describe("si può saltare e riprendere", () => {
  const passi = passiDi("primoAvvio", forfettario);

  function statoCon(confermati: string[], saltati: string[] = []): StatoPercorso {
    return { ...percorsoVuoto("primoAvvio", 2026, "2026-09-01T00:00:00Z"), confermati, saltati };
  }

  it("senza stato tutti i passi sono da fare e si riprende dal primo", () => {
    const a = avanzamento(passi, null);
    expect(a.confermati).toBe(0);
    expect(a.daFare).toBe(passi.length);
    expect(a.prossimo?.id).toBe(passi[0].id);
    expect(a.completo).toBe(false);
  });

  it("si riprende dal primo passo non ancora affrontato, saltati compresi", () => {
    const a = avanzamento(passi, statoCon(["regime"], ["ateco"]));
    expect(a.confermati).toBe(1);
    expect(a.saltati).toBe(1);
    expect(a.prossimo?.id).toBe("sostitutiva");
  });

  it("un passo saltato resta distinto da uno confermato", () => {
    const stato = statoCon(["regime"], ["ateco"]);
    expect(statoDelPasso(stato, "regime")).toBe("confermato");
    expect(statoDelPasso(stato, "ateco")).toBe("saltato");
    expect(statoDelPasso(stato, "gestione")).toBe("daFare");
  });

  it("il percorso è completo quando non resta niente da vedere", () => {
    const tutti = passi.map((p) => p.id);
    const a = avanzamento(passi, statoCon(tutti));
    expect(a.completo).toBe(true);
    expect(a.prossimo).toBeNull();
  });

  it("conta come completo anche un percorso tutto saltato", () => {
    // Saltare è una risposta: non blocca, e i valori restano i predefiniti dichiarati.
    const a = avanzamento(passi, statoCon([], passi.map((p) => p.id)));
    expect(a.completo).toBe(true);
    expect(a.saltati).toBe(passi.length);
    expect(a.confermati).toBe(0);
  });

  it("la chiave tiene separati contesto e anno", () => {
    expect(chiavePercorso("primoAvvio", 2026)).toBe("primoAvvio:2026");
    expect(chiavePercorso("aperturaAnno", 2026)).not.toBe(chiavePercorso("primoAvvio", 2026));
    expect(chiavePercorso("primoAvvio", 2027)).not.toBe(chiavePercorso("primoAvvio", 2026));
  });
});

// ————————————————————————————————————————————————————————————
// Quale percorso proporre
// ————————————————————————————————————————————————————————————

describe("il contesto si deduce dallo stato dell'app", () => {
  const base = {
    anno: 2027,
    archivioVuoto: false,
    precedenteChiuso: false,
    cambioRegimeProposto: false,
    completati: [] as string[],
  };

  it("archivio vuoto: primo avvio", () => {
    expect(contestoSuggerito({ ...base, archivioVuoto: true }).contesto).toBe("primoAvvio");
  });

  it("anno precedente chiuso: apertura d'anno", () => {
    expect(contestoSuggerito({ ...base, precedenteChiuso: true }).contesto).toBe("aperturaAnno");
  });

  it("il cambio di regime batte l'apertura d'anno: è la notizia", () => {
    const s = { ...base, precedenteChiuso: true, cambioRegimeProposto: true };
    expect(contestoSuggerito(s).contesto).toBe("cambioRegime");
    expect(contestoSuggerito(s).motivo).toContain("cambio di regime");
  });

  it("l'archivio vuoto batte tutto: senza configurazione il resto non poggia su niente", () => {
    const s = { ...base, archivioVuoto: true, precedenteChiuso: true, cambioRegimeProposto: true };
    expect(contestoSuggerito(s).contesto).toBe("primoAvvio");
  });

  it("un percorso già completato non si ripropone", () => {
    const s = {
      ...base,
      archivioVuoto: true,
      completati: [chiavePercorso("primoAvvio", 2027)],
    };
    expect(contestoSuggerito(s).contesto).toBeNull();
  });

  it("completato per un anno, resta da fare per l'anno dopo", () => {
    const s = {
      ...base,
      precedenteChiuso: true,
      completati: [chiavePercorso("aperturaAnno", 2026)],
    };
    expect(contestoSuggerito(s).contesto).toBe("aperturaAnno");
  });

  it("niente in sospeso: nessun contesto, ma con una spiegazione", () => {
    const s = contestoSuggerito(base);
    expect(s.contesto).toBeNull();
    expect(s.motivo).toContain("2027");
  });
});
