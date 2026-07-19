# Seintje

Seintje is een Nederlandse consumenten-app die waakt over de bankrekening van een oudere ouder (70+) en zowel de senior als hun volwassen kind waarschuwt zodra er een patroon van financiële fraude wordt herkend — nep-bankmedewerkers, beleggings-/cryptofraude, WhatsApp-fraude en de "geldkoerier"-truc.

De rekening wordt **alleen-lezen** gekoppeld via PSD2 (dezelfde techniek als budget-apps): Seintje kan meekijken, maar nooit geld overmaken.

De koper is het bezorgde volwassen kind (45–60); de gebruiker is de ouder (70+).

## Status: validatiefase

We bouwen nog geen app, detectie-engine of bankkoppeling. Deze fase draait om het testen van vraag via een landingspagina en validatie-interviews, vóórdat er ook maar één regel productcode geschreven wordt.

## Mapstructuur

```
seintje/
├── README.md          — dit bestand
├── .gitignore
└── site/               — de landingspagina, gepubliceerd via GitHub Pages
    └── index.html
```

De planningsdocumenten (businessplan, detectiespecificatie, DPIA, werkdocument & beslislog, interview- en wervingsmateriaal) staan niet in dit repo. Ze leven in een apart, privé, lokaal repo — `~/Developer/seintje-docs` — zodat ze nooit per ongeluk meegepusht kunnen worden naar GitHub Pages, dat wél publiek is.
