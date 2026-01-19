# RPG Demo Backend für dokumentenorientierten Datenbanken 

Dieses Projekt ist in Rahmen einer schulischen Demo-Präsentation, **dokumentenorientierte Datenbank** im Gaming Kontext erstellt.
Es zeigt, wie flexibel JSON Strukturen genutzt werden können, um z.B. Spielstände und Stats zu speichern oder ein Inventar / Katalog zu verwalten, in einer No-SQL Datenbank.

## Lernziele
* **Flexibilität:** Speichern von verschiedenen Typen im selbern Array, ohne Joins. [Game Items, verschiedene Objeten in einem Katalog, Webshops Verwaltung, Inventar eines Lagers usw.]
* **Performance:** Atomare Updates, schnelle Transaktionen.
* **Polymorphismus:** Beim API-Endpunkt, können je nach Item-Typ unterschiedliche Reaktionen erzielt werden.

## Installation

### Voraussetzungen
1. Node.js oder bun
2. MongoDB (Docker-Image)

### Terminal
```bash
# clone repository
git clone [https://github.com/angelo-lucio/Demo_Document_Datenbank.git](https://github.com/angelo-lucio/Demo_Document_Datenbank.git)

# dependencies
npm install

#oder
bun install

# start code
npx ts-node server.ts 

#oder
bun run server.ts
