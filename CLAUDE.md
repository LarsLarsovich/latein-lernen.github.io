# Latein-Lernplattform

## Projekt-Übersicht
Latein-Lernwebsite für Schüler. Vanilla JS, HTML, CSS, Firebase (Firestore + Authentication). Deployed auf GitHub Pages.

- **Live-URL:** https://larslarsovich.github.io/latein-lernen.github.io/
- **GitHub Repo:** LarsLarsovich/latein-lernen.github.io
- **Firebase Projekt:** `latein-lernen` (projectId)
- **Kontakt:** e.zinke@grg7.at

---

## Architektur

- Kein Build-Tool, kein Framework. Nur Firebase SDK (compat) und Google Fonts.
- **Jedes Thema hat einen eigenen Ordner** mit einer `index.html` und seinen JS-Dateien.
- Was mehrere Themen brauchen, liegt in `gemeinsam/`.
- Kopfzeile, Fußzeile, Login und „Melden" stehen in keiner HTML-Datei, sondern werden von `gemeinsam/shell.js` eingefügt.

### Dateistruktur
```
index.html                 Startseite: eine Karte pro Thema (aus App.TOPICS)
impressum/index.html

gemeinsam/                 von mehreren Seiten benutzt
  style.css                gesamtes Styling
  firebase.js              Firebase-Config, db, auth, COL (Sammlungen)
  constants.js             CASES, GENDERS, GENUS_OPTS, DEKL_OPTS, REPORT_CATEGORIES
  state.js                 globaler Zustand einer Seite
  utils.js                 escHtml, parseAnswers, isCorrect, diffHighlight
  shell.js                 App: Rahmen, Navigation, Admin-Login, Daten laden
  report.js                Report: „Fehler melden" (mit Kategorie)
  grammar.js               German + Latin: Formen per Regel bilden
  vok-forms.js             VokForms: Formentabellen (Vokabel-Detail, Formen-Editor, Suche, unregelm. Verben)
  quiz-engine.js           Quiz + VokabelQuiz (Abfrage-Logik)
  quiz-views.js            QuizViews: HTML für Einstellungen/Quiz/Ergebnis + Start-Logik
  tabellen.js              Tables: Karten-Übersicht, Tabellen-Ansicht, Entwürfe (Vokabeln + Pronomina)
  grammatik-tafeln.js      GrammarTables: Bausteine für Deklinationen/Konjugationen
  print.js                 Print: Druckansicht / PDF

vokabeln/        index.html, vokabeln.js (Editor, VokSearch, Lernmodi), vok-detail.js, flashcards.js, matching.js
pronomina/       index.html, pronomina.js
deklinationen/   index.html, deklinationen.js   (feste Tafeln + YouTube-Videos)
konjugationen/   index.html, konjugationen.js   (feste Tafeln)
unregelmaessige/ index.html, unregelmaessige.js (Irregular: jede Form von Hand)
kulturkunde/     index.html, goetter.js         (Goetter: Übersicht, Detail, Editor, Stammbaum)
meldungen/       index.html, meldungen.js       (nur Admins: Meldungen nach Kategorie)

firestore.rules            Firestore-Regeln (in der Konsole einfügen)
SICHERHEIT.md              Anleitung: Login einrichten, Regeln veröffentlichen
```

### Eine Seite aufbauen
Jede `index.html` enthält nur ihre Ansichten als `<main id="page-…" class="page">` und lädt am Ende:
1. Firebase SDK (app, firestore, auth)
2. `gemeinsam/firebase.js, constants.js, state.js, utils.js, shell.js, report.js`
3. weitere gemeinsame Skripte, dann die des Themas
4. `App.init({...})`

```js
App.init({
  title: 'Vokabeln',
  collections: ['vokabel'],        // für alle lesbar (Schlüssel aus COL)
  drafts: ['vokabelDrafts'],       // nur für Admins, werden erst nach Login geladen
  onData() { … },                  // Daten da/geändert, auch nach Login/Logout
  onAdd()  { … },                  // Plus-Knopf (nur Admins sichtbar); weglassen = kein Plus
  adminOnly: true                  // nur Meldungen-Seite
});
```

