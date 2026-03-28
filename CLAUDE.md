# Latein-Lernplattform

## Projekt-Übersicht
Latein-Lernwebsite für Schüler. Gebaut mit Vanilla JS, HTML, CSS und Firebase Firestore als Backend. Deployed auf GitHub Pages.

- **Live-URL:** https://larslarsovich.github.io/latein-lernen.github.io/
- **GitHub Repo:** LarsLarsovich/latein-lernen.github.io
- **Firebase Projekt:** `latein-lernen` (projectId)
- **Kontakt:** e.zinke@grg7.at

---

## Architektur

### Frontend
- Vanilla JS (kein Build-Tool, kein Framework)
- Alle JS-Dateien im `js/` Ordner, werden einzeln in `index.html` geladen
- Kein `script.js` mehr – alles aufgeteilt

### Dateistruktur
```
index.html          # Haupt-HTML, alle Seiten als <main id="page-xxx">
style.css           # Gesamtes Styling
js/
  firebase.js       # Firebase Config + COL collections
  constants.js      # CASES, GENDERS, GENUS_OPTS, DEKL_OPTS
  state.js          # Globaler App-State
  utils.js          # escHtml, hashPassword, parseAnswers, isCorrect, diffHighlight
  grammar.js        # German + Latin Grammatik-Engines (declineNoun, conjugateVerb etc.)
  quiz-engine.js    # Quiz + VokabelQuiz (Spaced Repetition)
  report.js         # Fehler-Meldesystem
  vok-detail.js     # Vokabel-Detailansicht + Override-Editor
  tables.js         # Tabellen-Ansicht + VokSearch
  app.js            # Navigation, Login, Admin, Quiz-Flow, Götter-Actions
  goetter.js        # Götter-Seite, Detail, Editor
  grammar-tables.js # Statische Deklinationen + Konjugationen mit YouTube-Videos
CLAUDE.md           # Diese Datei
```

---

## Firebase Collections
| Collection | Inhalt |
|---|---|
| `quizes` | Veröffentlichte Pronomen-Quize |
| `drafts` | Entwürfe Pronomen-Quize |
| `tables_pronomen` | Pronomen-Tabellen |
| `tables_vokabel` | Vokabel-Listen |
| `drafts_pronomen` | Entwürfe Pronomen-Tabellen |
| `drafts_vokabel` | Entwürfe Vokabel-Listen |
| `reports` | Fehlermeldungen von Nutzern |
| `admins` | Admin-Accounts (SHA-256 Passwörter) |
| `goetter` | Götter (Name, Symbol, Bereiche, Foto etc.) |

---

## Admin-System
- **Login:** Benutzername + Passwort (kein Firebase Auth, bewusste Entscheidung)
- **Super-Admin:** user=`admin`, pass=`latina2024` (in SUPER_ADMIN const, überschreibbar via Firebase `admins/_super`)
- Passwörter als SHA-256-Hash gespeichert, automatische Migration von Klartext
- Admin-Session wird in `sessionStorage` gespeichert (bleibt nach Reload)
- Glocken-Badge (🔔) für ungelesene Meldungen

---

## Navigation
- `App.showPage(id, name)` – navigiert zu einer Seite, speichert `_prevPage`
- `App.goBack()` – geht einen Schritt zurück
- `App.goHome()` – immer zur Startseite (Logo oben links)
- Seiten-IDs: `home`, `quiz`, `result`, `setup`, `table-view`, `alle-vokabeln`, `vok-detail`, `goetter`, `gott-detail`, `gott-editor`, `gt-deklinationen`, `gt-konjugationen`, `impressum`, ...

---

## Quiz-System
- **Spaced Repetition:** Falsche Antworten kommen nach 5 anderen wieder (kein Rundenbasiertes System)
- **Prüfungsmodus:** Checkbox im Setup, keine Wiederholung
- **Diff-Highlighting:** Falsche Buchstaben werden farbig markiert
- **Kreisdiagramm** am Ende zeigt Versuch-Verteilung
- **Fortschrittsbalken:** zeigt `_done / total`

### Antwort-Parsing (utils.js)
- `wieder(um)` → akzeptiert `wieder` und `wiederum`
- `gehen (+Dat.)` → Annotation wird ignoriert, nur `gehen` gilt
- `esse%est` → beide Formen akzeptiert
- `%` als Trennzeichen für mehrere gültige Antworten
- Latein-Genitiv: Suffix-Matching (`inis` matcht `fluminis`)

---

## Vokabeln
- Format: `lat-fall2-genus-dekl-übersetzung` (mit `%` für mehrere Formen)
- Genus: `m.`, `f.`, `n.`, `–`
- Deklination: `1. Dekl.` bis `5. Dekl.`, `–`
- Admin kann Formen manuell überschreiben (Override)
- **Alle Vokabeln Quiz:** Slider für Anzahl, zufällig ausgewählt
- **Eigenes Quiz:** Mehrere Listen auswählen

---

## Götter
- Firebase Collection: `goetter`
- Felder: `nameRom`, `nameGre`, `symbol` (Emoji), `bereiche[]`, `symbole[]`, `beschreibung`, `fakten[]`, `eltern`, `kinder`, `fotoUrl`, `fotoQuelle`
- Stammbaum: Miro-Embed direkt in Götter-Seite (height=320px fix)

---

## Grammatik-Tafeln
- Statische Seiten (kein Firebase)
- Deklinationen: 1.–5. Dekl. mit Beispielwörtern + YouTube-Videos rechts daneben
- Konjugationen: 1.–4. Konjugation + esse
- Endungen orange markiert (`.gt-ending`), Stamm normal (`.gt-stem`)
- Layout: Tabelle links (780px), Video rechts (449px × 320px, 16:9)

---

## Wichtige Patterns

### Neues Feature hinzufügen
1. HTML-Seite in `index.html` als `<main id="page-xxx">` anlegen
2. Logik in passendem JS-File oder neue Datei im `js/` Ordner
3. Script-Tag in `index.html` hinzufügen
4. `window.MeinObjekt = MeinObjekt` im inline `<script>` am Ende
5. Bei Bedarf `App.showPage('xxx', 'Titel')` aufrufen

### Autocorrect deaktiviert
Alle Inputs haben `autocorrect="off" autocapitalize="off" spellcheck="false"` – Latein würde sonst korrigiert werden.

### Keine externen Libraries
Nur Firebase SDK (compat Version) und Google Fonts. Kein React, kein Vue, kein Build-Tool.

---

## Google Analytics
- Measurement ID: `G-LY0LGYY3GZ`
- Tag ist im `<head>` von `index.html` eingebaut

---

## Deployment
```bash
git add .
git commit -m "Beschreibung"
git push origin main
```
Danach auf GitHub Pages: `Cmd+Shift+R` im Browser um Cache zu leeren.
