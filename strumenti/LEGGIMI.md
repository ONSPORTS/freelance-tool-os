# Strumenti

Cose che non fanno parte dell'app e servono a chi la sviluppa o la vende.
Nessuna di queste gira nel browser dell'utente e nessuna finisce nel bundle.

| Strumento | A cosa serve |
|---|---|
| `misura-responsive.mjs` | Misura ogni schermata alle larghezze vere dei telefoni |
| `diagnosi-chiave.mjs` | Dice cosa vede l'app quando cerca la chiave pubblica della licenza |
| `diagnosi-riporti.js` | Rifà, nel browser dell'utente, i due conteggi che devono coincidere fra registro Fatture e chiusura d'anno |
| `licenza/` | Generazione delle chiavi di licenza — resta fuori dal repository pubblico, vedi il suo LEGGIMI |

---

## `misura-responsive.mjs`

```sh
npm run dev                  # in un terminale
npm run misura:responsive    # in un altro
```

Apre ogni schermata a 320, 375, 390 e 430 px — le larghezze vere degli iPhone,
dal SE al Pro Max — e cerca due cose che a occhio non si vedono e che si
rompono di nuovo ogni volta che una schermata cresce di un pulsante.

**Lo sfondamento orizzontale.** Quando qualcosa è più largo della finestra la
pagina scorre di lato, e su un telefono uno scorrimento orizzontale
involontario si sente come un difetto anche quando non si capisce cosa l'ha
causato. Lo strumento non dice solo «sfonda»: nomina l'elemento più profondo
che esce, con le sue classi e il suo testo, così è riconoscibile nel codice.

```
Sfondamenti (1):
  320px /dati → 331px
      <a class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounde"> «Da CSV» arriva a 331px
```

**Le aree di tocco sotto i 32 px.** Sotto quella misura il pollice manca il
bersaglio e colpisce quello che c'è sotto. Chi sta dentro un'etichetta si preme
dall'etichetta, e l'area vera è quella: il quadratino della spunta può restare
piccolo se la riga intera è premibile.

L'unico caso in cui una misura piccola è la scelta giusta è il link dentro una
frase: è alto quanto la riga di testo, e allargarlo spezzerebbe il paragrafo.
Quelli restano nell'elenco e si ignorano a ragion veduta.

Esce con codice 1 se c'è almeno uno sfondamento, così si può mettere in un
controllo automatico.

### Opzioni

```sh
node strumenti/misura-responsive.mjs \
  --url=http://localhost:3000 \
  --larghezze=320,375,390,430 \
  --rotte=/fatture,/costi \
  --json=misure.json \
  --profilo=/tmp/flowlance-misura \
  --chromium=/percorso/al/binario
```

`--rotte` accorcia il giro quando si sta lavorando su una schermata sola;
`--json` scrive il dettaglio completo, elemento per elemento.

### Due cose da sapere

**Serve un archivio con dentro qualcosa.** Una tabella vuota non misura niente:
le colonne che sfondano compaiono quando ci sono le righe. Il profilo del
browser è persistente — la prima volta apri `Dati e backup`, carica il dataset
dimostrativo, e da lì in poi lo strumento se lo ritrova. Vale la pena rifare il
giro anche in regime ordinario, dove le colonne sono di più.

**Non usa il Playwright completo.** Dipende da `playwright-core`, che non
scarica nessun browser: apre il Chrome già installato. Se sul tuo computer non
c'è, o se lo lanci su un runner, passa il binario con `--chromium=`.

### Quello che non misura

Va guardato a occhio, e sono le cose che l'ultima passata ha trovato così:
quanta testata resta prima del contenuto, se un modulo più alto dello schermo
si scorre fino al pulsante che lo chiude, se un testo troncato dice ancora
qualcosa.

---

## `diagnosi-riporti.js`

Non si lancia da terminale: si incolla nella console del browser, con l'app
aperta. Rifà i due conteggi delle fatture da incassare — quello del registro e
quello della chiusura d'anno — sull'archivio vero, e stampa solo anni e numeri:
niente nomi di clienti, niente descrizioni. Serve quando le due schermate danno
risultati diversi sullo stesso anno e la differenza non si riproduce altrove.

Le istruzioni per l'utente stanno in testa al file stesso.

---

## `diagnosi-chiave.mjs`

```sh
npm run licenza:stato
```

Stampa cosa vede l'app quando cerca la chiave pubblica: ogni costante del file,
la lunghezza in byte una volta decodificata, il verdetto. Serve quando l'app
dice di non avere una chiave e il file sembra a posto.
