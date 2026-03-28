'use strict';

const Print = {
  URL:  'larslarsovich.github.io/latein-lernen.github.io',

  _date() {
    return new Date().toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  },

  _css() {
    var CA  = '#e07b2a';   /* Akzentfarbe orange */
    var CA2 = '#f5e8d8';   /* helles Crème für Tabellen-Header */
    var CA3 = '#e8d5be';   /* Rahmenfarbe warm */
    var CT  = '#1c1208';   /* Haupttext dunkel-warm */
    var CT2 = '#7a4f22';   /* Sekundärtext warm-braun */
    var PAD = '3px 9px';   /* kompakte Zellen */
    var EXA = '-webkit-print-color-adjust:exact;print-color-adjust:exact;';

    return (
      /* ── Seite ── */
      '@page{size:A4;margin:13mm 14mm 12mm 14mm;' +
      '@bottom-right{content:"Seite " counter(page) " / " counter(pages);' +
      'font-family:Outfit,sans-serif;font-size:7pt;color:' + CT2 + ';}}' +

      '*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}' +
      'body{font-family:Outfit,sans-serif;font-size:8.5pt;color:' + CT + ';background:#fff;line-height:1.45;}' +

      /* ── Orangebalken ganz oben (wie die Karten auf der Website) ── */
      'body::before{content:"";position:fixed;top:0;left:0;right:0;height:2.5pt;background:' + CA + ';' + EXA + '}' +

      /* ── Kopfzeile ── */
      '.ph{position:fixed;top:2.5pt;left:0;right:0;height:13mm;' +
      'display:flex;align-items:center;justify-content:space-between;' +
      'padding-bottom:2mm;border-bottom:1pt solid ' + CA3 + ';background:#fff;}' +

      '.ph-logo{font-family:Cinzel,serif;font-size:13pt;font-weight:700;' +
      'color:' + CA + ';letter-spacing:0.15em;' + EXA + '}' +
      '.ph-logo-b{color:' + CT + ';' + EXA + '}' +

      '.ph-title{font-family:Cinzel,serif;font-size:9.5pt;font-weight:600;' +
      'color:' + CT + ';letter-spacing:0.08em;text-align:center;}' +

      '.ph-spacer{flex:0 0 88pt;}' +

      /* ── Fußzeile ── */
      '.pf{position:fixed;bottom:0;left:0;right:0;height:9mm;' +
      'display:flex;align-items:flex-start;justify-content:space-between;' +
      'padding-top:2mm;border-top:0.5pt solid ' + CA3 + ';background:#fff;' +
      'font-size:6.5pt;color:' + CT2 + ';}' +

      /* ── Inhaltsbereich ── */
      '.body{padding-top:16mm;padding-bottom:11mm;}' +

      /* ── Abschnittstitel (Alle Vokabeln / mehrere Listen) ── */
      '.ps{margin-bottom:5mm;}' +
      '.ps-title{font-family:Cinzel,serif;font-size:10pt;font-weight:600;' +
      'color:' + CA + ';letter-spacing:0.06em;' +
      'padding-bottom:1.5mm;margin-bottom:2mm;border-bottom:1.5pt solid ' + CA + ';' + EXA + '}' +
      '.ps-desc{font-size:7.5pt;color:' + CT2 + ';margin-bottom:1.5mm;}' +

      /* ── Tabellen (Vokabeln) ── */
      '.tw{border-radius:4pt;overflow:hidden;box-shadow:0 0 0 0.5pt ' + CA3 + ';' + EXA + 'margin:0 2pt;}' +
      'table{width:100%;border-collapse:collapse;font-size:8.5pt;}' +
      'thead tr{background:' + CA2 + ';' + EXA + '}' +
      'th{padding:' + PAD + ';color:' + CT2 + ';font-size:6.5pt;font-weight:600;' +
      'text-align:left;text-transform:uppercase;letter-spacing:0.09em;' +
      'border-bottom:0.5pt solid ' + CA3 + ';background:' + CA2 + ';' + EXA + '}' +
      'td{padding:' + PAD + ';border-bottom:0.5pt solid #f0e6d8;color:' + CT + ';}' +
      'tbody tr:last-child td{border-bottom:none;}' +
      '.vok-row-arrow,.vok-table-hint{display:none;}' +

      /* ── Pronomen-Tabellen (dekl-table) ── */
      '.table-desc{font-size:7.5pt;color:' + CT2 + ';margin-bottom:2mm;}' +
      '.forms-section-title{font-family:Cinzel,serif;font-size:7.5pt;font-weight:600;' +
      'color:' + CT2 + ';text-transform:uppercase;letter-spacing:0.1em;margin:3mm 0 1mm;}' +
      '.dekl-table-wrap{overflow:hidden;border-radius:4pt;box-shadow:0 0 0 0.5pt ' + CA3 + ';' + EXA + 'margin:0 2pt;}' +
      '.dekl-table{width:100%;border-collapse:collapse;font-size:8.5pt;}' +
      '.dekl-table thead tr{background:' + CA2 + ';' + EXA + '}' +
      '.dekl-table th{padding:' + PAD + ';color:' + CT2 + ';font-size:6.5pt;font-weight:600;' +
      'text-align:left;text-transform:uppercase;letter-spacing:0.09em;' +
      'border-bottom:0.5pt solid ' + CA3 + ';background:' + CA2 + ';' + EXA + '}' +
      '.dekl-table td{padding:' + PAD + ';border-bottom:0.5pt solid #f0e6d8;color:' + CT + ';}' +
      '.dekl-table tbody tr:last-child td{border-bottom:none;}' +
      '.case-cell{color:' + CT2 + ';font-weight:500;font-size:7.5pt;}' +

      /* ── Grammatik-Tafeln ── */
      '.gt-section{margin-bottom:5mm;}' +
      '.gt-section-title{font-family:Cinzel,serif;font-size:9pt;font-weight:600;' +
      'color:' + CT + ';letter-spacing:0.05em;margin:4mm 0 1.5mm;}' +
      '.gt-example{font-size:7.5pt;color:' + CT2 + ';margin-left:6px;font-style:italic;}' +
      '.gt-stem{color:' + CT + ';}' +
      '.gt-ending{color:' + CA + ';font-weight:700;' + EXA + '}' +
      '.gt-video-side{display:none;}' +
      '.gt-row{display:block;}' +
      '.gt-table-side{display:block;width:auto;}' +
      '.gt-table{width:100%;border-collapse:collapse;font-size:8.5pt;}'
    );
  },

  _open(title, bodyHtml) {
    var win = window.open('', '_blank');
    if (!win) {
      alert('Popup-Blocker aktiv – bitte für diese Seite erlauben.');
      return;
    }

    var date = this._date();
    var url  = this.URL;
    var css  = this._css();

    win.document.write(
      '<!DOCTYPE html><html lang="de"><head>' +
      '<meta charset="UTF-8">' +
      '<title>' + escHtml(title) + ' \u2013 LateinPlatform</title>' +
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Outfit:wght@300;400;500;600&display=swap">' +
      '<style>' + css + '</style>' +
      '</head><body>' +
      '<div class="ph">' +
        '<span class="ph-logo">Latein<span class="ph-logo-b">Platform</span></span>' +
        '<span class="ph-title">' + escHtml(title) + '</span>' +
        '<span class="ph-spacer"></span>' +
      '</div>' +
      '<div class="body">' + bodyHtml + '</div>' +
      '<div class="pf">' +
        '<span>' + url + '</span>' +
        '<span>Abrufdatum: ' + date + '</span>' +
      '</div>' +
      '</body></html>'
    );
    win.document.close();

    // Warten bis Schriften geladen sind, dann drucken
    if (win.document.fonts && win.document.fonts.ready) {
      win.document.fonts.ready.then(function() { win.print(); });
    } else {
      win.onload = function() { win.print(); };
    }
  },

  // ── Einzelne Tabelle (Pronomen oder Vokabeln) ─────────────────
  tableView() {
    var title   = document.getElementById('table-view-title').textContent;
    var content = document.getElementById('table-view-content').innerHTML;
    this._open(title, '<div class="ps">' + content + '</div>');
  },

  // ── Alle Vokabeln: jede Liste mit Überschrift ─────────────────
  alleVokabeln() {
    var tables = state.vokabel.slice().sort(function(a, b) {
      return a.name.localeCompare(b.name, 'de', { numeric: true, sensitivity: 'base' });
    });
    if (!tables.length) { alert('Keine Vokabeln vorhanden.'); return; }

    var html = tables.map(function(t) {
      var rows = (t.rows || []).map(function(r) {
        var de = (r.de || '\u2013').split('%').join(' / ');
        return '<tr>' +
          '<td><strong>' + escHtml(r.lat   || '\u2013') + '</strong></td>' +
          '<td>'         + escHtml(r.fall2 || '\u2013') + '</td>' +
          '<td>'         + escHtml(r.genus || '\u2013') + '</td>' +
          '<td>'         + escHtml(r.dekl  || '\u2013') + '</td>' +
          '<td>'         + escHtml(de)                  + '</td>' +
          '</tr>';
      }).join('');
      return '<div class="ps">' +
        '<div class="ps-title">' + escHtml(t.name) + '</div>' +
        (t.desc ? '<div class="ps-desc">' + escHtml(t.desc) + '</div>' : '') +
        '<div class="tw"><table>' +
        '<thead><tr><th>Latein</th><th>2. Fall</th><th>Genus</th><th>Dekl.</th><th>\xDCbersetzung</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div>' +
        '</div>';
    }).join('');

    this._open('Alle Vokabeln', html);
  },

  // ── Deklinationen ─────────────────────────────────────────────
  deklinationen() {
    var content = document.getElementById('gt-dekl-content').innerHTML;
    this._open('Deklinationen', '<div class="ps">' + content + '</div>');
  },

  // ── Konjugationen ─────────────────────────────────────────────
  konjugationen() {
    var content = document.getElementById('gt-konj-content').innerHTML;
    this._open('Konjugationen', '<div class="ps">' + content + '</div>');
  }
};
