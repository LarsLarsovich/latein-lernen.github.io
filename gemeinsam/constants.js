'use strict';

// ── Grammatik-Konstanten ──────────────────────────────────────
const CASES        = [1, 2, 3, 4, 6];
const CASE_NAMES   = { 1:'Nominativ', 2:'Genitiv', 3:'Dativ', 4:'Akkusativ', 6:'Ablativ' };
const GENDERS      = ['M', 'W', 'N'];
const GENDER_NAMES = { M:'Maskulinum (m.)', W:'Femininum (f.)', N:'Neutrum (n.)' };
const GENDER_LABEL = { M:'Maskulinum', W:'Femininum', N:'Neutrum' };
const GENDER_CLASS = { M:'m', W:'f', N:'n' };
const GENUS_OPTS   = ['–','m.','f.','n.'];
const DEKL_OPTS    = ['–','1. Dekl.','2. Dekl.','3. Dekl.','4. Dekl.','5. Dekl.'];

// ── Kategorien für Fehlermeldungen ────────────────────────────
// Wird beim Melden ausgewählt; die Meldungen-Seite der Admins ist danach gegliedert.
// Alte Meldungen ohne Kategorie zählen als 'sonstiges'.
const REPORT_CATEGORIES = [
  { id: 'uebersetzung', label: 'Übersetzung',        hint: 'Deutsche Bedeutung ist falsch oder fehlt' },
  { id: 'grundform',    label: 'Lateinisches Wort',  hint: 'Schreibweise, 2. Fall, Geschlecht oder Perfekt stimmt nicht' },
  { id: 'formen',       label: 'Formentabelle',      hint: 'Eine Form in der Deklination oder Konjugation ist falsch' },
  { id: 'quiz',         label: 'Quiz-Auswertung',    hint: 'Richtige Antwort wurde als falsch gewertet (oder umgekehrt)' },
  { id: 'inhalt',       label: 'Grammatik & Kultur', hint: 'Fehler in Tafeln, Pronomina oder bei den Göttern' },
  { id: 'technik',      label: 'Technik & Anzeige',  hint: 'Etwas funktioniert nicht oder wird falsch angezeigt' },
  { id: 'sonstiges',    label: 'Sonstiges',          hint: 'Alles andere' }
];
