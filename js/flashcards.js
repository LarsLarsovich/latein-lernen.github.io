'use strict';

const Flashcards = {
  _cards:        [],
  _originalRows: [],
  _idx:          0,
  _name:         '',
  _busy:         false,
  _direction:    'lat-de', // 'lat-de' or 'de-lat'
  _ANIM_MS:      460,      // slightly longer than the 0.45s CSS transition

  // Called from App.selectQuizMode('flashcards') — shows setup screen
  start(rows, name) {
    if (!rows || !rows.length) { alert('Keine Vokabeln vorhanden.'); return; }
    this._originalRows = rows;
    this._name = name;

    document.getElementById('fc-title').textContent = name;

    // Reset setup controls to defaults
    var radios = document.querySelectorAll('input[name="fc-direction"]');
    radios.forEach(function(r) { r.checked = (r.value === 'lat-de'); });
    document.getElementById('fc-shuffle').checked = true;

    // Show setup, hide cards
    document.getElementById('fc-setup-wrap').classList.remove('hidden');
    document.getElementById('fc-cards-wrap').classList.add('hidden');
    document.getElementById('fc-progress').textContent = '';

    App.showPage('flashcards', name);
  },

  // Called by the Start button inside the setup screen
  startWithConfig() {
    var dirEl = document.querySelector('input[name="fc-direction"]:checked');
    this._direction = dirEl ? dirEl.value : 'lat-de';
    var shuffle = document.getElementById('fc-shuffle').checked;

    var rows = shuffle
      ? [...this._originalRows].sort(function() { return Math.random() - 0.5; })
      : [...this._originalRows];
    this._cards = rows;
    this._idx   = 0;
    this._busy  = false;

    // Update face labels
    if (this._direction === 'lat-de') {
      document.getElementById('fc-front-hint').textContent = 'Latein';
      document.getElementById('fc-back-hint').textContent  = 'Deutsch';
    } else {
      document.getElementById('fc-front-hint').textContent = 'Deutsch';
      document.getElementById('fc-back-hint').textContent  = 'Latein';
    }

    document.getElementById('fc-done-overlay').classList.add('hidden');
    document.getElementById('fc-setup-wrap').classList.add('hidden');
    document.getElementById('fc-cards-wrap').classList.remove('hidden');

    this._renderFull();
  },

  // Builds {front, back} HTML for the current card based on direction
  _getContent(r) {
    var extras = [];
    if (r.fall2 && r.fall2 !== '–' && r.fall2 !== '#') extras.push(escHtml(r.fall2));
    if (r.genus && r.genus !== '–' && r.genus !== '#') extras.push(escHtml(r.genus));
    if (r.dekl  && r.dekl  !== '–' && r.dekl  !== '#') extras.push(escHtml(r.dekl));
    var latHtml = '<div class="fc-word">' + escHtml(r.lat || '–') + '</div>' +
      (extras.length ? '<div class="fc-meta">' + extras.join(' · ') + '</div>' : '');

    var de = (r.de || '–').split('%').map(function(s) { return s.trim(); }).join(', ');
    var deHtml = '<div class="fc-word">' + escHtml(de) + '</div>';

    return this._direction === 'lat-de'
      ? { front: latHtml, back: deHtml }
      : { front: deHtml, back: latHtml };
  },

  // Renders front + back immediately and resets flip — use when NOT mid-animation
  _renderFull() {
    var r       = this._cards[this._idx];
    var content = this._getContent(r);

    document.getElementById('fc-progress').textContent =
      (this._idx + 1) + ' / ' + this._cards.length;
    document.getElementById('fc-front-content').innerHTML = content.front;
    document.getElementById('fc-back-content').innerHTML  = content.back;
    document.getElementById('fc-card').classList.remove('flipped');
    this._updateButtons();
  },

  _updateButtons() {
    document.getElementById('fc-prev-btn').disabled =
      (this._idx === 0) || this._busy;
    document.getElementById('fc-next-btn').disabled = this._busy;
    document.getElementById('fc-next-btn').textContent =
      this._idx === this._cards.length - 1 ? 'Fertig ✓' : 'Weiter →';
  },

  _setBusy(busy) {
    this._busy = busy;
    this._updateButtons();
  },

  flip() {
    if (this._busy) return;
    document.getElementById('fc-card').classList.toggle('flipped');
  },

  prev() {
    if (this._busy || this._idx <= 0) return;
    this._navigate(-1);
  },

  next() {
    if (this._busy) return;
    if (this._idx === this._cards.length - 1) {
      document.getElementById('fc-done-overlay').classList.remove('hidden');
      return;
    }
    this._navigate(1);
  },

  // Shared navigation: handles animation delay when card is on back (flipped) side
  _navigate(delta) {
    var card    = document.getElementById('fc-card');
    var flipped = card.classList.contains('flipped');
    this._idx  += delta;
    var self    = this;
    var content = this._getContent(this._cards[this._idx]);

    if (flipped) {
      this._setBusy(true);
      // Update front immediately — it's invisible while the card is flipped
      document.getElementById('fc-front-content').innerHTML = content.front;
      // Flip card back to front (animation starts)
      card.classList.remove('flipped');
      // Only update back (German/Latein) after animation completes
      setTimeout(function() {
        document.getElementById('fc-back-content').innerHTML = content.back;
        document.getElementById('fc-progress').textContent =
          (self._idx + 1) + ' / ' + self._cards.length;
        self._setBusy(false);
      }, self._ANIM_MS);
    } else {
      this._renderFull();
    }
  },

  // Restart keeps the current direction/shuffle settings
  restart() {
    this.startWithConfig();
  },

  _initKeyboard() {
    var self = this;
    window.addEventListener('keydown', function(e) {
      var page      = document.getElementById('page-flashcards');
      var cardsWrap = document.getElementById('fc-cards-wrap');
      if (!page || page.classList.contains('hidden')) return;
      if (!cardsWrap || cardsWrap.classList.contains('hidden')) return;
      var overlay = document.getElementById('fc-done-overlay');
      if (overlay && !overlay.classList.contains('hidden')) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        self.flip();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        self.next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        self.prev();
      }
    });
  }
};

Flashcards._initKeyboard();
