/**
 * La chiave pubblica con cui si verificano le licenze.
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  QUI SI MODIFICA UNA COSA SOLA: la stringa qui sotto.                │
 * │  Incolla la riga stampata da                                         │
 * │      node strumenti/licenza/genera-licenza.mjs --nuove-chiavi        │
 * │  Non aggiungere altre costanti: la chiave è questa e basta.          │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * Pubblica per costruzione: sta in un file JavaScript scaricato dal browser di
 * chiunque, e va bene così. Con questa si verifica soltanto; le licenze le
 * firma la chiave privata, che vive fuori da questo repository (vedi
 * `strumenti/licenza/`).
 *
 * `"DA-GENERARE"` è il valore di una build che una chiave non ce l'ha ancora:
 * l'app lo dichiara e non blocca nessuno, ma `next build` in produzione si
 * ferma. Chi decide se la chiave c'è è `chiavePubblicaConfigurata()` in
 * `presidio.ts`, e lo decide guardando *la forma della chiave* — 32 byte in
 * base64url — non un confronto con un segnaposto. Così qualunque chiave vera
 * messa qui viene riconosciuta, comunque si sia riordinato il file.
 *
 * Sostituire la chiave un domani invalida tutte le licenze già emesse: vanno
 * riemesse.
 */
export const CHIAVE_PUBBLICA: string = "pzYj5cd-EvJOoIhLmdYsbdz6qMDpvOBYzsqDbYeJaWo";