### Neues Thema hinzufügen
1. Ordner mit `index.html` (am besten eine bestehende kopieren) und eigener JS-Datei anlegen
2. In `gemeinsam/shell.js` bei `App.TOPICS` eine Zeile ergänzen → Karte erscheint auf der Startseite
3. Braucht es Daten: Sammlung in `gemeinsam/firebase.js` (COL), `gemeinsam/state.js` und `firestore.rules` eintragen

### Navigation
- Zwischen Themen: normale Links (`App.topicUrl('vokabeln')`). `App.ROOT` ist die Adresse des Hauptordners.
- Innerhalb eines Themas: mehrere `<main class="page">`, sichtbar ist die mit `.active`.
  - `page-home` = Übersicht des Themas
  - `App.showPage(id, name)`, `App.goBack()` (ein Schritt zurück), `App.goHome()` (Übersicht des Themas)
- Themenseiten hängen eigene Funktionen mit `Object.assign(App, {...})` bzw. `Object.assign(Tables, {...})` an.
- Direktlinks: `vokabeln/index.html?vok=<Listen-ID>:<Zeile>`, `unregelmaessige/index.html?verb=<ID>`

### Cache
Alle lokalen CSS/JS-Dateien werden mit `?v=2.4.0` geladen. Nach Änderungen die Nummer in allen `index.html` erhöhen (Suchen & Ersetzen).

---

## Firebase

### Sammlungen (`COL` in gemeinsam/firebase.js)
| COL-Schlüssel | Sammlung | Inhalt |
|---|---|---|
| `vokabel` | `tables_vokabel` | Vokabellisten |
| `vokabelDrafts` | `drafts_vokabel` | Entwürfe Vokabellisten |
| `pronomen` | `tables_pronomen` | Pronomen-Tabellen (mit Quiz) |
| `pronomenDrafts` | `drafts_pronomen` | Entwürfe Pronomen-Tabellen |
| `goetter` | `goetter` | Götter |
| `unregelmaessige` | `unregelmaessige` | unregelmäßige Verben |
| `reports` | `reports` | Fehlermeldungen |
| `admins` | `admins` | Admin-Konten, Dokument-ID = Firebase-UID |

Nicht mehr benutzt: `quizes`, `drafts` (alte Einzel-Quize), `sommerferien_*`.

### Admin-System
- Login über **Firebase Authentication** (E-Mail/Passwort). Admins tippen einen Benutzernamen; intern wird `@latein-lernen.firebaseapp.com` angehängt (`ADMIN_DOMAIN`).
- Admin ist, wer angemeldet ist **und** ein Dokument `admins/<uid>` hat: `{ name, username, role: 'super' | 'admin' }`.
- Dasselbe prüfen die Regeln in `firestore.rules`. Die Anzeige im Browser ist nur Komfort, die Sicherheit kommt aus den Regeln.
- Haupt-Admin (`role: 'super'`) legt weitere Admins auf der Website an (⚙️). Das geschieht über eine zweite Firebase-App-Instanz, damit er selbst angemeldet bleibt.
- Admin-Knopf: unauffällig in der Fußzeile neben dem Impressum.
- Plus-Knopf oben: legt direkt das an, was zur Seite gehört (`onAdd`).
- Knöpfe, die nur Admins sehen sollen, bekommen im HTML das Attribut `data-admin`; `App._setAdmin` blendet sie bei Login/Logout ein und aus (auch wenn die Ansicht schon offen ist)
- **Niemals** Passwörter, Hashes oder API-Keys in Firestore oder im Code ablegen.

---

