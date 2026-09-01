/**
 * Elenchi di riferimento per i menu. Sono modificabili dall'utente aggiungendo
 * una categoria nuova a un costo: quella scritta a mano entra automaticamente
 * nell'elenco dei filtri.
 */
export const CATEGORIE_COSTO = [
  "Consulenze e collaborazioni",
  "Software e abbonamenti",
  "Pubblicità e advertising",
  "Formazione",
  "Viaggi e trasferte",
  "Auto e carburante",
  "Telefonia e connettività",
  "Affitto e utenze ufficio",
  "Attrezzature e hardware",
  "Commercialista e consulenze",
  "Banca e commissioni",
  "Assicurazioni",
  "Rappresentanza e ristoranti",
  "Marketing e contenuti",
  "Altro",
] as const;

export const CATEGORIE_SPESA_PERSONALE = [
  "Casa (mutuo o affitto)",
  "Utenze",
  "Spesa e alimentari",
  "Trasporti",
  "Salute",
  "Famiglia e figli",
  "Tempo libero",
  "Assicurazioni personali",
  "Formazione personale",
  "Altro",
] as const;

export const CANALI_ACQUISIZIONE = [
  "Passaparola",
  "Sito web",
  "LinkedIn",
  "Rete professionale",
  "Bando",
  "Fiera o evento",
  "Pubblicità",
  "Altro",
] as const;
