# ENGINEERING.md — hoe we bouwen

**Waarom dit document bestaat:** door AI geschreven code stapelt zich op. Elke sessie voegt
toe, niets snoeit. Zonder tegendruk groeit een codebase die alleen de machine die hem schreef
nog overziet.

**De maatstaf is dus:** begrijpt een vreemde deze codebase in één dag? Een ingehuurde
fintech-freelancer, een toekomstige medeoprichter, of de oprichter zelf over een half jaar.
Elke regel hieronder dient die toets. Een regel die de toets niet dient, hoort hier niet.

**Verplicht te lezen vóór elke bouwsessie** (CLAUDE.md, harde regel 7). Geldt voor al het
Seintje-werk: `seintje` (site + sandbox), `seintje-backtest`, en het toekomstige MVP-repo.

---

## 1. De kaart: ARCHITECTURE.md

`/docs/ARCHITECTURE.md` is het instappunt van de vreemde. Eén pagina, altijd waar, en hij bevat:

- **welke modules er zijn**, met één zin per module over wat hij doet;
- **hoe de data stroomt** tussen die modules — een simpele lijst of schets, geen UML;
- **belangrijke keuzes** — technische beslissingen die niet vanzelf spreken, met één regel
  reden per keuze. Niet wat we deden, maar waarom het geen andere optie werd.

**Harde regel: past de kaart niet meer op één pagina, dan is dat het signaal om het systeem te
vereenvoudigen — niet om de kaart te verlengen.** Een kaart die niet meer past, beschrijft een
systeem dat niemand in een dag nog begrijpt. Verlengen verbergt dat probleem; snoeien lost het op.

De kaart is de ingang, de stories zijn het detail erachter, de tests zijn de precisie. Zet
geen detail in de kaart dat in een story of test thuishoort.

## 2. Story-first, en licht gehouden

**Geen functionaliteit zonder story, en de story komt vóór de bouw.** Stories staan in
`/stories/` als `NNN-naam.md`. Zie `000-voorbeeld.md` voor het formaat:

- **Wat** — één alinea gewone taal. Wat merkt de gebruiker ervan?
- **Waarom** — verwijzing naar het businessplan, de fraude-engine-strategie of een
  productprincipe uit CLAUDE.md. Geen story zonder verankering.
- **Acceptatie** — 3 tot 7 concrete criteria. Elk criterium krijgt `[auto]` als een test het
  afdekt, of `[hand]` mét hoe de oprichter het zelf controleert. Geen criterium zonder een van
  beide labels; "dat zien we wel" is geen acceptatiecriterium.
- **Status** — `idee` / `gebouwd` / `draait-in-schaduw` / `getest-met-Nico` / `af`.
- **Beslissingen** — één regel per niet-voor-de-hand-liggende keuze, met de reden.

Stories blijven kort. Wordt een story lang, dan is de functionaliteit te groot: splits hem.
De diepte zit in de tests en in de kaart, niet in proza.

**Vertrouwelijkheidsgrens (harde regel 2).** `seintje` is een publiek repo. Stories en kaart
*verwijzen* naar de detectiespecificatie — ze herhalen nooit regel-identificatoren, drempels,
formules of dekkingscijfers. Kan een story niet geschreven worden zonder die inhoud, dan hoort
de inhoud in `~/Developer/seintje-docs` en staat in de story alleen de verwijzing. Hetzelfde
geldt voor de kaart.

## 3. Tests zijn de levende specificatie

Elk `[auto]`-criterium wordt een automatische test **in dezelfde sessie waarin de
functionaliteit gebouwd wordt**. Niet "in een testronde later" — later komt niet.

**De backtest is de permanente regressiepoort.** Geen wijziging aan detectieregels of drempels
gaat live zonder dat de volledige backtest groen is, tegen de norm die in CLAUDE.md onder
"Current phase and gates" staat (de cijfers en de redenering wonen in `seintje-docs`; hier
alleen de verwijzing, zodat ze niet uit elkaar kunnen lopen). Dit is niet onderhandelbaar en
vervalt nooit — ook niet na Gate 1, ook niet onder tijdsdruk, ook niet voor "een kleine
aanpassing".

Rood betekent stoppen, niet drempel verschuiven. Verandert een regel bewust, en verandert het
verwachte resultaat daardoor, dan wordt de nieuwe uitkomst opnieuw vastgelegd als norm — met
de reden gelogd in de story en in het werkdocument.

