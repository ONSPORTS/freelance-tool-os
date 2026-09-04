/**
 * Il pianificatore inverso: dal netto che vuoi in tasca al fatturato che serve,
 * poi ai clienti, poi ai contatti da coltivare ogni mese.
 *
 * È la parte del prodotto che guarda avanti invece che indietro, e l'unico
 * numero che conta davvero è l'ultimo: quanti contatti al mese.
 */
import { nonNegativo, rapporto, round2, somma } from "@/lib/fisco/aritmetica";
import { annoDi } from "@/lib/fisco/documenti";
import type { CostoCalcolato, NaturaCosto } from "@/lib/fisco/tipi";

/**
 * I costi già registrati in un anno, tutti o della sola natura richiesta.
 *
 * Serve a proporre un numero invece di chiederlo al buio: chi ha già inserito
 * canoni, abbonamenti e commercialista ha la risposta in archivio, e ricopiarla
 * a mano è un modo di sbagliarla. Conta il costo netto — il totale meno l'IVA
 * detraibile — perché è quello che esce davvero dal conto: in forfettario, dove
 * l'IVA non si detrae, coincide col totale.
 */
export function costiRegistrati(
  costi: readonly CostoCalcolato[],
  anno: number,
  natura?: NaturaCosto,
): { totale: number; quanti: number } {
  const scelti = costi.filter(
    (c) => annoDi(c.dataDocumento) === anno && (natura === undefined || c.natura === natura),
  );
  return { totale: round2(somma(...scelti.map((c) => c.costoNetto))), quanti: scelti.length };
}

export type IngressoPianificazione = {
  nettoDesiderato: number;
  costiPrevisti: number;
  /** Frazione di pressione fiscale e contributiva attesa. */
  pressione: number;
  ticketMedio: number;
  tassoChiusura: number;
  tassoConversione: number;
  oreFatturabiliAnno: number;
  oreFatturabiliGiorno: number;
  tariffaOraria: number;
  costiFissiAnnui: number;
};

export type Pianificazione = {
  fatturatoNecessario: number;
  fatturatoMensile: number;
  clientiNecessari: number;
  proposteNecessarie: number;
  contattiNecessari: number;
  contattiAlMese: number;

  tariffaMinima: number;
  tariffaGiornalieraMinima: number;
  fatturatoPotenziale: number;
  saturazioneNecessaria: number;
  tariffaSufficiente: boolean;

  pareggioFatturato: number;
  pareggioMensile: number;
  pareggioOre: number;
  pareggioGiorni: number;
};

/** Il fatturato che serve per portare a casa il netto voluto. */
export function calcolaPianificazione(ing: IngressoPianificazione): Pianificazione {
  // La pressione non può arrivare a 1: dividerebbe per zero e prometterebbe
  // l'infinito. Il limite tiene il calcolo dentro il ragionevole.
  const quotaNetta = Math.max(0.01, 1 - Math.min(ing.pressione, 0.99));
  const fatturatoNecessario = round2((ing.nettoDesiderato + ing.costiPrevisti) / quotaNetta);

  const clientiNecessari =
    ing.ticketMedio > 0 ? Math.ceil(fatturatoNecessario / ing.ticketMedio) : 0;
  const proposteNecessarie =
    ing.tassoChiusura > 0 ? Math.ceil(clientiNecessari / ing.tassoChiusura) : 0;
  const contattiNecessari =
    ing.tassoConversione > 0 ? Math.ceil(proposteNecessarie / ing.tassoConversione) : 0;

  // La tariffa oraria si arrotonda per essere letta, ma quella giornaliera si
  // ricava dal valore pieno: incatenare arrotondamenti fa scivolare i numeri.
  const tariffaMinimaPiena = rapporto(fatturatoNecessario, ing.oreFatturabiliAnno);
  const tariffaMinima = round2(tariffaMinimaPiena);
  const fatturatoPotenziale = round2(ing.tariffaOraria * ing.oreFatturabiliAnno);
  const saturazione = rapporto(fatturatoNecessario, fatturatoPotenziale);

  const pareggio = calcolaPareggio({
    costiFissiAnnui: ing.costiFissiAnnui,
    pressione: ing.pressione,
    tariffaOraria: ing.tariffaOraria,
    oreFatturabiliGiorno: ing.oreFatturabiliGiorno,
  });

  return {
    fatturatoNecessario,
    fatturatoMensile: round2(fatturatoNecessario / 12),
    clientiNecessari,
    proposteNecessarie,
    contattiNecessari,
    contattiAlMese: Math.ceil(contattiNecessari / 12),

    tariffaMinima,
    tariffaGiornalieraMinima: round2(tariffaMinimaPiena * ing.oreFatturabiliGiorno),
    fatturatoPotenziale,
    saturazioneNecessaria: saturazione,
    tariffaSufficiente: saturazione > 0 && saturazione <= 1,

    pareggioFatturato: pareggio.fatturato,
    pareggioMensile: pareggio.mensile,
    pareggioOre: pareggio.ore ?? 0,
    pareggioGiorni: pareggio.giorni ?? 0,
  };
}

export type Pareggio = {
  fatturato: number;
  mensile: number;
  /** `null` senza una tariffa dichiarata: le ore non si ricavano da niente. */
  ore: number | null;
  giorni: number | null;
};

