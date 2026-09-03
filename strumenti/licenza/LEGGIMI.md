# Emettere le licenze di Flowlance

Questa cartella contiene lo strumento con cui si firmano le licenze. **Tienila
fuori dal repository pubblico** insieme alla chiave privata: lo script non è un
segreto — l'algoritmo è standard, e la verifica lato client si aggira comunque —
ma la chiave privata sì. Con quella chiunque emette licenze valide.

`chiavi/` è già in `.gitignore`: la chiave privata non finisce in un commit
neanche per sbaglio. Se preferisci, sposta l'intera cartella `strumenti/` fuori
dal progetto: allo script non serve nient'altro che Node.

## La prima volta

```
node strumenti/licenza/genera-licenza.mjs --nuove-chiavi
```

Crea la coppia Ed25519, scrive la privata in `chiavi/privata.pem` e stampa la
pubblica. **Incolla la pubblica in `src/lib/licenza/chiave-pubblica.ts`,
sostituendo la stringa di `CHIAVE_PUBBLICA`** — quel file esporta quella sola
costante, ed è l'unica cosa da toccare.

Se qualcosa non torna — l'app dice di non avere una chiave e il file sembra a
posto — `npm run licenza:stato` mostra cosa legge davvero l'app: il valore, la
lunghezza in byte, il verdetto e le righe di codice del file.

Finché lì c'è il segnaposto `DA-GENERARE`, `next dev` funziona e l'app dichiara
di non poter verificare nessuna licenza, senza bloccare nessuno — comodo mentre
si sviluppa. **`next build` invece si ferma**, e dice cosa manca: un'app di
produzione senza chiave pubblica uscirebbe senza alcun controllo di licenza e
senza un sintomo che lo faccia notare. Il controllo sta in `next.config.ts`, che
ogni `next build` legge comunque lo si invochi, e scarta anche una chiave
incollata a metà.

Si fa una volta sola. Rigenerare la coppia invalida tutte le licenze già
emesse, che andrebbero riemesse una per una.

**La chiave privata va salvata dove non si perde** (un password manager va
bene). Perderla significa non poter più emettere licenze per i clienti che
hai già: dovresti generare una coppia nuova, aggiornare l'app e riemettere
tutto.

## Dopo ogni acquisto

```
node strumenti/licenza/genera-licenza.mjs cliente@esempio.it --anni 1
node strumenti/licenza/genera-licenza.mjs cliente@esempio.it --mesi 6
node strumenti/licenza/genera-licenza.mjs cliente@esempio.it 2027-09-30
```

Stampa la chiave da incollare nella risposta all'acquirente. Ogni emissione
viene annotata in `chiavi/emesse.jsonl`, una riga per licenza: serve a
ritrovare una chiave quando un cliente la perde, e a sapere quando scade.

L'acquirente la incolla in **Impostazioni › Licenza**.

## Rinnovi

Un rinnovo è una licenza nuova con la stessa email e una scadenza più in là.
Non c'è niente da revocare: la vecchia scade da sola, e incollare la nuova
sostituisce quella salvata.

## Cosa succede all'acquirente

- La verifica avviene nel suo browser, con Web Crypto. Nessuna richiesta di
  rete, nessun dato che esce dal dispositivo.
- Dagli ultimi 15 giorni compare un avviso discreto in testa all'app.
- Dal giorno dopo la scadenza l'app è in **sola lettura**: si consulta tutto,
  non si inserisce più niente.
- **L'esportazione del backup funziona sempre**, anche a licenza scaduta.
- Senza nessuna chiave valgono 14 giorni di prova dal primo avvio
  (`GIORNI_DI_PROVA` in `src/lib/licenza/stato.ts`; a 0 l'app parte già in sola
  lettura).
