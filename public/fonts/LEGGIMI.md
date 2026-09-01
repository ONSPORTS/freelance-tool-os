# Font

## Inter e Plus Jakarta Sans — già inclusi

Arrivano da npm (`@fontsource-variable/*`) e vengono serviti dal progetto stesso:
niente CDN, niente richieste esterne. È una scelta voluta — l'app è local-first e
deve restare leggibile anche offline, e un font caricato da rete significa numeri
che non si incolonnano proprio quando servono.

## Satoshi — opzionale, due passi

Satoshi (Fontshare) è la faccia display prevista dalla direzione visiva. Non è
distribuita su npm e non è ridistribuibile da qui, quindi va aggiunta a mano:

1. Scarica il file variabile da <https://www.fontshare.com/fonts/satoshi>
   e salvalo come `public/fonts/Satoshi-Variable.woff2`.
2. In `src/app/globals.css` togli il commento al blocco `@font-face` di Satoshi.

Da quel momento subentra automaticamente: è già la prima voce dello stack
`--font-display`, con Plus Jakarta Sans come sostituto. Le due facce hanno la
stessa indole geometrica e le stesse cifre tabellari, quindi il passaggio non
sposta la spaziatura delle colonne di importi.

La licenza di Satoshi (ITF Free Font License) consente l'uso commerciale e
l'auto-hosting.
