#!/usr/bin/env python3
"""
Exportiert die beiden lokalen SQLite-Wörterbücher (la-lookup.db, de-lookup.db)
in kompakte, nach den ersten 2 Buchstaben gesplittete JSON-Dateien für den
Browser (kein sql.js, keine riesigen Downloads).

Output: data/lookup/la/<shard>.json, data/lookup/de/<shard>.json
Jede Shard-Datei: { "<lookupKey>": [ {pos, klass, gender, forms}, ... ] }
(Array wegen Homonymen, z.B. lat. "liber" = Adjektiv UND Substantiv.)
"""
import sqlite3, json, re, os, unicodedata, sys

LA_DB = "/Users/emilzinkeschool/Desktop/Dictonaries/la-lookup.db"
DE_DB = "/Users/emilzinkeschool/Desktop/Dictonaries/de-lookup.db"
OUT_BASE = "/Users/emilzinkeschool/Library/Mobile Documents/com~apple~CloudDocs/anderes/Codecadamy project/Test/data/lookup"

CASE_TAGS   = {'nominative','genitive','dative','accusative','ablative','vocative'}
NUMBER_TAGS = {'singular','plural'}
GENDER_TAGS = {'masculine','feminine','neuter'}
PERSON_TAGS = {'first-person','second-person','third-person'}
CASE_KEY    = {'nominative':'nom','genitive':'gen','dative':'dat','accusative':'akk','ablative':'abl','vocative':'vok'}
DE_CASE_KEY = {'nominative':'nom','genitive':'gen','dative':'dat','accusative':'akk'}
GENDER_KEY  = {'masculine':'m','feminine':'f','neuter':'n'}
PERSON_NUM_KEY = {
    ('first-person','singular'):'p1sg', ('second-person','singular'):'p2sg', ('third-person','singular'):'p3sg',
    ('first-person','plural'):'p1pl',   ('second-person','plural'):'p2pl',   ('third-person','plural'):'p3pl',
}

def strip_diacritics(s):
    s = unicodedata.normalize('NFD', s)
    return ''.join(c for c in s if not unicodedata.combining(c))

def norm_la(s):
    return strip_diacritics(s).lower()

def fold_ascii(s):
    """Nur für Dateinamen: ä->a usw, damit Shard-Dateien reine ASCII-Namen haben."""
    s = s.lower()
    repl = {'ä':'a','ö':'o','ü':'u','ß':'s'}
    return ''.join(repl.get(c, c) for c in s)

def shard_key(word_norm_for_file):
    k = re.sub(r'[^a-z]', '_', word_norm_for_file[:2])
    return (k + '__')[:2]

def add_multi(cell, key, val):
    if key in cell:
        if val not in cell[key].split('/'):
            cell[key] = cell[key] + '/' + val
    else:
        cell[key] = val

def build_la_verb(forms):
    out = {}
    for f in forms:
        tags = set(f.get('tags') or [])
        if {'active','indicative','present'} <= tags:
            for (p, n), key in PERSON_NUM_KEY.items():
                if p in tags and n in tags:
                    out.setdefault(key, strip_diacritics(f['form']))
    return out if len(out) == 6 else None

def build_la_noun(forms):
    sg, pl = {}, {}
    for f in forms:
        tags = set(f.get('tags') or [])
        cases = tags & CASE_TAGS
        nums  = tags & NUMBER_TAGS
        if len(cases) == 1 and len(nums) == 1 and len(tags) == 2:
            c = CASE_KEY[next(iter(cases))]
            n = next(iter(nums))
            target = sg if n == 'singular' else pl
            add_multi(target, c, strip_diacritics(f['form']))
    if not sg and not pl:
        return None
    return {'sg': sg, 'pl': pl}

def build_la_adj(forms):
    out = {g: {'sg': {}, 'pl': {}} for g in GENDER_KEY.values()}
    found = False
    for f in forms:
        tags = set(f.get('tags') or [])
        cases   = tags & CASE_TAGS
        nums    = tags & NUMBER_TAGS
        genders = tags & GENDER_TAGS
        if len(cases) == 1 and len(nums) == 1 and genders and len(tags) == 2 + len(genders):
            c = CASE_KEY[next(iter(cases))]
            n = next(iter(nums))
            form_clean = strip_diacritics(f['form'])
            nk = 'sg' if n == 'singular' else 'pl'
            for g in genders:
                add_multi(out[GENDER_KEY[g]][nk], c, form_clean)
                found = True
    return out if found else None

def extract_la_infinitive(forms):
    for f in forms:
        tags = set(f.get('tags') or [])
        if tags == {'infinitive','present'}:
            return strip_diacritics(f['form'])
    return None

