/**
 * Diagnosi del riporto «fatture emesse e non ancora incassate».
 *
 * Serve quando il registro Fatture e la chiusura d'anno danno due numeri
 * diversi sullo stesso anno. I due conteggi partono dallo stesso elenco di
 * fatture ma lo interrogano in modo diverso — il registro con un confronto fra
 * stringhe di date, la chiusura con l'anno estratto dalla data — e questo
 * script li rifà entrambi, riga per riga, sull'archivio vero.
 *
 * Come si usa: apri l'app, apri la console del browser (⌥⌘I su Mac, scheda
 * «Console»), incolla tutto il contenuto di questo file e premi invio.
 *
 * Cosa stampa: solo numeri, anni e conteggi. Nessun nome di cliente, nessuna
 * descrizione, nessun importo per singola fattura: quello che esce è
 * incollabile in una segnalazione senza spedire i propri dati a nessuno.
 */
(async () => {
  const NOME_DB = "freelance-finance-os";

  const apri = () =>
    new Promise((ok, ko) => {
      const r = indexedDB.open(NOME_DB);
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    });

  const tutto = (db, tabella) =>
    new Promise((ok, ko) => {
      if (!db.objectStoreNames.contains(tabella)) return ok([]);
      const r = db.transaction(tabella).objectStore(tabella).getAll();
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    });

  const db = await apri();
  const fatture = await tutto(db, "fatture");
  const costi = await tutto(db, "costi");

  // L'anno su cui sono puntate le schermate: sta nelle preferenze, non
  // nell'archivio. Il tipo conta quanto il valore — un anno arrivato in
  // localStorage come stringa passa il filtro del registro e non passa quello
  // della chiusura, ed è esattamente il modo di vedere due numeri diversi.
  let periodo = null;
  try {
    periodo = JSON.parse(localStorage.getItem("ffos-preferenze") ?? "null")?.state?.periodo ?? null;
  } catch {
    periodo = "illeggibile";
  }
  const anno = typeof periodo?.anno === "number" ? periodo.anno : Number(periodo?.anno);

  console.log("PERIODO SELEZIONATO", {
    periodo,
    tipoDelValoreAnno: typeof periodo?.anno,
    // Se questo è false, il difetto è qui: la chiusura confronta l'anno con
    // ===, e "2026" non è 2026.
    annoEUnNumero: typeof periodo?.anno === "number",
  });

  const annoDi = (iso) => Number(String(iso).slice(0, 4));
  const dentro = (iso) => {
    const g = String(iso).slice(0, 10);
    return g >= `${anno}-01-01` && g <= `${anno}-12-31`;
  };

  // I due conteggi, uno accanto all'altro.
  const registro = fatture.filter((f) => dentro(f.dataEmissione) && !f.dataIncasso);
  const chiusura = fatture.filter(
    (f) => annoDi(f.dataEmissione) === anno && !f.dataIncasso,
  );
  const versoDopo = fatture.filter(
    (f) => annoDi(f.dataEmissione) === anno && f.dataIncasso && annoDi(f.dataIncasso) > anno,
  );

  console.log("FATTURE", {
    inArchivio: fatture.length,
    anniDiEmissione: [...new Set(fatture.map((f) => annoDi(f.dataEmissione)))].sort(),
    senzaDataIncasso: fatture.filter((f) => !f.dataIncasso).length,
    // Questi due devono coincidere. Se non coincidono, la riga qui sotto dice
    // quali fatture li separano.
    contateDalRegistro: registro.length,
    contateDallaChiusura: chiusura.length + versoDopo.length,
  });

  const discordanti = fatture.filter(
    (f) => dentro(f.dataEmissione) !== (annoDi(f.dataEmissione) === anno),
  );
  if (discordanti.length) {
    console.log(
      "FATTURE SU CUI I DUE FILTRI NON SONO D'ACCORDO",
      discordanti.map((f) => ({
        emissione: f.dataEmissione,
        lunghezza: String(f.dataEmissione).length,
        tipo: typeof f.dataEmissione,
        annoEstratto: annoDi(f.dataEmissione),
      })),
    );
  }

  // Le date di incasso non vuote ma non leggibili: una fattura così sparisce
  // da tutt'e due i conteggi senza che nessuno segnali niente.
  const incassiStrani = fatture
    .filter((f) => f.dataIncasso && !Number.isInteger(annoDi(f.dataIncasso)))
    .map((f) => ({ incasso: f.dataIncasso, tipo: typeof f.dataIncasso }));
  if (incassiStrani.length) console.log("DATE DI INCASSO ILLEGGIBILI", incassiStrani);

  console.log("COSTI", {
    inArchivio: costi.length,
    anniDiDocumento: [...new Set(costi.map((c) => annoDi(c.dataDocumento)))].sort(),
    senzaDataPagamento: costi.filter((c) => !c.dataPagamento).length,
    nonPagatiDellAnno: costi.filter(
      (c) => annoDi(c.dataDocumento) === anno && !c.dataPagamento,
    ).length,
    // Anche questi stanno nel riporto: documento dell'anno, pagamento dopo.
    pagatiInUnAnnoSuccessivo: costi.filter(
      (c) =>
        annoDi(c.dataDocumento) === anno && c.dataPagamento && annoDi(c.dataPagamento) > anno,
    ).length,
  });

  db.close();
})();
