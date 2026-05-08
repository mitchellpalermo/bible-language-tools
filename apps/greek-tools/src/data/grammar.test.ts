import { describe, expect, it } from 'vitest';
import {
  accentSections,
  adjParadigms,
  articleForms,
  CASE_DESCRIPTIONS,
  CASE_LABELS,
  CASES,
  GENDER_LABELS,
  GENDERS,
  genderedPronouns,
  getArticle,
  infinitiveForms,
  miVerbEntries,
  miVerbParadigms,
  NUM_LABELS,
  NUMBERS,
  nounParadigms,
  PERSON_FULL_LABELS,
  PERSON_LABELS,
  PERSONS,
  participleParadigms,
  participleRows,
  personalPronouns12,
  prepositions,
  verbParadigms,
} from './grammar';

// ─── grammatical constants ─────────────────────────────────────────────────

describe('grammatical constants', () => {
  it('CASES has all five Greek cases', () => {
    expect(CASES).toEqual(['nom', 'gen', 'dat', 'acc', 'voc']);
  });

  it('NUMBERS has singular and plural', () => {
    expect(NUMBERS).toEqual(['sg', 'pl']);
  });

  it('GENDERS has masculine, feminine, and neuter', () => {
    expect(GENDERS).toEqual(['m', 'f', 'n']);
  });

  it('PERSONS has all six person-number combinations', () => {
    expect(PERSONS).toHaveLength(6);
    expect(PERSONS).toContain('1sg');
    expect(PERSONS).toContain('3pl');
  });
});

// ─── label maps ────────────────────────────────────────────────────────────

describe('label maps', () => {
  it('CASE_LABELS has a label for every case', () => {
    CASES.forEach((c) => {
      expect(CASE_LABELS[c]).toBeTruthy();
    });
  });

  it('CASE_DESCRIPTIONS has a description for every case', () => {
    CASES.forEach((c) => {
      expect(CASE_DESCRIPTIONS[c]).toBeTruthy();
    });
  });

  it('NUM_LABELS has a label for each number', () => {
    NUMBERS.forEach((n) => {
      expect(NUM_LABELS[n]).toBeTruthy();
    });
  });

  it('GENDER_LABELS has a label for each gender', () => {
    GENDERS.forEach((g) => {
      expect(GENDER_LABELS[g]).toBeTruthy();
    });
  });

  it('PERSON_LABELS has a label for each person-number', () => {
    PERSONS.forEach((p) => {
      expect(PERSON_LABELS[p]).toBeTruthy();
    });
  });

  it('PERSON_FULL_LABELS has a full label for each person-number', () => {
    PERSONS.forEach((p) => {
      expect(PERSON_FULL_LABELS[p]).toBeTruthy();
    });
  });
});

// ─── noun paradigms ────────────────────────────────────────────────────────

describe('nounParadigms', () => {
  it('is a non-empty array', () => {
    expect(nounParadigms.length).toBeGreaterThan(0);
  });

  it('every paradigm has a unique id', () => {
    const ids = nounParadigms.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every paradigm has a name, declension, and gender', () => {
    nounParadigms.forEach((p) => {
      expect(p.name).toBeTruthy();
      expect(['1st', '2nd', '3rd']).toContain(p.declension);
      expect(['masculine', 'feminine', 'neuter']).toContain(p.gender);
    });
  });

  it('every paradigm has forms for all cases and numbers', () => {
    nounParadigms.forEach((p) => {
      CASES.forEach((c) => {
        NUMBERS.forEach((n) => {
          expect(p.forms[c][n]).toBeDefined();
          expect(p.forms[c][n].full).toBeTruthy();
        });
      });
    });
  });
});

// ─── adjective paradigms ───────────────────────────────────────────────────

describe('adjParadigms', () => {
  it('is a non-empty array', () => {
    expect(adjParadigms.length).toBeGreaterThan(0);
  });

  it('every paradigm has a unique id', () => {
    const ids = adjParadigms.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every paradigm has all case/number/gender combinations', () => {
    adjParadigms.forEach((p) => {
      CASES.forEach((c) => {
        NUMBERS.forEach((n) => {
          GENDERS.forEach((g) => {
            expect(typeof p.forms[c][n][g]).toBe('string');
          });
        });
      });
    });
  });
});

