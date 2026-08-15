# ARCHITECTURE.md — de kaart

Het instappunt voor wie Seintje niet kent. Eén pagina, altijd waar. Past hij niet meer op één
pagina, dan vereenvoudigen we het systeem — niet de kaart (zie `ENGINEERING.md` §1).

**Stand: 2026-08-15.** Gate 1 is gepasseerd op de technische helft. Naast de landingspagina en
de validatietools staat er nu één stuk draaiende code: de pilot-runner van story 001. Die kijkt
naar één rekening — die van de oprichter — met één regel, in schaduwmodus.

## Modules

| Module | Wat het is |
| --- | --- |
| `seintje/site/` | De landingspagina op seintje-app.nl: één statisch HTML-bestand plus een privacypagina, gepubliceerd via GitHub Pages. Verzamelt wachtlijstaanmeldingen. |
| `seintje/sandbox/` | Node-verkenningstool voor de Enable Banking-sandbox: banken opvragen, een rekening koppelen, transacties ophalen, en geaggregeerd doorrekenen (`aggregate.js`). |
| `seintje-backtest/` | Apart, lokaal repo. Bezit de detectie: de engine, de synthetische dataset en de go/no-go-poort, én sinds story 001 de pilot-runner die de engine op echte data draait. |
| ↳ `src/detection-engine.js` | De regels zelf. Eén plek. Alles wat detecteert, importeert dit bestand en schrijft niets na. |
| ↳ `src/pilot/` + `pilot-runner.js` | De draaiende lijn: ophalen, omzetten, één regel, één signaal. Bevat geen regellogica — een test bewaakt dat. |
| ↳ `src/kaart-kandidaten.js` | Voorgestelde regels voor kaartbetalingen. Nog niet in de spec, dus bewust buiten de engine — zo blijft zichtbaar wat de backtestpoort dekt en wat experiment is. |
| ↳ `src/terugkerend.js` | Herkent lopende verplichtingen op ritme (wekelijks tot jaarlijks). Ontdekfunctie, geen alarmregel. |
| ↳ `src/walk-forward.js` | Beoordeelt per dag tegen de historie daarvóór. Eén implementatie, omdat hier de stille fout zat. |
| ↳ `src/replay-eigen-export.js`, `src/rapport-eigen-jaar.js` | Draaien de regels offline over een echte export. Alleen aantallen op het scherm; detail naar een bestand buiten elk repo. |
| `seintje-docs/` | Apart, privé repo. Businessplan, detectiespecificatie, DPIA, werkdocument. Geen code — wel de bron van waarheid voor alles wat de code moet doen. |
| `seintje/stories/` | Eén bestand per functionaliteit: wat, waarom, acceptatie, status, beslissingen. |

## Datastroom

Vandaag lopen er twee losse stromen; ze raken elkaar nog niet.

```
Verkenning (handmatig, oprichter draait het lokaal)
  bank  →  Enable Banking API  →  sandbox/connect + explore  →  sandbox/output/*.json
                                                                   (gitignored, nooit gelezen)
                                                                         ↓
                                                             sandbox/aggregate.js
                                                                         ↓
                                                       alleen geaggregeerde cijfers → werkdocument

Validatie (reproduceerbaar, elke regelwijziging)
  detectiespecificatie  →  generate-data.js  →  data/*.json
                                                     ↓
                             detection-engine.js  →  backtest.js  →  backtest-report.json → rapport

De verticale lijn (story 001, 4× per etmaal)
  bank  →  Enable Banking API  →  eb-client (venster ophalen)
                                        ↓
                              map-enablebanking.js  →  transacties in geheugen
                                        ↓
                          state.js: wat is nieuw?  (vingerafdrukken, geen bedragen)
                                        ↓
             detection-engine.js: baseline uit de historie vóór die dag, dan R1
                                        ↓
                    schaduwlog op de machine  +  ntfy-bericht zonder gegevens
```

De runner bewaart geen transactieoverzicht. Hij haalt het leervenster elke run opnieuw op en
rekent de baseline in geheugen — dat scheelt een bestand vol IBAN's, en het is de reden dat
"geen ruwe data op schijf" geen belofte is maar een eigenschap van de opzet.

## Belangrijke keuzes

- **Drie repo's, gescheiden op vertrouwelijkheid.** `seintje` is publiek (GitHub Pages);
  detectieregels en planning zouden daar zichtbaar zijn, dus die staan lokaal/privé.
- **De site is één bestand zonder buildstap.** Een buildsysteem voor één pagina kost meer
  onderhoud dan het bespaart, en de oprichter moet hem zelf kunnen aanpassen.
- **Backtest in een eigen repo, zonder dependencies.** Alleen Node-built-ins: de poort moet
  over jaren nog draaien zonder dat een verlopen pakket hem breekt.
- **Seedbare PRNG (`prng.js`) voor de dataset.** Zonder reproduceerbare data is een groene
  backtest geen bewijs.
- **Detectie is uitlegbare regels, geen black-box AI in v1.** Een alarm dat we niet kunnen
  uitleggen, kunnen we niet verantwoorden tegenover een familie of een toezichthouder.
- **Wat detecteert, importeert de engine — het schrijft nooit een regel na.** Zodra een tweede
  implementatie bestaat, bewaakt de backtest niet meer wat er in productie draait.
- **De baseline komt altijd uit de historie vóór de dag die je beoordeelt.** Reken je hem over
  het hele venster, dan is een nieuw IBAN al bekend op het moment dat je het toetst en vuurt de
  regel nooit — stil kapot in plaats van zichtbaar kapot.
- **Wat op schijf blijft, is onomkeerbaar gemaakt.** Al beoordeelde transacties leven als HMAC
  met een lokaal zout, niet als datum-plus-bedrag. De uitzondering is de schaduwlog, die alleen
  de treffers bevat — zonder die uitzondering valt er niets te beoordelen.
- **Dunne abstractielaag tussen detectie-engine en aggregator.** Enable Banking is de keuze,
  Yapily is plan B; die wissel mag de detectie niet raken.
- **Geen permanent transactiearchief.** Dataminimalisatie is architectuur, geen belofte:
  we delen het alarm, niet de data.
- **`sandbox/output/` staat in `.gitignore` en wordt nooit gelezen.** Echte bankdata verlaat
  de laptop niet en komt niet in een gesprek terecht (CLAUDE.md harde regel 5).
- **`/docs/` is verder gitignored.** Alleen dit bestand en `ENGINEERING.md` zijn uitgezonderd;
  al het overige vertrouwelijke materiaal in die map blijft buiten git.
