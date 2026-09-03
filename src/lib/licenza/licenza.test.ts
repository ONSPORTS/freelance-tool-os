import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  componiChiave,
  daBase64Url,
  daFirmare,
  inBase64Url,
  caricoDi,
  leggiChiave,
  type Licenza,
} from "./chiave";
import {
  chiavePubblicaConfigurata,
  controlloChiavePubblica,
  motivoChiavePubblica,
} from "./presidio";
import { verificaChiave } from "./verifica";
import {
  GIORNI_DI_PROVA,
  GIORNI_PREAVVISO,
  descrizione,
  fineProva,
  preavviso,
  solaLettura,
  statoLicenza,
  valutaSostituzione,
} from "./stato";

// ————————————————————————————————————————————————————————————
// Una coppia vera, generata qui: la chiave di produzione non sta
// nel repository e una suite che dipendesse da lei non girerebbe.
// ————————————————————————————————————————————————————————————

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const PUBBLICA = inBase64Url(publicKey.export({ type: "spki", format: "der" }).subarray(12));
const { privateKey: altraPrivata } = generateKeyPairSync("ed25519");

function emetti(licenza: Licenza, con = privateKey): string {
  const carico = caricoDi(licenza);
  const firma = sign(null, Buffer.from(`FLW1.${carico}`, "utf8"), con);
  return componiChiave(licenza, Uint8Array.from(firma));
}

const ACQUIRENTE: Licenza = {
  email: "gabriele@esempio.it",
  scadenza: "2027-03-31",
  emessaIl: "2026-03-31",
};

// ————————————————————————————————————————————————————————————
// Il formato della chiave
// ————————————————————————————————————————————————————————————

describe("il testo della chiave", () => {
  it("si scrive e si rilegge identico", () => {
    const esito = leggiChiave(emetti(ACQUIRENTE));
    expect(esito.ok).toBe(true);
    if (!esito.ok) return;
    expect(esito.chiave.licenza).toEqual(ACQUIRENTE);
  });

  it("regge il copia-incolla: spazi, a capo, prefisso in minuscolo", () => {
    const chiave = emetti(ACQUIRENTE);
    const maltrattata = ` ${chiave.slice(0, 40)}\n  ${chiave.slice(40)} `.replace("FLW1", "flw1");
    const esito = leggiChiave(maltrattata);
    expect(esito.ok).toBe(true);
  });

  it("base64url regge byte arbitrari, andata e ritorno", () => {
    for (const lunghezza of [0, 1, 2, 3, 4, 63, 64, 65]) {
      const byte = Uint8Array.from({ length: lunghezza }, (_, i) => (i * 37 + 11) % 256);
      expect([...(daBase64Url(inBase64Url(byte)) ?? [])]).toEqual([...byte]);
    }
  });

  it("dice cosa non va, invece di limitarsi a rifiutare", () => {
    const motivo = (t: string) => {
      const e = leggiChiave(t);
      return e.ok ? "" : e.motivo;
    };
    expect(motivo("")).toContain("vuota");
    expect(motivo("FLW1.abc")).toContain("tre parti");
    expect(motivo("XXXX.abc.def")).toContain("sconosciuto");
    expect(motivo("FLW1.a!b.cd")).toContain("non validi");
    // Carico leggibile ma firma della lunghezza sbagliata.
    expect(motivo(`FLW1.${caricoDi(ACQUIRENTE)}.AAAA`)).toContain("Ed25519");
  });

  it("una chiave troncata non passa per buona", () => {
    const chiave = emetti(ACQUIRENTE);
    expect(leggiChiave(chiave.slice(0, chiave.length - 10)).ok).toBe(false);
  });

  it("la firma copre anche il prefisso di versione", () => {
    const carico = caricoDi(ACQUIRENTE);
    expect(new TextDecoder().decode(daFirmare(carico))).toBe(`FLW1.${carico}`);
  });
});

// ————————————————————————————————————————————————————————————
// La verifica
// ————————————————————————————————————————————————————————————

