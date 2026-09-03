import { beforeEach, describe, expect, it } from "vitest";
import { toast, useToast, type Raggruppamento } from "@/lib/stato/toast";

const COSTI: Raggruppamento = {
  chiave: "costo-aggiornato",
  molti: (n) => `${n} costi aggiornati`,
};
const FATTURE: Raggruppamento = {
  chiave: "fattura-aggiornata",
  molti: (n) => `${n} fatture aggiornate`,
};

beforeEach(() => useToast.setState({ toast: null }));

const attuale = () => useToast.getState().toast;

describe("un toast alla volta", () => {
  it("il nuovo prende il posto del vecchio invece di accodarsi", () => {
    toast.conferma("Fattura creata");
    toast.conferma("Costo eliminato");
    expect(attuale()?.messaggio).toBe("Costo eliminato");
  });

  it("chiudere un toast che non è più quello a schermo non fa niente", () => {
    const id = toast.conferma("Primo");
    toast.conferma("Secondo");
    useToast.getState().chiudi(id);
    expect(attuale()?.messaggio).toBe("Secondo");
  });
});

describe("le modifiche ravvicinate si accorpano", () => {
  it("**dodici modifiche diventano un toast che le conta**", () => {
    for (let i = 0; i < 12; i++) toast.conferma("Costo aggiornato", () => {}, COSTI);
    expect(attuale()?.messaggio).toBe("12 costi aggiornati");
    expect(attuale()?.quanti).toBe(12);
  });

  it("la prima resta al singolare: «1 costi aggiornati» sarebbe sciatto", () => {
    toast.conferma("Costo aggiornato", () => {}, COSTI);
    expect(attuale()?.messaggio).toBe("Costo aggiornato");
  });

  it("il gruppo si rinnova a ogni modifica, così il timer riparte", () => {
    const primo = toast.conferma("Costo aggiornato", () => {}, COSTI);
    const secondo = toast.conferma("Costo aggiornato", () => {}, COSTI);
    expect(secondo).not.toBe(primo);
    expect(attuale()?.id).toBe(secondo);
  });

  it("gruppi diversi non si mescolano: l'ultimo sostituisce", () => {
    toast.conferma("Costo aggiornato", () => {}, COSTI);
    toast.conferma("Costo aggiornato", () => {}, COSTI);
    toast.conferma("Fattura aggiornata", () => {}, FATTURE);
    expect(attuale()?.messaggio).toBe("Fattura aggiornata");
    expect(attuale()?.quanti).toBe(1);
  });

  it("un'azione senza gruppo non si accorpa mai", () => {
    toast.conferma("Anno 2026 chiuso", () => {});
    toast.conferma("Anno 2027 chiuso", () => {});
    expect(attuale()?.quanti).toBe(1);
    expect(attuale()?.messaggio).toBe("Anno 2027 chiuso");
  });
});

describe("un solo Annulla che disfa tutto il gruppo", () => {
  it("**esegue gli annullamenti dall'ultimo al primo**", async () => {
    // L'ordine conta: disfare dalla fine è l'unico che riporta ogni riga al
    // valore che aveva prima del gruppo.
    const ordine: number[] = [];
    for (let i = 1; i <= 3; i++) {
      toast.conferma("Costo aggiornato", () => { ordine.push(i); }, COSTI);
    }
    await useToast.getState().annulla(attuale()!.id);
    expect(ordine).toEqual([3, 2, 1]);
  });

  it("aspetta gli annullamenti asincroni, uno per volta", async () => {
    const fatti: string[] = [];
    const lento = (nome: string, ms: number) => async () => {
      await new Promise((r) => setTimeout(r, ms));
      fatti.push(nome);
    };
    toast.conferma("Costo aggiornato", lento("primo", 20), COSTI);
    toast.conferma("Costo aggiornato", lento("secondo", 1), COSTI);
    await useToast.getState().annulla(attuale()!.id);
    expect(fatti).toEqual(["secondo", "primo"]);
  });

  it("dopo l'annullamento il toast sparisce", async () => {
    toast.conferma("Costo aggiornato", () => {}, COSTI);
    await useToast.getState().annulla(attuale()!.id);
    expect(attuale()).toBeNull();
  });

  it("annullare due volte non riesegue niente", async () => {
    let volte = 0;
    toast.conferma("Costo aggiornato", () => { volte++; }, COSTI);
    const id = attuale()!.id;
    await useToast.getState().annulla(id);
    await useToast.getState().annulla(id);
    expect(volte).toBe(1);
  });

  it("un avviso non porta l'Annulla", () => {
    toast.avviso("Licenza scaduta");
    expect(attuale()?.annullamenti).toEqual([]);
  });
});