// ─── verb paradigms ────────────────────────────────────────────────────────

describe('verbParadigms', () => {
  it('is a non-empty array', () => {
    expect(verbParadigms.length).toBeGreaterThan(0);
  });

  it('every paradigm has a unique id', () => {
    const ids = verbParadigms.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every paradigm has a label and group', () => {
    verbParadigms.forEach((p) => {
      expect(p.label).toBeTruthy();
      expect(['indicative', 'subjunctive', 'imperative']).toContain(p.group);
    });
  });

  it('indicative paradigms have all six person-number forms', () => {
    const indicatives = verbParadigms.filter((p) => p.group === 'indicative');
    indicatives.forEach((p) => {
      PERSONS.forEach((person) => {
        expect(p.forms[person]).toBeTruthy();
      });
    });
  });
});

// ─── infinitives and participles ───────────────────────────────────────────

describe('infinitiveForms', () => {
  it('is a non-empty array with label and form fields', () => {
    expect(infinitiveForms.length).toBeGreaterThan(0);
    infinitiveForms.forEach((inf) => {
      expect(inf.label).toBeTruthy();
      expect(inf.form).toBeTruthy();
    });
  });
});

describe('participleRows', () => {
  it('has 10 entries covering all tense-voice combinations', () => {
    expect(participleRows).toHaveLength(10);
  });

  it('every row has a label and non-empty m/f/n strings', () => {
    participleRows.forEach((row) => {
      expect(row.label).toBeTruthy();
      expect(typeof row.m).toBe('string');
      expect(typeof row.f).toBe('string');
      expect(typeof row.n).toBe('string');
    });
  });
});

describe('participleParadigms', () => {
  it('has 10 paradigms covering all tense-voice combinations', () => {
    expect(participleParadigms).toHaveLength(10);
  });

  it('every paradigm has all 5 cases × 2 numbers × 3 genders', () => {
    const cases = ['nom', 'gen', 'dat', 'acc', 'voc'] as const;
    const numbers = ['sg', 'pl'] as const;
    const genders = ['m', 'f', 'n'] as const;
    participleParadigms.forEach((p) => {
      cases.forEach((c) => {
        numbers.forEach((n) => {
          genders.forEach((g) => {
            expect(typeof p.forms[c][n][g]).toBe('string');
            expect(p.forms[c][n][g].length).toBeGreaterThan(0);
          });
        });
      });
    });
  });

  it('nom sg forms match participleRows', () => {
    participleParadigms.forEach((paradigm) => {
      const row = participleRows.find((r) => r.label === paradigm.label);
      expect(row).toBeDefined();
      expect(paradigm.forms.nom.sg.m).toBe(row?.m);
      expect(paradigm.forms.nom.sg.f).toBe(row?.f);
      expect(paradigm.forms.nom.sg.n).toBe(row?.n);
    });
  });
});

// ─── pronouns ──────────────────────────────────────────────────────────────

describe('personalPronouns12', () => {
  it('includes first and second person pronouns', () => {
    const kinds = personalPronouns12.map((p) => p.kind);
    expect(kinds).toContain('1st');
    expect(kinds).toContain('2nd');
  });

  it('every pronoun has a name and id', () => {
    personalPronouns12.forEach((p) => {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
    });
  });
});

describe('genderedPronouns', () => {
  it('is a non-empty array', () => {
    expect(genderedPronouns.length).toBeGreaterThan(0);
  });

  it('every pronoun has an id, name, and kind', () => {
    genderedPronouns.forEach((p) => {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(['3rd-personal', 'demonstrative', 'relative', 'interrogative']).toContain(p.kind);
    });
  });
});

// ─── prepositions ──────────────────────────────────────────────────────────

describe('prepositions', () => {
  it('is a non-empty array', () => {
    expect(prepositions.length).toBeGreaterThan(0);
  });

  it('every entry has a greek form and at least one case', () => {
    prepositions.forEach((prep) => {
      expect(prep.greek).toBeTruthy();
      expect(prep.cases.length).toBeGreaterThan(0);
    });
  });

  it('every case listed has a corresponding gloss', () => {
    prepositions.forEach((prep) => {
      prep.cases.forEach((c) => {
        expect(prep.glosses[c]).toBeTruthy();
      });
    });
  });
});

