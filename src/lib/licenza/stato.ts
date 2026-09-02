/**
 * Che cosa può fare l'app, dato lo stato della licenza.
 *
 * Modulo puro: nessuna crittografia, nessun orologio: la data di oggi si passa
 * come argomento. Le regole stanno qui e non sparse nell'interfaccia, così
 * «cosa succede alla scadenza» è una domanda a cui risponde un file solo.
 *
 * La regola che conta: alla scadenza l'app diventa in sola lettura — si vede
 * tutto, non si scrive niente — **tranne l'esportazione dei dati, che resta
 * sempre attiva**. I dati dell'utente non sono mai in ostaggio della licenza.
 */
import { dataEstesa } from "@/lib/format";
import { giorniTra } from "@/lib/fisco/documenti";
import type { Licenza } from "./chiave";

/** Da quanti giorni prima della scadenza si avvisa. Discreto, non invadente. */
export const GIORNI_PREAVVISO = 15;

/**
 * Quanto dura la prova prima di inserire una chiave.
 *
 * Senza licenza l'app deve pur comportarsi in qualche modo: qui la scelta è un
 * periodo di prova dichiarato, che parte al primo avvio. Portarlo a 0 rende
 * l'app in sola lettura finché non si incolla una chiave — è una costante, non
 * una riscrittura.
 */
export const GIORNI_DI_PROVA = 14;

export type StatoLicenza =
  | { esito: "prova"; scadenza: string; giorniResidui: number }
  | { esito: "provaScaduta"; scadenza: string }
  | { esito: "attiva"; licenza: Licenza; giorniResidui: number }
  | { esito: "scaduta"; licenza: Licenza; giorniDallaScadenza: number }
  /**
   * Il browser non sa verificare Ed25519. Non è colpa di chi ha comprato:
   * l'app resta scrivibile e lo dichiara. Un controllo lato client si aggira
   * comunque; punire l'utente per un browser vecchio sarebbe solo un danno.
   */
  | { esito: "nonVerificabile"; motivo: string };

/**
 * Lo stato effettivo.
 *
 * @param licenza la licenza già verificata, o `null` se non ce n'è una valida.
 * @param inizioProva data ISO del primo avvio.
 */
export function statoLicenza(
  licenza: Licenza | null,
  inizioProva: string,
  oggi: string,
): StatoLicenza {
  if (licenza) {
    // La scadenza è inclusa: chi ha una licenza al 31 dicembre scrive anche il
    // 31 dicembre.
    const residui = giorniTra(oggi, licenza.scadenza);
    if (residui >= 0) return { esito: "attiva", licenza, giorniResidui: residui };
    return { esito: "scaduta", licenza, giorniDallaScadenza: -residui };
  }

  const scadenzaProva = fineProva(inizioProva);
  const residui = giorniTra(oggi, scadenzaProva);
  if (residui >= 0) return { esito: "prova", scadenza: scadenzaProva, giorniResidui: residui };
  return { esito: "provaScaduta", scadenza: scadenzaProva };
}

export function fineProva(inizioProva: string): string {
  const inizio = new Date(`${inizioProva.slice(0, 10)}T00:00:00Z`);
  inizio.setUTCDate(inizio.getUTCDate() + GIORNI_DI_PROVA);
  return inizio.toISOString().slice(0, 10);
}

/**
 * L'app è in sola lettura?
 *
 * Vale per ogni scrittura nell'archivio. Non vale — mai — per l'esportazione:
 * quella non passa di qui perché è una lettura, e resta possibile in ogni
 * stato.
 */
export function solaLettura(stato: StatoLicenza): boolean {
  return stato.esito === "scaduta" || stato.esito === "provaScaduta";
}

/**
 * I giorni che mancano, quando è il momento di dirlo. `null` il resto del tempo.
 *
 * Il preavviso comincia a {@link GIORNI_PREAVVISO} giorni e vale sia per la
 * licenza sia per la prova: in entrambi i casi c'è qualcosa da fare prima di
 * quella data.
 */
export function preavviso(stato: StatoLicenza): number | null {
  if (stato.esito !== "attiva" && stato.esito !== "prova") return null;
  return stato.giorniResidui <= GIORNI_PREAVVISO ? stato.giorniResidui : null;
}

/** Una riga sola, per la barra in testa e per la schermata della licenza. */
export function descrizione(stato: StatoLicenza): string {
  switch (stato.esito) {
    case "attiva":
      return `Licenza attiva fino al ${dataEstesa(stato.licenza.scadenza)}`;
    case "scaduta":
      return `Licenza scaduta il ${dataEstesa(stato.licenza.scadenza)}`;
    case "prova":
      return `Periodo di prova fino al ${dataEstesa(stato.scadenza)}`;
    case "provaScaduta":
      return `Periodo di prova finito il ${dataEstesa(stato.scadenza)}`;
    case "nonVerificabile":
      // Neutra apposta: le cause sono due — un browser senza Ed25519 e una
      // build senza chiave pubblica — e il motivo, che le distingue, sta
      // scritto sotto.
      return "Licenza non verificabile";
  }
}

/**
 * `giorni` in parole. La barra dice «ancora 3 giorni», non «3».
 *
 * Zero giorni non è «fra 0 giorni»: è oggi, ed è l'ultimo in cui si scrive.
 */
export function giorniInParole(giorni: number): string {
  if (giorni === 0) return "scade oggi";
  if (giorni === 1) return "scade domani";
  return `scade fra ${giorni} giorni`;
}