describe("la verifica della firma", () => {
  it("accetta una licenza emessa con la chiave privata giusta", async () => {
    const esito = await verificaChiave(emetti(ACQUIRENTE), PUBBLICA);
    expect(esito.ok).toBe(true);
    if (!esito.ok) return;
    expect(esito.licenza).toEqual(ACQUIRENTE);
  });

  it("rifiuta una licenza firmata da un'altra chiave", async () => {
    const esito = await verificaChiave(emetti(ACQUIRENTE, altraPrivata), PUBBLICA);
    expect(esito.ok).toBe(false);
    if (esito.ok) return;
    expect(esito.motivo).toContain("firma non corrisponde");
    expect(esito.verificabile).toBe(true);
  });

  it("rifiuta una scadenza spostata a mano dentro il carico", async () => {
    // È il caso che conta: cambiare la data e ricomporre la chiave con la
    // stessa firma. Il carico è in chiaro, la firma no.
    const originale = emetti(ACQUIRENTE);
    const firma = originale.split(".")[2];
    const caricoTruccato = caricoDi({ ...ACQUIRENTE, scadenza: "2099-12-31" });
    const esito = await verificaChiave(`FLW1.${caricoTruccato}.${firma}`, PUBBLICA);
    expect(esito.ok).toBe(false);
  });

  it("una build senza chiave pubblica non accusa nessuno di contraffazione", async () => {
    const esito = await verificaChiave(emetti(ACQUIRENTE), "DA-GENERARE");
    expect(esito.ok).toBe(false);
    if (esito.ok) return;
    // `verificabile: false` è quello che impedisce di bloccare l'utente.
    expect(esito.verificabile).toBe(false);
    expect(esito.motivo).toContain("chiave pubblica");
  });
});

// ————————————————————————————————————————————————————————————
// Cosa può fare l'app
// ————————————————————————————————————————————————————————————

describe("lo stato della licenza", () => {
  const licenza: Licenza = { ...ACQUIRENTE, scadenza: "2026-06-30" };

  it("l'ultimo giorno di validità è ancora valido", () => {
    const stato = statoLicenza(licenza, "2026-01-01", "2026-06-30");
    expect(stato.esito).toBe("attiva");
    expect(solaLettura(stato)).toBe(false);
  });

  it("il giorno dopo l'app è in sola lettura", () => {
    const stato = statoLicenza(licenza, "2026-01-01", "2026-07-01");
    expect(stato.esito).toBe("scaduta");
    expect(solaLettura(stato)).toBe(true);
  });

  it("il preavviso comincia a quindici giorni e non prima", () => {
    const giorni = (oggi: string) => preavviso(statoLicenza(licenza, "2026-01-01", oggi));
    expect(giorni("2026-06-14")).toBeNull(); // 16 giorni
    expect(giorni("2026-06-15")).toBe(GIORNI_PREAVVISO);
    expect(giorni("2026-06-29")).toBe(1);
    expect(giorni("2026-06-30")).toBe(0);
    // Scaduta: non è più un preavviso, è un fatto.
    expect(giorni("2026-07-01")).toBeNull();
  });

  it("senza licenza vale il periodo di prova, dichiarato", () => {
    expect(fineProva("2026-01-01")).toBe("2026-01-15");
    expect(GIORNI_DI_PROVA).toBe(14);
    const dentro = statoLicenza(null, "2026-01-01", "2026-01-15");
    expect(dentro.esito).toBe("prova");
    expect(solaLettura(dentro)).toBe(false);
    const fuori = statoLicenza(null, "2026-01-01", "2026-01-16");
    expect(fuori.esito).toBe("provaScaduta");
    expect(solaLettura(fuori)).toBe(true);
  });

  it("anche la prova avvisa prima di finire", () => {
    expect(preavviso(statoLicenza(null, "2026-01-01", "2026-01-10"))).toBe(5);
  });

  it("un browser che non verifica non blocca nessuno", () => {
    const stato = statoLicenza(null, "2026-01-01", "2026-12-31");
    expect(solaLettura(stato)).toBe(true);
    // Ma quando è il browser a non poter verificare, lo stato è un altro.
    const cieco = { esito: "nonVerificabile", motivo: "niente Ed25519" } as const;
    expect(solaLettura(cieco)).toBe(false);
    expect(preavviso(cieco)).toBeNull();
  });

  it("si racconta in una riga, con le date in italiano", () => {
    expect(descrizione(statoLicenza(licenza, "2026-01-01", "2026-05-01"))).toBe(
      "Licenza attiva fino al 30 giugno 2026",
    );
    expect(descrizione(statoLicenza(licenza, "2026-01-01", "2026-07-05"))).toBe(
      "Licenza scaduta il 30 giugno 2026",
    );
  });
});