// ─── definite article ──────────────────────────────────────────────────────

describe('articleForms', () => {
  it('has entries for all cases and numbers', () => {
    CASES.forEach((c) => {
      NUMBERS.forEach((n) => {
        expect(articleForms[c][n]).toBeDefined();
      });
    });
  });

  it('has non-null forms for nom, gen, dat, acc', () => {
    (['nom', 'gen', 'dat', 'acc'] as const).forEach((c) => {
      NUMBERS.forEach((n) => {
        GENDERS.forEach((g) => {
          expect(articleForms[c][n][g]).toBeTruthy();
        });
      });
    });
  });

  it('has null forms for all vocative slots', () => {
    NUMBERS.forEach((n) => {
      GENDERS.forEach((g) => {
        expect(articleForms.voc[n][g]).toBeNull();
      });
    });
  });

  it('nom sg masculine is ὁ', () => {
    expect(articleForms.nom.sg.m).toBe('ὁ');
  });

  it('gen pl all genders are τῶν', () => {
    GENDERS.forEach((g) => {
      expect(articleForms.gen.pl[g]).toBe('τῶν');
    });
  });
});

describe('getArticle', () => {
  it('returns the correct article for nom sg masculine', () => {
    expect(getArticle('nom', 'sg', 'masculine')).toBe('ὁ');
  });

  it('returns the correct article for nom sg feminine', () => {
    expect(getArticle('nom', 'sg', 'feminine')).toBe('ἡ');
  });

  it('returns the correct article for nom sg neuter', () => {
    expect(getArticle('nom', 'sg', 'neuter')).toBe('τό');
  });

  it('returns null for voc sg masculine', () => {
    expect(getArticle('voc', 'sg', 'masculine')).toBeNull();
  });

  it('returns null for voc pl neuter', () => {
    expect(getArticle('voc', 'pl', 'neuter')).toBeNull();
  });

  it('returns τῶν for gen pl of any gender', () => {
    expect(getArticle('gen', 'pl', 'masculine')).toBe('τῶν');
    expect(getArticle('gen', 'pl', 'feminine')).toBe('τῶν');
    expect(getArticle('gen', 'pl', 'neuter')).toBe('τῶν');
  });
});

// ─── μι-verb entries ───────────────────────────────────────────────────────

describe('miVerbEntries', () => {
  it('has exactly four entries', () => {
    expect(miVerbEntries).toHaveLength(4);
  });

  it('covers δίδωμι, ἵστημι, ἀφίημι, τίθημι', () => {
    const ids = miVerbEntries.map((e) => e.id);
    expect(ids).toContain('didomi');
    expect(ids).toContain('histemi');
    expect(ids).toContain('aphiemi');
    expect(ids).toContain('tithemi');
  });

  it('every entry has a lexical form, gloss, and positive gntCount', () => {
    miVerbEntries.forEach((e) => {
      expect(e.lexical).toBeTruthy();
      expect(e.gloss).toBeTruthy();
      expect(e.gntCount).toBeGreaterThan(0);
    });
  });

  it('every entry has at least one pattern note', () => {
    miVerbEntries.forEach((e) => {
      expect(e.patternNotes.length).toBeGreaterThan(0);
      e.patternNotes.forEach((note) => expect(note).toBeTruthy());
    });
  });

  it('every entry has exactly two infinitives (present and aorist)', () => {
    miVerbEntries.forEach((e) => {
      expect(e.infinitives).toHaveLength(2);
      e.infinitives.forEach((inf) => {
        expect(inf.label).toBeTruthy();
        expect(inf.form).toBeTruthy();
      });
    });
  });

  it('every entry has exactly two participle nom-sg rows', () => {
    miVerbEntries.forEach((e) => {
      expect(e.participleNomSg).toHaveLength(2);
      e.participleNomSg.forEach((row) => {
        expect(row.label).toBeTruthy();
        expect(row.m).toBeTruthy();
        expect(row.f).toBeTruthy();
        expect(row.n).toBeTruthy();
      });
    });
  });

  it('δίδωμι has gntCount 415', () => {
    const didomi = miVerbEntries.find((e) => e.id === 'didomi')!;
    expect(didomi.gntCount).toBe(415);
  });

  it('δίδωμι present active infinitive is διδόναι', () => {
    const didomi = miVerbEntries.find((e) => e.id === 'didomi')!;
    expect(didomi.infinitives[0].form).toBe('διδόναι');
  });

  it('ἀφίημι aorist active infinitive is ἀφεῖναι', () => {
    const aphiemi = miVerbEntries.find((e) => e.id === 'aphiemi')!;
    expect(aphiemi.infinitives[1].form).toBe('ἀφεῖναι');
  });
});

