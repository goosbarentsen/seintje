# ARCHITECTURE.md — de kaart

Het instappunt voor wie Seintje niet kent. Eén pagina, altijd waar. Past hij niet meer op één
pagina, dan vereenvoudigen we het systeem — niet de kaart (zie `ENGINEERING.md` §1).

**Stand: 2026-08-15.** Gate 1 is gepasseerd op de technische helft. Er staat een landingspagina,
een verkenningstool, de detectie met haar poort, de pilot-runner van story 001 (één rekening,
één regel, schaduwmodus) en het beschrijvende rapport dat offline over een echte export draait.
Stories 001 t/m 005 zijn gebouwd; alleen 001 wacht nog op een echte koppeling.

## Modules

| Module | Wat het is |
| --- | --- |
| `seintje/site/` | De landingspagina op seintje-app.nl: één statisch HTML-bestand plus een privacypagina, gepubliceerd via GitHub Pages. Verzamelt wachtlijstaanmeldingen. |
| `seintje/sandbox/` | Node-verkenningstool voor de Enable Banking-sandbox: banken opvragen, een rekening koppelen, transacties ophalen, en geaggregeerd doorrekenen (`aggregate.js`). |
| `seintje-backtest/` | Apart, lokaal repo. Bezit de detectie: de engine, de synthetische dataset en de go/no-go-poort, én sinds story 001 de pilot-runner die de engine op echte data draait. |
| ↳ *detectie* | `detection-engine.js` is de spec, geïmplementeerd — één plek, alles importeert het. `kaart-kandidaten.js` staat er bewust naast: voorstel, nog niet in de spec. `walk-forward.js` beoordeelt per dag tegen de historie daarvóór. |
| ↳ *abstractielaag* | `map-enablebanking.js` zet bankformaat om naar intern formaat en kent twee vocabulaires (sandbox-Engels, productie-Nederlands). `tussenrekeningen.js` haalt bij Tikkie en verwanten de echte ontvanger uit de omschrijving. `laad-export.js` leest een export in. |
| ↳ *beeld* | `beschrijving.js` en `terugkerend.js` beschrijven wat een rekening doet; `eigen-rekeningen.js` vraagt welke rekeningen ook van de klant zijn. `rapport.js` en `replay-eigen-export.js` draaien dat offline over een echte export. |
| ↳ *de lijn* | `pilot/` en `pilot-runner.js`: ophalen, omzetten, één regel, één signaal, in schaduwmodus. Bevat geen regellogica — een test bewaakt dat. |
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
        detection-engine.js: baseline uit de historie vóór die dag, dan de ene regel
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
- **De tegenpartij is wie het geld krijgt, niet via wie het loopt.** Bij een betaaldienst is het
  IBAN de verzamelrekening; de ontvanger komt uit de omschrijving. Opgelost in de abstractielaag
  zodat geen enkele regel hoefde te veranderen.
- **Een afgeleide identiteit telt pas als hij terugkomt.** Eenmalige omschrijvingen zijn
  berichttekst, geen tegenpartij — ze als identiteit gebruiken laat regels op ruis vuren.
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
