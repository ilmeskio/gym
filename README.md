# gym

Un'app React Native (Expo) che guida l'allenamento sulla propria scheda: suggerisce il giorno
che tocca, presenta gli esercizi uno alla volta con la dimostrazione animata, registra carico e
ripetizioni di ogni serie, chiude con un feedback e tiene lo storico. Ogni utente ha le sue
schede, scritte da Claude attraverso il server MCP dell'app, anche a partire dal file Excel del
personal trainer. Primo rilascio: web statico su GitHub Pages, dati su Supabase.

## Struttura

```
apps/app/           app Expo (React Native + React Native Web)
  src/data/         login Supabase, chiamate all'API, stato condiviso dell'app
  src/screens/      schermate; src/components/ componenti condivisi
packages/api/       API Hono: rotte, controlli, server MCP, adattatore Supabase
packages/log/       allenamenti, serie, RM, preferenze e schede: stato locale e coda di invio
packages/plan/      modello della scheda, lettura delle prescrizioni, sequenza della sessione
  data/example.json la scheda d'esempio della demo
  scripts/          import da un Excel nel formato del trainer
supabase/           configurazione del progetto, migrazioni dello schema
  functions/api/    l'API pubblicata come Edge Function
```

## Comandi

```sh
pnpm install
pnpm dev                                  # app nel browser
pnpm test                                 # test dei pacchetti plan, log, api e dell'app
pnpm typecheck
pnpm import-plan <scheda.xlsx> <out.json> # Excel del trainer -> JSON di una scheda
pnpm build:web                            # export statico in apps/app/dist
```

## Schede e server MCP

Le schede si creano con un assistente collegato al server MCP dell'app,
`https://dfrwksgqjykqkkxrjrct.supabase.co/functions/v1/api/mcp` (in Claude: Connettori ›
connettore personalizzato; in Claude Code: `claude mcp add --transport http gym <url>`).
L'app mostra queste istruzioni a chi non ha ancora una scheda.

- Accesso: OAuth 2.1 con il server OAuth di Supabase Auth e registrazione dinamica dei client.
  L'MCP risponde 401 con l'indirizzo dei suoi metadati (`/.well-known/oauth-protected-resource`);
  il consenso è una schermata dell'app, su `/gym/oauth/consent`. Supabase accetta il consenso
  solo dall'origine del sito, quindi si prova solo sull'app pubblicata.
- Strumenti: `list_plans`, `get_plan`, `create_plan`, `update_plan`, `activate_plan`,
  `find_exercise_media` (GIF di ExerciseDB e foto di free-exercise-db per nome inglese),
  `excel_upload_link` (link firmato per caricare il file Excel originale, per esempio con curl).
- Una scheda nuova diventa quella attiva; le vecchie restano, e ogni allenamento ricorda la sua.
  `create_plan` e `update_plan` rifiutano le schede che l'app non può seguire (id ripetuti,
  più settimane del dovuto) e avvisano delle prescrizioni che l'app legge solo come note.
- La demo usa la scheda d'esempio dentro l'app, con un id fisso; il server MCP e i file Excel
  non sono per la demo.

## Dimostrazioni degli esercizi

Ogni esercizio della scheda porta le sue dimostrazioni nel campo `media`. L'app mostra, in
ordine di precedenza:

1. il video YouTube incollato dall'app stessa (salvato nelle preferenze);
2. il campo `youtube`;
3. le GIF del campo `gif`, da [ExerciseDB](https://oss.exercisedb.dev/) (180×180, una per
   parte di un superset);