// ─── μι-verb paradigms ─────────────────────────────────────────────────────

describe('miVerbParadigms', () => {
  it('has 28 paradigms (7 per verb × 4 verbs)', () => {
    expect(miVerbParadigms).toHaveLength(28);
  });

  it('every paradigm has a unique id', () => {
    const ids = miVerbParadigms.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every paradigm has a verbId, label, and group', () => {
    miVerbParadigms.forEach((p) => {
      expect(['didomi', 'histemi', 'aphiemi', 'tithemi']).toContain(p.verbId);
      expect(p.label).toBeTruthy();
      expect(['indicative', 'subjunctive', 'imperative']).toContain(p.group);
    });
  });

  it('each verb has 7 paradigms', () => {
    (['didomi', 'histemi', 'aphiemi', 'tithemi'] as const).forEach((verbId) => {
      const count = miVerbParadigms.filter((p) => p.verbId === verbId).length;
      expect(count).toBe(7);
    });
  });

  it('indicative paradigms have all six person-number forms', () => {
    const indicatives = miVerbParadigms.filter((p) => p.group === 'indicative');
    indicatives.forEach((p) => {
      PERSONS.forEach((person) => {
        expect(p.forms[person]).toBeTruthy();
      });
    });
  });

  it('imperative paradigms have 2sg and 3sg but no 1sg', () => {
    const imperatives = miVerbParadigms.filter((p) => p.group === 'imperative');
    imperatives.forEach((p) => {
      expect(p.forms['1sg']).toBeUndefined();
      expect(p.forms['2sg']).toBeTruthy();
      expect(p.forms['3sg']).toBeTruthy();
    });
  });

  it('δίδωμι present indicative 1sg is δίδωμι', () => {
    const p = miVerbParadigms.find((p) => p.id === 'didomi-pres-ind')!;
    expect(p.forms['1sg']).toBe('δίδωμι');
  });

  it('δίδωμι aorist indicative 1sg is ἔδωκα', () => {
    const p = miVerbParadigms.find((p) => p.id === 'didomi-aor-ind')!;
    expect(p.forms['1sg']).toBe('ἔδωκα');
  });

  it('ἵστημι aorist indicative (2nd) 3sg is ἔστη', () => {
    const p = miVerbParadigms.find((p) => p.id === 'histemi-aor-ind')!;
    expect(p.forms['3sg']).toBe('ἔστη');
  });

  it('ἀφίημι aorist imperative 2sg is ἄφες', () => {
    const p = miVerbParadigms.find((p) => p.id === 'aphiemi-aor-imptv')!;
    expect(p.forms['2sg']).toBe('ἄφες');
  });

  it('τίθημι present indicative 1sg is τίθημι', () => {
    const p = miVerbParadigms.find((p) => p.id === 'tithemi-pres-ind')!;
    expect(p.forms['1sg']).toBe('τίθημι');
  });

  it('τίθημι aorist subjunctive 1sg is θῶ', () => {
    const p = miVerbParadigms.find((p) => p.id === 'tithemi-aor-subj')!;
    expect(p.forms['1sg']).toBe('θῶ');
  });
});

// ─── accent sections ───────────────────────────────────────────────────────

describe('accentSections', () => {
  it('is a non-empty array', () => {
    expect(accentSections.length).toBeGreaterThan(0);
  });

  it('every section has a title and at least one rule', () => {
    accentSections.forEach((s) => {
      expect(s.title).toBeTruthy();
      expect(s.rules.length).toBeGreaterThan(0);
    });
  });
});
