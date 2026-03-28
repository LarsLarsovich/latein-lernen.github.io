'use strict';

const Matching = {
  _allPairs:    [],
  _originalRows: [],
  _currentPairs: [],
  _offset:      0,
  _solved:      0,
  _errors:      0,
  _startTime:   null,
  _name:        '',
  _selectedLat: null,
  _selectedDe:  null,
  BATCH:        7,

  start(rows, name) {
    if (!rows || !rows.length) { alert('Keine Vokabeln vorhanden.'); return; }
    this._originalRows = rows;
    this._name = name;

    // Paare bauen: nur Zeilen mit lat UND de
    var pairs = [];
    rows.forEach(function(r) {
      var lat = (r.lat || '').trim();
      var de  = (r.de  || '').split('%')[0].replace(/\(.*?\)/g, '').trim();
      if (lat && lat !== '–' && de && de !== '–') pairs.push({ lat: lat, de: de });
    });
    if (!pairs.length) { alert('Keine passenden Vokabeln für die Zuordnungsübung.'); return; }

    this._allPairs = pairs.sort(function() { return Math.random() - 0.5; });
    this._offset      = 0;
    this._solved      = 0;
    this._errors      = 0;
    this._startTime   = Date.now();
    this._selectedLat = null;
    this._selectedDe  = null;

    document.getElementById('match-title').textContent = name;
    document.getElementById('match-result').classList.add('hidden');
    this._renderBatch();
    App.showPage('matching', name);
  },

  _renderBatch() {
    var batch = this._allPairs.slice(this._offset, this._offset + this.BATCH);
    this._currentPairs = batch;
    this._selectedLat  = null;
    this._selectedDe   = null;

    // Fortschritt
    document.getElementById('match-progress').textContent =
      Math.min(this._offset, this._allPairs.length) + ' / ' + this._allPairs.length;

    // Gemischte Reihenfolge für rechte Spalte
    var deOrder = batch.map(function(_, i) { return i; })
                       .sort(function() { return Math.random() - 0.5; });

    var latCol = document.getElementById('match-col-lat');
    var deCol  = document.getElementById('match-col-de');

    latCol.innerHTML = batch.map(function(p, i) {
      return '<button class="match-btn match-btn-lat" onclick="Matching.selectLat(' + i + ',this)">' +
             escHtml(p.lat) + '</button>';
    }).join('');

    deCol.innerHTML = deOrder.map(function(origIdx) {
      var p = batch[origIdx];
      return '<button class="match-btn match-btn-de" onclick="Matching.selectDe(' + origIdx + ',this)">' +
             escHtml(p.de) + '</button>';
    }).join('');
  },

  selectLat(idx, btn) {
    document.querySelectorAll('.match-btn-lat.selected').forEach(function(b) { b.classList.remove('selected'); });
    this._selectedLat = { idx: idx, btn: btn };
    btn.classList.add('selected');
    this._tryMatch();
  },

  selectDe(origIdx, btn) {
    document.querySelectorAll('.match-btn-de.selected').forEach(function(b) { b.classList.remove('selected'); });
    this._selectedDe = { idx: origIdx, btn: btn };
    btn.classList.add('selected');
    this._tryMatch();
  },

  _tryMatch() {
    if (!this._selectedLat || !this._selectedDe) return;
    var latIdx = this._selectedLat.idx;
    var deIdx  = this._selectedDe.idx;
    var latBtn = this._selectedLat.btn;
    var deBtn  = this._selectedDe.btn;

    if (latIdx === deIdx) {
      // Richtig
      latBtn.classList.add('match-correct');
      deBtn.classList.add('match-correct');
      latBtn.disabled = true;
      deBtn.disabled  = true;
      this._solved++;
      this._selectedLat = null;
      this._selectedDe  = null;

      // Batch fertig?
      var solved = document.querySelectorAll('.match-btn:disabled').length / 2;
      if (solved >= this._currentPairs.length) {
        this._offset += this.BATCH;
        var self = this;
        if (this._offset >= this._allPairs.length) {
          setTimeout(function() { self._showResult(); }, 500);
        } else {
          setTimeout(function() { self._renderBatch(); }, 500);
        }
      }
    } else {
      // Falsch
      this._errors++;
      latBtn.classList.add('match-wrong');
      deBtn.classList.add('match-wrong');
      var self = this;
      setTimeout(function() {
        latBtn.classList.remove('match-wrong', 'selected');
        deBtn.classList.remove('match-wrong', 'selected');
        self._selectedLat = null;
        self._selectedDe  = null;
      }, 650);
    }
  },

  _showResult() {
    var elapsed = Math.round((Date.now() - this._startTime) / 1000);
    var mins    = Math.floor(elapsed / 60);
    var secs    = elapsed % 60;
    var timeStr = mins > 0
      ? mins + ':' + (secs < 10 ? '0' : '') + secs + ' min'
      : secs + ' Sek.';
    document.getElementById('match-result-time').textContent   = timeStr;
    document.getElementById('match-result-errors').textContent = this._errors;
    document.getElementById('match-result').classList.remove('hidden');
  },

  restart() {
    this.start(this._originalRows, this._name);
  }
};