def export_latin():
    con = sqlite3.connect(LA_DB)
    rows = con.execute("select id, word, pos, klass, gloss, forms_json from lemmas").fetchall()
    shards = {}
    n_ok, n_skip = 0, 0
    for id_, word, pos, klass, gloss, fj in rows:
        try:
            forms = json.loads(fj) if fj else []
        except Exception:
            forms = []
        entry = None
        if pos == 'verb':
            fdata = build_la_verb(forms)
            if fdata:
                entry = {'pos': 'verb', 'klass': klass or None, 'forms': fdata}
        elif pos == 'noun':
            fdata = build_la_noun(forms)
            if fdata:
                entry = {'pos': 'noun', 'klass': klass or None, 'forms': fdata}
        elif pos == 'adj':
            fdata = build_la_adj(forms)
            if fdata:
                entry = {'pos': 'adj', 'klass': klass or None, 'forms': fdata}
        if not entry:
            n_skip += 1
            continue
        n_ok += 1
        word_n = norm_la(word)
        keys = {word_n}
        if pos == 'verb':
            inf = extract_la_infinitive(forms)
            if inf:
                keys.add(norm_la(inf))
        for k in keys:
            sk = shard_key(k)
            shards.setdefault(sk, {}).setdefault(k, []).append(entry)
    write_shards(shards, os.path.join(OUT_BASE, 'la'))
    print(f"Latein: {n_ok} Lemmata exportiert, {n_skip} ohne brauchbare Formen übersprungen, {len(shards)} Shards")

def build_de_noun(forms):
    sg, pl = {}, {}
    for f in forms:
        tags = set(f.get('tags') or [])
        cases = tags & set(DE_CASE_KEY.keys())
        nums  = tags & NUMBER_TAGS
        if len(cases) == 1 and len(nums) == 1 and len(tags) == 2:
            c = DE_CASE_KEY[next(iter(cases))]
            n = next(iter(nums))
            target = sg if n == 'singular' else pl
            add_multi(target, c, f['form'])
    if not sg and not pl:
        return None
    return {'sg': sg, 'pl': pl}

PRONOUN_STRIP = re.compile(r'^(ich|du|er/sie/es|wir|ihr|sie)\s+')

def build_de_verb(forms):
    out = {}
    for f in forms:
        tags = set(f.get('tags') or [])
        if {'active','indicative','present'} <= tags:
            for (p, n), key in PERSON_NUM_KEY.items():
                if p in tags and n in tags and key not in out:
                    out[key] = PRONOUN_STRIP.sub('', f['form'])
    if len(out) == 6:
        return out
    # Fallback für Verben ohne vollständig getaggte Präsensform:
    # bare ['present']-Formen erscheinen in fester Reihenfolge ich/du/er.
    bare_present = [f['form'] for f in forms if set(f.get('tags') or []) == {'present'}]
    if len(bare_present) < 3:
        return None
    out = {'p1sg': bare_present[0], 'p2sg': bare_present[1], 'p3sg': bare_present[2]}
    # wir/sie (Präsens Plural 1./3.) sind im Deutschen immer identisch mit dem Infinitiv.
    infinitive = None
    for f in forms:
        tags = set(f.get('tags') or [])
        if 'infinitive' in tags and 'present' in tags and 'extended' not in tags and 'perfect' not in tags:
            infinitive = f['form']
            break
    # ihr (Präsens Plural 2.) ist im Deutschen immer identisch mit dem Imperativ Plural.
    imp_plural = None
    for f in forms:
        tags = set(f.get('tags') or [])
        if 'imperative' in tags and 'plural' in tags and set(f.get('tags') or []) == {'imperative','plural'}:
            imp_plural = f['form'].rstrip('!')
            break
    if not infinitive or not imp_plural:
        return None
    out['p1pl'] = infinitive
    out['p2pl'] = imp_plural
    out['p3pl'] = infinitive
    return out

def export_german():
    con = sqlite3.connect(DE_DB)
    rows = con.execute("select id, word, pos, klass, gender, forms_json from lemmas").fetchall()
    shards = {}
    n_ok, n_skip = 0, 0
    for id_, word, pos, klass, gender, fj in rows:
        try:
            forms = json.loads(fj) if fj else []
        except Exception:
            forms = []
        entry = None
        if pos == 'verb':
            fdata = build_de_verb(forms)
            if fdata:
                entry = {'pos': 'verb', 'forms': fdata}
        elif pos == 'noun':
            fdata = build_de_noun(forms)
            if fdata and gender in GENDER_KEY:
                entry = {'pos': 'noun', 'gender': GENDER_KEY[gender], 'forms': fdata}
        if not entry:
            n_skip += 1
            continue
        n_ok += 1
        key = word.lower()
        sk = shard_key(fold_ascii(key))
        shards.setdefault(sk, {}).setdefault(key, []).append(entry)
    write_shards(shards, os.path.join(OUT_BASE, 'de'))
    print(f"Deutsch: {n_ok} Lemmata exportiert, {n_skip} ohne brauchbare Formen übersprungen, {len(shards)} Shards")

def write_shards(shards, outdir):
    os.makedirs(outdir, exist_ok=True)
    for sk, data in shards.items():
        path = os.path.join(outdir, sk + '.json')
        with open(path, 'w', encoding='utf-8') as fh:
            json.dump(data, fh, ensure_ascii=False, separators=(',', ':'))

if __name__ == '__main__':
    export_latin()
    export_german()
