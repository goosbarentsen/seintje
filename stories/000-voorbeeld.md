# 000 — Voorbeeld: wekelijkse INFO-bundel

> **Dit is geen echte story.** Hij bestaat om het formaat te laten zien en blijft staan; de
> functionaliteit hieronder is verzonnen. Echte stories beginnen bij `001`. Zie
> `/docs/ENGINEERING.md` §2 voor de regels achter dit formaat.

**Status:** idee

## Wat

Kleine dingen die opvallen in het rekeningpatroon — een abonnement dat langzaam duurder wordt,
een dubbele afschrijving, inkomen dat uitblijft — komen niet los binnen, maar één keer per week
gebundeld in één rustig bericht. Wie niets bijzonders heeft, krijgt die week geen bericht.

## Waarom

Productprincipe 2 (CLAUDE.md): twee berichttypen, strikt gescheiden. Alarmmoeheid is een
productkiller; de kleine dingen mogen nooit de vorm van een alarm krijgen. De INFO-regels zelf
staan in de detectiespecificatie in `~/Developer/seintje-docs` — hier alleen de verwijzing,
nooit de regels of drempels zelf.

## Acceptatie

- `[auto]` Meerdere INFO-signalen binnen dezelfde week leveren precies één bericht op, niet één
  per signaal.
- `[auto]` Een week zonder signalen levert géén bericht op — geen "er is niets gebeurd"-mail.
- `[auto]` Een ALARM gaat nooit door de bundel: dat pad blijft direct en apart.
- `[hand]` De oprichter leest de bundeltekst hardop; hij klinkt als een berichtje, niet als een
  waarschuwing. (Voorleestoets, CLAUDE.md taalregels.)
- `[hand]` De oprichter bekijkt de bundel op zijn eigen telefoon: leesbaar in één blik, geen
  afgekapte tekst.

## Beslissingen

- 2026-08-13 — Vast moment (maandagochtend) in plaats van "een week na het eerste signaal":
  voorspelbaar is rustiger, en makkelijker te testen.
- 2026-08-13 — Lege week = geen bericht, in plaats van een geruststellend bericht. Een wekelijks
  "alles goed" traint mensen om niet meer te kijken.
- *(datum)* — Uit de schaduw gehaald na akkoord van de oprichter. ← zo wordt promotie uit
  schaduwmodus gelogd (`ENGINEERING.md` §4).
