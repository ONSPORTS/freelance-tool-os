/**
 * La chiave pubblica con cui si verificano le licenze.
 *
 * Pubblica per costruzione: sta in un file JavaScript scaricato dal browser di
 * chiunque, e va bene così. Con questa si verifica soltanto; le licenze le
 * firma la chiave privata, che vive fuori da questo repository (vedi
 * `strumenti/licenza/`).
 *
 * Se un giorno la chiave privata dovesse essere sostituita, qui cambia una
 * riga e le licenze già emesse smettono di essere valide: vanno riemesse.
 */
/**
 * Il segnaposto di una build che non ha ancora una chiave.
 *
 * Riconoscerlo serve a dare un messaggio onesto — «questa build non verifica
 * licenze» — invece di rifiutare ogni chiave come se fosse contraffatta. Una
 * build così non blocca nessuno: vedi `nonVerificabile` in `stato.ts`.
 */
export const DA_CONFIGURARE = "DA-GENERARE";

export const CHIAVE_PUBBLICA: string = DA_CONFIGURARE;