4. le foto del campo `photos`, inizio e fine movimento alternati, da
   [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (pubblico dominio).

L'app scarica solo le immagini; la ricerca la fa l'MCP quando si scrive la scheda. Se una GIF
non si carica, l'app mostra le foto. Da ogni esercizio si può sempre cercare un video su
YouTube, con il testo di `search` o il nome dell'esercizio.

## Registro e sincronizzazione

Un allenamento parte da "Inizia allenamento" (data e ora), registra le serie con carico e
ripetizioni (o secondi), ricorda l'esercizio a cui si è arrivati e si chiude con un voto di
fatica e una nota. Un allenamento fatto senza l'app si aggiunge da "Allenamenti fatti": giorno,
data, ora di inizio e durata, poi le serie con lo stesso flusso, senza timer di recupero. Ogni
modifica si salva subito sul dispositivo e va in coda; la coda si svuota verso l'API quando c'è
rete, e all'avvio e dopo ogni login l'app scarica i dati del server, schede comprese. Gli id
nascono sul dispositivo, quindi un invio ripetuto non duplica.

Un carico "trova N rm" apre la ricerca del carico massimo per N ripetizioni: dopo ogni serie
l'app dice se salire o scendere, e la serie da esattamente N ripetizioni fissa il carico, che le
settimane seguenti propongono come riferimento.

## Supabase

Progetto `gymapp` (Francoforte), collegato con `supabase link`. URL, chiave pubblica e indirizzo
dell'API stanno in `apps/app/.env`: sono valori da client.

L'app usa Supabase per il login e parla con il server solo attraverso l'API di `packages/api`
(Hono), pubblicata come Edge Function su `/functions/v1/api`. L'API verifica il token con le
chiavi pubbliche del progetto (JWKS), controlla ogni riga che riceve e la passa all'adattatore
Supabase con il token dell'utente: la Row Level Security, che lega ogni riga a `auth.uid()`,
resta come seconda protezione. Su Cloudflare Workers i dati andranno in D1 e i file Excel in R2:
servono un adattatore D1/R2 e un punto d'ingresso per Workers, mentre rotte, controlli e MCP
restano gli stessi. Il login resta su Supabase Auth.

- Rotte: `GET /data`; `PUT` e `DELETE` su `/workouts/:id`, `/sets/:id`,
  `/rep-maxes/:exerciseId`; `PUT /preferences`; `GET /plans/:id/file` e `/plans/:id/file/link`;
  `/mcp`. File Excel e MCP non sono per la demo.
- Tabelle: `plans` (contenuto JSON come testo), `workouts`, `sets`, `rep_maxes`, `preferences`.
  Codice, commenti e database usano nomi inglesi; i testi dell'app sono in italiano.
- I file Excel stanno nel bucket privato `plans`, in una cartella per utente
  (`<user id>/<plan id>.xlsx`). L'app li mostra come foglio, con i colori originali (SheetJS,
  caricato solo quando si apre il file).
- Schema portabile verso D1 (SQLite): tipi semplici (testo, interi, numeri, date come testo
  ISO), JSON salvato come testo, nessuna logica nel database (trigger, funzioni, viste, enum,
  array). Le uniche parti legate a Supabase sono le policy RLS, l'autenticazione e lo storage;
  l'accesso ai dati sta tutto nell'adattatore `packages/api/src/supabase.ts`.
- Schema: `supabase migration new <nome>`, poi `supabase db push`; configurazione:
  `supabase config push`; API: `supabase functions deploy api --use-api`. La password del
  database è in 1Password (`op://Private/Supabase - gymapp/password`), da passare con
  `ai-secrets` come `SUPABASE_DB_PASSWORD`.

## Settimane

La settimana 1 di una scheda parte dal primo allenamento fatto con quella scheda, non dalla data
in cui il trainer l'ha scritta; dalla schermata iniziale si può ricominciare da oggi o scegliere
un'altra settimana.

## Lettura della scheda

- Una cella vuota in una settimana vale quanto la settimana prima.
- Un carico "trova N rm", e il "limitati a questo" che lo accompagna, valgono solo nella
  settimana in cui compaiono: dopo vale il carico trovato.
- Un recupero scritto come numero (`2`) è in minuti.
- Le serie a tempo (`3x30"`) hanno un timer: 5" per prepararsi, poi i secondi, con i bip a 3-2-1.
  Una tenuta che segue ogni serie, come in un superset (`3x20/30"+20" a lato side plank`), continua
  nello stesso timer, un lato alla volta se è scritto "a lato" o "per lato".
- I giri contro il tempo (`5 rep ogni 30" x 4 min`) hanno un timer che segnala l'inizio di ogni
  giro; le ripetizioni dei giri fatti diventano una serie.

## Pubblicazione

Ogni push su `main` esegue typecheck, test ed export web, e pubblica `apps/app/dist`
con GitHub Actions. Il sito vive sotto `/gym` (`experiments.baseUrl` in `apps/app/app.json`):
il nome del repository GitHub deve essere `gym`. `404.html` è una copia dell'app, così
anche percorsi come `/gym/oauth/consent` la aprono.