## 4. Schaduwmodus voor de pilot

Nieuwe of gewijzigde regels draaien eerst in de schaduw: ze loggen wat ze gesignaleerd zóuden
hebben, zichtbaar voor uitsluitend de oprichter. **Nooit voor Nico.**

Uit de schaduw halen is een expliciete beslissing van de oprichter, en wordt gelogd in de
story (regel onder **Beslissingen**, met datum). Nico krijgt nooit een alarm van iets dat zich
niet eerst bewezen heeft. Zijn vertrouwen ís de pilot: één vals alarm bij hem kost meer dan
een maand vertraging.

## 5. Entropiebudgetten

Concreet, meetbaar, en ze gelden tot iemand ze bewust wijzigt:

- **Geen bestand boven ~200 regels** zonder gelogde rechtvaardiging (in de story of hieronder).
- **Elke nieuwe dependency kost één gelogde regel:** wat hij doet, en waarom de standaardlibrary
  het niet kon. Geen regel, geen dependency.
- **Geen frameworks, buildsystemen of infrastructuur** zonder dit eerst aan de oprichter te
  melden. Dat is een directionele vraag, geen implementatiedetail.
- **Code die zijn doel verloor, wordt verwijderd in dezelfde sessie die hem overbodig maakte.**
  Verwijderen is vooruitgang. Niet uitcommentariëren, niet "voor later" laten staan — git
  onthoudt het wel.

### Gelogde uitzonderingen op de 200-regelgrens

| Bestand | Regels | Reden |
| --- | --- | --- |
| `site/index.html` | ~1030 | Bewust één bestand: geen buildstap, inline CSS/SVG. De grens geldt voor code, niet voor de statische pagina. |
| `sandbox/src/aggregate.js` | ~475 | Analyse-tool, geen productiecode. Wordt weggegooid zodra de MVP-pijplijn er staat. |
| `sandbox/src/explore.js` | ~209 | Idem — verkenningstool, tijdelijk van aard. |
| `seintje-backtest/src/generate-data.js` | ~505 | Eén scenario per blok, plat en leesbaar; opsplitsen zou de dataset moeilijker te volgen maken. |
| `seintje-backtest/src/detection-engine.js` | ~289 | Volgt de spec-indeling één-op-één; die structuur is meer waard dan de regelgrens. |

Loopt een bestand hier niet in, en gaat het over de grens: splitsen, of een regel aan deze
tabel toevoegen met de reden. Stilzwijgend eroverheen groeien mag niet.

## 6. Sessieritueel — dit bindt Claude Code

**Openen:** lees de relevante story en de kaart. Zonder story: eerst de story schrijven, dan
pas bouwen.

**Sluiten:** status van de story bijgewerkt, kaart nog steeds waar, tests groen. Klopt de kaart
niet meer, dan is de sessie niet af.

**Nooit een sessie eindigen met ongedocumenteerde structuur.** Een nieuwe module, een nieuwe
datastroom of een nieuwe keuze die alleen in de code staat, is precies de accretie waar dit
document tegen bestaat.

**Tegenspreken hoort bij het werk.** Groeit de complexiteit door een verzoek onevenredig, zeg
dat dan vóór je bouwt en stel de eenvoudigere versie voor. Een gebouwde te-grote-versie is
duurder terug te draaien dan een ongemakkelijke opmerking.

## 7. Bouwvolgorde: eerst een verticale plak

De eerste mijlpaal is het dunst mogelijke pad van begin tot eind: rekening koppelen → transacties
ophalen → één regel → één signaal op de telefoon van de oprichter. Daarna verdikken.

**Nooit breed en half af bouwen.** Een dunne lijn die werkt, leert meer dan vijf componenten
die elk voor 80% klaar zijn — en hij is de enige vorm waarin een vreemde het systeem in één
keer kan volgen.

## 8. Entropiecheck

Maandelijks, of elke ~10 stories: zelfcontrole tegen de budgetten hierboven.

- Welke bestanden zijn over hun grens gegroeid, zonder gelogde reden?
- Welke stories zijn afgedreven van wat er werkelijk gebouwd is?
- Wat kan weg — code, stories, dependencies, hele modules?

De uitkomst gaat als kort verslag naar de oprichter, **vóór** er geherstructureerd wordt.
Herstructureren is een beslissing, geen opruimreflex.
