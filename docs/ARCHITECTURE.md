# ARCHITECTURE.md — de kaart

Het instappunt voor wie Seintje niet kent. Eén pagina, altijd waar. Past hij niet meer op één
pagina, dan vereenvoudigen we het systeem — niet de kaart (zie `ENGINEERING.md` §1).

**Stand: 2026-08-13.** Er is nog geen product. Wat er staat is een landingspagina plus twee
validatietools. Productcode begint pas na Gate 1 (CLAUDE.md).

## Modules

| Module | Wat het is |
| --- | --- |
| `seintje/site/` | De landingspagina op seintje-app.nl: één statisch HTML-bestand plus een privacypagina, gepubliceerd via GitHub Pages. Verzamelt wachtlijstaanmeldingen. |
| `seintje/sandbox/` | Node-verkenningstool voor de Enable Banking-sandbox: banken opvragen, een rekening koppelen, transacties ophalen, en geaggregeerd doorrekenen (`aggregate.js`). |
| `seintje-backtest/` | Apart, lokaal repo. Synthetische dataset + implementatie van de detectieregels + go/no-go-rapport. De permanente regressiepoort voor elke regelwijziging. |
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
```

De brug tussen die twee — echte transacties door de detectie-engine — is precies de verticale
plak die als eerste gebouwd wordt (`ENGINEERING.md` §7), en bestaat dus nog niet.

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
- **Dunne abstractielaag tussen detectie-engine en aggregator.** Enable Banking is de keuze,
  Yapily is plan B; die wissel mag de detectie niet raken.
- **Geen permanent transactiearchief.** Dataminimalisatie is architectuur, geen belofte:
  we delen het alarm, niet de data.
- **`sandbox/output/` staat in `.gitignore` en wordt nooit gelezen.** Echte bankdata verlaat
  de laptop niet en komt niet in een gesprek terecht (CLAUDE.md harde regel 5).
- **`/docs/` is verder gitignored.** Alleen dit bestand en `ENGINEERING.md` zijn uitgezonderd;
  al het overige vertrouwelijke materiaal in die map blijft buiten git.