## Quiz-System (gemeinsam/quiz-engine.js, quiz-views.js)
- **Spaced Repetition:** falsche Antworten kommen nach 5 anderen wieder
- **Prüfungsmodus:** keine Wiederholung
- Kreisdiagramm am Ende; Ergebnis pro Vokabelliste in `localStorage` (`quiz_result_<id>`) für das Mini-Diagramm auf der Karte

### Vokabel-Quiz (`VokabelQuiz`)
- Richtung ist eine Einzelauswahl: Latein → Deutsch ODER Deutsch → Latein, standardmäßig nichts gewählt
- Zusatz-Checkboxen (2. Fall/1. Person Präsens, Geschlecht, 1. Person Perfekt) nur bei Deutsch → Latein
- Angabe Latein immer vollständig (`formatLatin`): `femina, feminae f.` · `amare, amo, amavi` · `bonus/a/um`
- Angabe Deutsch: alle Bedeutungen (`formatGerman`)
- `VokabelQuiz.analyse(input, r, require)` prüft Wort / 2. Fall / Geschlecht / Perfekt einzeln
  - Trennzeichen egal (Komma, Strichpunkt, Punkt, Leerzeichen); Punkt nach m/f/n optional
  - Kurzformen erlaubt: `femina, ae f.`; die Endung muss den abweichenden Teil abdecken (`inis` für `fluminis`)
  - Adjektive: erste Form reicht, weitere dürfen als Endung oder ausgeschrieben dabei sein
- Ergebnis: richtig / „fast richtig" (verlangte Angabe vergessen – zählt als nicht richtig) / falsch
- `feedbackHtml` markiert falsche (`diff-wrong`) und vergessene Teile (`diff-missing`) einzeln

### Antwort-Parsing Deutsch (utils.js)
- `wieder(um)` → `wieder` und `wiederum` · `gehen (+Dat.)` → Anmerkung ignoriert · `%` trennt mehrere gültige Antworten

---

## Vokabeln

### Vokabelzeile (ein Eintrag in `rows`)
- `lat`, `fall2` (bei Verben: 1. Person Präsens), `genus`, `dekl`, `de`, `perf` (1. Person Perfekt)
- `deGenus` (optional): Geschlecht des deutschen Wortes, wenn es vom lateinischen abweicht (annus m. → das Jahr: `n.`). Bestimmt die deutschen Artikel in der Formentabelle.
- `type` (optional): vom Admin festgelegte Wortart `noun|verb|adj|indecl`; sonst `Latin.detectType`
- `forms` (optional): vom Admin eingetragene Formen, siehe unten
- Adjektive stehen mit allen Geschlechtern in `lat`: `bonus/a/um`, `pulcher/ra/rum`, `nobilis/e`
- Mehrere Bedeutungen in `de` mit `%`

### Text-Import (Listen-Editor → Texteditor)
- Eine Zeile pro Vokabel, 7 Felder: `Latein-2.Fall-Genus-Deklination-Deutsch-Perfekt-GenusDeutsch`, leere Felder `#`
- Feld 6 und 7 sind optional (alte Zeilen mit 5 oder 6 Feldern funktionieren weiter)
- Der AI-Prompt (`Tables.copyAiPrompt`) liefert genau dieses Format

### Listenansicht (`VokSearch` in vokabeln/vokabeln.js)
- Spalten: Latein | 2. Fall / 1. Pers. Präsens | Genus / 1. Pers. Perfekt | Dekl. / Konj. | Übersetzung; leere Zellen „–"
- Filter: Wortart, Genus, Deklination ODER Konjugation (`d:3. Dekl.` / `k:a|e|kons|misch|i|irr`)
- Konjugation wird nicht gespeichert, sondern bestimmt (`Latin.verbClass`)
- Suche findet auch jede gebeugte Form