// ————————————————————————————————————————————————————————————
// Il presidio sul build
// ————————————————————————————————————————————————————————————

describe("un build di produzione non esce senza chiave pubblica", () => {
  it("in sviluppo il segnaposto passa: è il comportamento voluto", () => {
    expect(controlloChiavePubblica("DA-GENERARE", "development")).toBeNull();
    expect(controlloChiavePubblica("DA-GENERARE", "test")).toBeNull();
    expect(controlloChiavePubblica("DA-GENERARE", undefined)).toBeNull();
  });

  it("in produzione il segnaposto ferma il build, e dice cosa manca", () => {
    const messaggio = controlloChiavePubblica("DA-GENERARE", "production");
    expect(messaggio).not.toBeNull();
    // Il messaggio deve bastare da solo: cosa manca, dove, e cosa digitare.
    expect(messaggio).toContain("src/lib/licenza/chiave-pubblica.ts");
    expect(messaggio).toContain("node strumenti/licenza/genera-licenza.mjs --nuove-chiavi");
    expect(messaggio).toContain("senza nessun sintomo visibile");
  });

  it("una chiave vuota vale come segnaposto", () => {
    expect(controlloChiavePubblica("   ", "production")).not.toBeNull();
  });

  it("**una chiave vera è riconosciuta per la sua forma, non perché diversa da un segnaposto**", () => {
    // La regressione: il segnaposto era esportato accanto alla chiave come
    // `DA_CONFIGURARE`, e incollare la chiave vera *in quella costante* lasciava
    // le due uguali. Il confronto d'identità continuava a dire «segnaposto» e
    // l'app si comportava come una build senza chiave, senza un errore da
    // nessuna parte. Ora il criterio è strutturale: una chiave da 32 byte è una
    // chiave, comunque sia stato riordinato il file.
    const vera = "pzYj5cd-EvJOoIhLmdYsbdz6qMDpvOBYzsqDbYeJaWo";
    expect(chiavePubblicaConfigurata(vera)).toBe(true);
    expect(motivoChiavePubblica(vera)).toBeNull();
    expect(controlloChiavePubblica(vera, "production")).toBeNull();
  });

  it("il segnaposto, il vuoto e una chiave rotta danno motivi diversi", () => {
    expect(motivoChiavePubblica("DA-GENERARE")).toContain("segnaposto");
    expect(motivoChiavePubblica("  ")).toContain("segnaposto");
    expect(motivoChiavePubblica(PUBBLICA.slice(0, 20))).toContain("Ed25519");
    expect(motivoChiavePubblica("non una chiave!!")).toContain("caratteri non validi");
  });

  it("una chiave troncata non passa per buona", () => {
    // Il caso silenzioso: un copia-incolla a metà pubblicherebbe un'app che
    // rifiuta ogni licenza vera, e nessun test di unità se ne accorgerebbe.
    const troncata = PUBBLICA.slice(0, 20);
    const messaggio = controlloChiavePubblica(troncata, "production");
    expect(messaggio).toContain("Ed25519");
    expect(messaggio).toContain("32 byte");
  });

  it("caratteri fuori dall'alfabeto base64url non passano", () => {
    expect(controlloChiavePubblica("non una chiave!!", "production")).toContain("Ed25519");
  });

  it("una chiave vera lascia passare il build", () => {
    expect(controlloChiavePubblica(PUBBLICA, "production")).toBeNull();
  });
});

