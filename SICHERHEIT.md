# Admin-Login einrichten und Datenbank absichern

Bis jetzt konnte **jeder** die Datenbank lesen und beschreiben, weil die
Firestore-Regeln offen waren und der Login nur im Browser geprüft wurde.
Ab dieser Version läuft der Login über **Firebase Authentication**, und die
Datei `firestore.rules` sperrt alles, was Besucher nichts angeht.

Die Schritte unten musst du **einmal** in der Firebase-Konsole machen
(https://console.firebase.google.com → Projekt `latein-lernen`).
Reihenfolge einhalten: erst Konto anlegen und Login testen, **dann** die Regeln.

Solange du Schritt 1–3 nicht gemacht hast, funktioniert die Seite für Besucher
ganz normal, aber niemand kann sich als Admin einloggen.

---

## 1. Anmeldung mit E-Mail/Passwort einschalten

1. Links **Build → Authentication** öffnen, „Get started" klicken (falls noch nie benutzt).
2. Reiter **Sign-in method** → **E-Mail/Passwort** → aktivieren → Speichern.
   („E-Mail-Link" bleibt aus.)

## 2. Dein Konto anlegen

Admins melden sich auf der Website weiter mit einem **Benutzernamen** an.
Firebase braucht intern eine E-Mail-Adresse; die Website hängt deshalb
automatisch `@latein-lernen.firebaseapp.com` an den Benutzernamen an.
Diese Adresse muss es nicht wirklich geben.

1. **Authentication → Users → Add user**
   - E-Mail: `deinbenutzername@latein-lernen.firebaseapp.com` (z. B. `emil@latein-lernen.firebaseapp.com`, alles klein)
   - Passwort: ein neues, mindestens 6 Zeichen. **Nicht** das alte `latina2024` verwenden.
2. In der Liste steht jetzt dein Konto. Kopiere die **User-UID** (lange Zeichenfolge).

## 3. Dich als Haupt-Admin eintragen

1. **Build → Firestore Database → Daten** → Sammlung `admins` öffnen.
2. **Dokument hinzufügen**
   - Dokument-ID: die kopierte **UID** (genau so, nicht „Auto-ID")
   - Felder:
     | Feld | Typ | Wert |
     |---|---|---|
     | `name` | string | dein Anzeigename, z. B. `Emil` |
     | `username` | string | dein Benutzername, z. B. `emil` |
     | `role` | string | `super` |
3. Jetzt auf der Website ganz unten auf **Admin** klicken und mit Benutzername
   und Passwort einloggen. Oben müssen „Meldungen", ⚙️ und 👤 erscheinen.

Weitere Admins legst du danach direkt auf der Website an: ⚙️ → „Neuen Admin hinzufügen".

## 4. Regeln veröffentlichen

Erst wenn der Login aus Schritt 3 klappt:

1. **Firestore Database → Regeln**
2. Den gesamten Inhalt durch den Inhalt der Datei `firestore.rules` ersetzen.
3. **Veröffentlichen**.
4. Kurz prüfen: ausgeloggt sind die Vokabeln sichtbar; eingeloggt kannst du
   eine Vokabel bearbeiten und die Meldungen-Seite öffnen.

## 5. Alte Daten aufräumen

In der Sammlung `admins` liegen noch die alten Einträge mit Passwort-Hashes.
Lösche dort **alle Dokumente außer denen, die du in Schritt 3 oder über die
Website angelegt hast** – insbesondere:

- `_super` (alter Haupt-Admin mit Passwort-Hash)
- `_config` (enthielt den Anthropic-API-Key – den Key zusätzlich in der Anthropic-Konsole widerrufen)
- alle alten Admin-Einträge mit einem Feld `password`

Nicht mehr gebraucht werden außerdem diese Sammlungen (können gelöscht werden):
`quizes`, `drafts` (alte Einzel-Quize), `sommerferien_users`, `sommerferien_progress`.

---

## Gut zu wissen

- **Passwort ändern:** auf der Website unter 👤 „Mein Konto".
- **Passwort vergessen:** Zurücksetzen per E-Mail geht nicht, weil es die Adresse nicht gibt. Lösche das Konto in der Konsole (Authentication → Users), lege es neu an und trage in `admins` ein Dokument mit der neuen UID ein.
- **Admin entfernen** (⚙️ → Entfernen) nimmt nur die Rechte weg. Das Konto selbst kannst du in der Konsole unter Authentication → Users löschen.
- Der Firebase-`apiKey` in `gemeinsam/firebase.js` ist kein Geheimnis; er darf öffentlich sein. Geschützt wird über die Regeln.
- Jeder kann sich technisch ein Firebase-Konto anlegen, aber ohne Eintrag in `admins` hat es keinerlei Rechte.