### Formentabellen (gemeinsam/vok-forms.js)
- `VokForms.build(r, legacy)` liefert alle Tabellen einer Vokabel
- Verben: Präsens, Imperfekt, Futur I, Perfekt, Plusquamperfekt, Imperativ · Nomen: 6 Fälle Sg./Pl. · Adjektive: 6 Fälle × m/f/n × Sg./Pl.
- Quelle der Formen, in dieser Reihenfolge:
  1. `r.forms` – vom Admin bei der Vokabel eingetragen (dann KEIN Algorithmus mehr)
  2. Eintrag auf der Seite „Unregelmäßige Verben" mit gleichem Infinitiv
  3. alte Teil-Überschreibung `t.overrides[index]`
  4. Regeln aus `grammar.js`
- Feldnamen: `praes_p1sg`, `impf_…`, `fut_…`, `perf_…`, `plqpf_…`, `imp_sg`, `inf_praes`, `sg_nom`, `pl_abl`, `m_sg_gen`; deutsche Spalten mit `de_` davor
- Formen-Editor (`VokDetail.openForms`): alle Felder vorbelegt; Speichern schreibt alle als `r.forms`; „Wieder automatisch bilden" löscht `r.forms`
- Beim Speichern einer ganzen Liste bleiben `forms`/`type` erhalten (`Tables._carryOver`, Zuordnung über `lat`)

### Unregelmäßige Verben (unregelmaessige/)
- Dokument: `{ id, inf, de, stamm, order, forms }` – jede Form von Hand, kein Algorithmus
- Tabellen: wie Verben plus Infinitive (`VokForms.layoutIrregular`)

### Fehlermeldungen
- Kategorie ist Pflicht (`REPORT_CATEGORIES`), gespeichert als `category`; ohne Kategorie (alt) = `sonstiges`
- `encodedContext` `VOK:<Liste>:<Zeile>` bzw. `QUIZ:<Liste>:<Zeile>:<Wort>` → Link von der Meldungen-Seite zur Vokabel

---

## Kulturkunde
- Sammlung `goetter`: `nameRom`, `nameGre`, `symbol`, `bereiche[]`, `symbole[]`, `beschreibung`, `fakten[]`, `eltern`, `kinder`, `fotoUrl`, `fotoQuelle`
- `page-home` ist eine Auswahl: Götter (`page-goetter`, mit Stammbaum als Miro-Embed) oder Die Argonauten (`page-argonauten`, eingebettetes YouTube-Video)
- Weiteres Kulturkunde-Thema: eine Karte in `page-home` und eine eigene `<main id="page-…">` in `kulturkunde/index.html` ergänzen

## Grammatik-Tafeln
- Feste Inhalte in `deklinationen/deklinationen.js` und `konjugationen/konjugationen.js`
- Endungen orange (`.gt-ending`), Stamm normal (`.gt-stem`)

---

## Wichtige Patterns
- Karten in Übersichten (`.list-card`, gebaut in `Tables._cardBody` bzw. `Irregular.renderHome`) zeigen Name, eine Zeile dazu und eine Kostprobe aus dem Inhalt; Listen namens „… <Zahl>" bekommen die Zahl als römische Ziffer
- Jede Themen-Übersicht beginnt mit `.topic-head` (große Überschrift + `#topic-info`, gesetzt mit `App.setTopicInfo`)
- Alle Latein-Eingaben: `autocorrect="off" autocapitalize="off" spellcheck="false"`
- Alles, was aus der Datenbank in HTML landet, durch `escHtml()` schicken
- Mäanderband am Seitenrand (ab 1100 px, `body::before/::after`): bewegt sich beim Scrollen leicht mit (`App._initOrnament` setzt `--sy`/`--sp`), absichtlich unauffällig; dort ist die Scroll-Leiste des Browsers ausgeblendet
- Design nicht ändern: dunkel, Akzent Orange (`--accent`), Schriften Cinzel + Outfit

## Google Analytics
- Measurement ID `G-LY0LGYY3GZ`, im `<head>` jeder `index.html`

## Lokal testen
```bash
browser-sync start --server --files "**/*"
```

## Deployment
```bash
git add .
git commit -m "Beschreibung"
git push origin main
```
Danach `Cmd+Shift+R` im Browser.
