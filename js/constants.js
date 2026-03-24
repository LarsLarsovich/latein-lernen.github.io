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
