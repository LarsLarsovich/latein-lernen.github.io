'use strict';

// ── Grammatik-Tafeln: gemeinsame Bausteine ────────────────────
// Deklinationen und Konjugationen sind feste Tafeln (keine Datenbank).
// Hier stehen nur die Hilfsfunktionen; der Inhalt steht im jeweiligen Themenordner.
const GrammarTables = {

  _hl(stem, ending) {
    if (!ending) return '<span class="gt-stem">' + escHtml(stem) + '</span>';
    return '<span class="gt-stem">' + escHtml(stem) + '</span><span class="gt-ending">' + escHtml(ending) + '</span>';
  },

  _row(label, sg, pl) {
    return '<tr><td class="case-cell">' + escHtml(label) + '</td><td>' + sg + '</td><td>' + pl + '</td></tr>';
  },



  _section(title, example, rows, videoId, videoTitle) {
    const tableHtml = '<div class="dekl-table-wrap gt-table-side"><table class="dekl-table gt-table">' +
      '<thead><tr><th>Kasus</th><th>Singular</th><th>Plural</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>';
    const videoHtml = videoId
      ? '<div class="gt-video-side"><iframe src="https://www.youtube.com/embed/' + videoId +
        '" title="' + escHtml(videoTitle || title) + '" frameborder="0" ' +
        'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" ' +
        'referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>'
      : '';
    return '<div class="gt-section">' +
      '<div class="gt-section-title">' + escHtml(title) +
        '<span class="gt-example">Beispiel: <em>' + escHtml(example) + '</em></span></div>' +
      '<div class="gt-row">' + tableHtml + videoHtml + '</div>' +
    '</div>';
  },

  // Einfache Konjugations-Sektion: nur Präsens
  _konjSection(title, example, rows) {
    return '<div class="gt-section">' +
      '<div class="gt-section-title">' + escHtml(title) +
        '<span class="gt-example">Beispiel: <em>' + escHtml(example) + '</em></span></div>' +
      '<div class="dekl-table-wrap"><table class="dekl-table gt-table">' +
        '<thead><tr><th>Person</th><th>Form</th></tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table></div></div>';
  },

  // Hilfsmethode: eine Zeitmorphologie-Tabelle (Perfekt / PQP)
  _zeitTable(label, deLabel, stem, endings, self) {
    return '<div class="gt-tense-title">' + escHtml(label) +
      '<span class="gt-tense-de">' + escHtml(deLabel) + '</span></div>' +
      '<div class="dekl-table-wrap"><table class="dekl-table gt-table">' +
        '<thead><tr><th>Person</th><th>Form</th></tr></thead><tbody>' +
        ['1. Sg. (ich)','2. Sg. (du)','3. Sg. (er/sie/es)','1. Pl. (wir)','2. Pl. (ihr)','3. Pl. (sie)']
          .map(function(p,i){
            return '<tr><td class="case-cell">' + escHtml(p) + '</td><td>' + self._hl(stem, endings[i]) + '</td></tr>';
          }).join('') +
      '</tbody></table></div>';
  },

  // Match each video height to its sibling table height
  _syncVideoHeights(container) {
    requestAnimationFrame(function() {
      const rows = container.querySelectorAll('.gt-row');
      rows.forEach(function(row) {
        const table = row.querySelector('.gt-table-side');
        const video = row.querySelector('.gt-video-side');
        if (!table || !video) return;
        const h = table.offsetHeight;
        if (h > 0) {
          video.style.height = h + 'px';
          video.style.width  = (h * 16 / 9) + 'px';
        }
      });
    });
  }
};