// ————————————————————————————————————————————————————————————
// Sostituire la chiave salvata
//
// Lo scenario da non far succedere mai: un cliente con la licenza in regola
// incolla la stringa sbagliata e si ritrova in sola lettura.
// ————————————————————————————————————————————————————————————

describe("una chiave nuova sostituisce quella salvata solo se non peggiora", () => {
  const OGGI = "2026-09-02";
  const attiva: Licenza = {
    email: "gabriele@esempio.it",
    scadenza: "2027-12-31",
    emessaIl: "2026-09-02",
  };

  it("**una licenza scaduta non sostituisce quella attiva**", () => {
    // Il caso vero: `--anni 0`, intestatario diverso, scadenza già passata.
    const scaduta: Licenza = {
      email: "altro@esempio.it",
      scadenza: "2026-08-20",
      emessaIl: "2025-08-20",
    };
    const esito = valutaSostituzione(scaduta, attiva, OGGI);
    expect(esito.sostituisci).toBe(false);
    if (esito.sostituisci) return;
    expect(esito.motivo).toContain("scaduta");
    expect(esito.motivo).toContain("20 agosto 2026");
    expect(esito.motivo).toContain("quella attuale resta al suo posto");
  });

  it("una licenza scaduta non entra nemmeno quando non c'è niente di salvato", () => {
    const scaduta: Licenza = { email: "x@y.it", scadenza: "2026-08-20", emessaIl: "2025-08-20" };
    const esito = valutaSostituzione(scaduta, null, OGGI);
    expect(esito.sostituisci).toBe(false);
    if (esito.sostituisci) return;
    expect(esito.motivo).toContain("ancora valida");
  });

  it("una licenza che scade prima di quella attiva viene rifiutata, e dice come procedere", () => {
    const piuCorta: Licenza = { email: "x@y.it", scadenza: "2027-06-30", emessaIl: "2026-09-02" };
    const esito = valutaSostituzione(piuCorta, attiva, OGGI);
    expect(esito.sostituisci).toBe(false);
    if (esito.sostituisci) return;
    expect(esito.motivo).toContain("30 giugno 2027");
    expect(esito.motivo).toContain("31 dicembre 2027");
    // Non un vicolo cieco: la strada per farlo lo stesso è scritta.
    expect(esito.motivo).toContain("rimuovi prima la chiave salvata");
  });

  it("un rinnovo che allunga passa", () => {
    const rinnovo: Licenza = { email: attiva.email, scadenza: "2028-12-31", emessaIl: "2027-11-01" };
    expect(valutaSostituzione(rinnovo, attiva, OGGI).sostituisci).toBe(true);
  });

  it("reincollare la stessa licenza non è un peggioramento", () => {
    expect(valutaSostituzione(attiva, attiva, OGGI).sostituisci).toBe(true);
  });

  it("con la stessa scadenza si può correggere l'intestatario", () => {
    const stessoGiorno: Licenza = { ...attiva, email: "nuova@esempio.it" };
    expect(valutaSostituzione(stessoGiorno, attiva, OGGI).sostituisci).toBe(true);
  });

  it("l'ultimo giorno di validità una licenza è ancora buona", () => {
    const oggiScade: Licenza = { email: "x@y.it", scadenza: OGGI, emessaIl: "2025-09-02" };
    expect(valutaSostituzione(oggiScade, null, OGGI).sostituisci).toBe(true);
  });

  it("quando quella salvata è già scaduta, una valida entra comunque", () => {
    const vecchiaScaduta: Licenza = { ...attiva, scadenza: "2026-01-31" };
    const nuova: Licenza = { email: "x@y.it", scadenza: "2026-12-31", emessaIl: OGGI };
    expect(valutaSostituzione(nuova, vecchiaScaduta, OGGI).sostituisci).toBe(true);
  });

  it("la prima licenza su un'app senza niente di salvato entra", () => {
    expect(valutaSostituzione(attiva, null, OGGI).sostituisci).toBe(true);
  });
});