/**
 * Il fatturato sotto il quale si lavora in perdita.
 *
 * Vive fuori dalla pianificazione perché non ha bisogno di un obiettivo: i
 * costi fissi e la pressione bastano. Chi non ha ancora deciso quanto vuole
 * guadagnare può comunque sapere da dove comincia a guadagnare.
 */
export function calcolaPareggio(ing: {
  costiFissiAnnui: number;
  pressione: number;
  tariffaOraria: number | null;
  oreFatturabiliGiorno: number;
}): Pareggio {
  const quotaNetta = Math.max(0.01, 1 - Math.min(ing.pressione, 0.99));
  const fatturato = round2(ing.costiFissiAnnui / quotaNetta);
  const ore =
    ing.tariffaOraria && ing.tariffaOraria > 0
      ? round2(rapporto(fatturato, ing.tariffaOraria))
      : null;
  return {
    fatturato,
    mensile: round2(fatturato / 12),
    ore,
    giorni: ore === null ? null : round2(rapporto(ore, ing.oreFatturabiliGiorno)),
  };
}

/**
 * Lo stato patrimoniale: quello che possiedi meno quello che devi.
 * Le voci collegate arrivano dagli altri fogli, quelle libere le scrive
 * l'utente.
 */
export type VoceCalcolata = {
  id: string;
  descrizione: string;
  valore: number;
  /** Ricavata dagli altri dati: non si modifica a mano. */
  derivata: boolean;
  nota?: string;
};

export type StatoPatrimoniale = {
  attivo: VoceCalcolata[];
  passivo: VoceCalcolata[];
  totaleAttivo: number;
  totalePassivo: number;
  patrimonioNetto: number;
  patrimonioNettoLiquido: number;
  tasseAccantonate: number;
  incidenzaDebiti: number;
  indiceLiquidita: number | null;
};

export function calcolaPatrimonio(ing: {
  liquiditaAttivita: number;
  liquiditaPersonale: number;
  creditiClienti: number;
  creditoIva: number;
  tasseAccantonate: number;
  debitiFornitori: number;
  debitoIva: number;
  debitoImposte: number;
  vociLibere: { id: string; tipo: "attivo" | "passivo"; categoria: string; descrizione: string; valore: number }[];
}): StatoPatrimoniale {
  const derivateAttive: VoceCalcolata[] = [
    { id: "cassa-attivita", descrizione: "Liquidità del conto attività", valore: ing.liquiditaAttivita, derivata: true },
    { id: "cassa-personale", descrizione: "Liquidità del conto personale", valore: ing.liquiditaPersonale, derivata: true },
    {
      id: "crediti",
      descrizione: "Crediti verso clienti",
      valore: ing.creditiClienti,
      derivata: true,
      nota: "Fatture emesse e non ancora incassate.",
    },
    { id: "credito-iva", descrizione: "Credito IVA", valore: ing.creditoIva, derivata: true },
  ];
  const derivatePassive: VoceCalcolata[] = [
    {
      id: "fornitori",
      descrizione: "Debiti verso fornitori",
      valore: ing.debitiFornitori,
      derivata: true,
      nota: "Costi registrati e non ancora pagati.",
    },
    { id: "debito-iva", descrizione: "Debito IVA maturato", valore: ing.debitoIva, derivata: true },
    {
      id: "debito-imposte",
      descrizione: "Debito per imposte e contributi",
      valore: ing.debitoImposte,
      derivata: true,
      nota: "Maturato verso erario e INPS, al netto di quanto già versato.",
    },
  ];

  const libereAttive = ing.vociLibere
    .filter((v) => v.tipo === "attivo")
    .map((v) => ({ id: v.id, descrizione: v.descrizione || v.categoria, valore: v.valore, derivata: false }));
  const liberePassive = ing.vociLibere
    .filter((v) => v.tipo === "passivo")
    .map((v) => ({ id: v.id, descrizione: v.descrizione || v.categoria, valore: v.valore, derivata: false }));

  const attivo = [...derivateAttive, ...libereAttive].filter((v) => v.valore !== 0 || v.derivata);
  const passivo = [...derivatePassive, ...liberePassive].filter((v) => v.valore !== 0 || v.derivata);

  const totaleAttivo = round2(attivo.reduce((a, v) => a + v.valore, 0));
  const totalePassivo = round2(passivo.reduce((a, v) => a + v.valore, 0));
  const liquido = round2(
    ing.liquiditaAttivita + ing.liquiditaPersonale + ing.creditiClienti + ing.creditoIva - totalePassivo,
  );
  const debitiABreve = ing.debitiFornitori + ing.debitoIva + ing.debitoImposte;

  return {
    attivo,
    passivo,
    totaleAttivo,
    totalePassivo,
    patrimonioNetto: round2(totaleAttivo - totalePassivo),
    patrimonioNettoLiquido: liquido,
    tasseAccantonate: ing.tasseAccantonate,
    incidenzaDebiti: rapporto(totalePassivo, totaleAttivo),
    indiceLiquidita:
      debitiABreve > 0
        ? round2(
            rapporto(
              nonNegativo(ing.liquiditaAttivita + ing.liquiditaPersonale + ing.creditoIva),
              debitiABreve,
            ),
          )
        : null,
  };
}
