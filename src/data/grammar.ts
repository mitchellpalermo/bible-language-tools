/**
 * Grammar reference data for Koine Greek.
 * Covers noun declensions, verb conjugations, pronouns, prepositions, and accent rules.
 * All paradigms use λύω (verb) or representative GNT nouns as models.
 */

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export const CASES = ['nom', 'gen', 'dat', 'acc', 'voc'] as const;
export type CaseKey = (typeof CASES)[number];

export const NUMBERS = ['sg', 'pl'] as const;
export type NumKey = (typeof NUMBERS)[number];

export const GENDERS = ['m', 'f', 'n'] as const;
export type GenderKey = (typeof GENDERS)[number];

export const PERSONS = ['1sg', '2sg', '3sg', '1pl', '2pl', '3pl'] as const;
export type PersonNum = (typeof PERSONS)[number];

export type PrepCase = 'gen' | 'dat' | 'acc';

// ---------------------------------------------------------------------------
// Display labels and descriptions
// ---------------------------------------------------------------------------

export const CASE_LABELS: Record<CaseKey, string> = {
  nom: 'Nom',
  gen: 'Gen',
  dat: 'Dat',
  acc: 'Acc',
  voc: 'Voc',
};

export const CASE_DESCRIPTIONS: Record<CaseKey, string> = {
  nom: 'Nominative — subject of the verb',
  gen: 'Genitive — possession, source, or description (of)',
  dat: 'Dative — indirect object; by, with, or in',
  acc: 'Accusative — direct object; motion toward',
  voc: 'Vocative — direct address',
};

export const NUM_LABELS: Record<NumKey, string> = {
  sg: 'Singular',
  pl: 'Plural',
};

export const GENDER_LABELS: Record<GenderKey, string> = {
  m: 'Masc.',
  f: 'Fem.',
  n: 'Neut.',
};

export const PERSON_LABELS: Record<PersonNum, string> = {
  '1sg': '1st sg',
  '2sg': '2nd sg',
  '3sg': '3rd sg',
  '1pl': '1st pl',
  '2pl': '2nd pl',
  '3pl': '3rd pl',
};

export const PERSON_FULL_LABELS: Record<PersonNum, string> = {
  '1sg': '1st Person Singular',
  '2sg': '2nd Person Singular',
  '3sg': '3rd Person Singular',
  '1pl': '1st Person Plural',
  '2pl': '2nd Person Plural',
  '3pl': '3rd Person Plural',
};

// ---------------------------------------------------------------------------
// Noun types
// ---------------------------------------------------------------------------

/** A single inflected noun form paired with its grammatical ending. */
export interface NounForm {
  /** The complete inflected form, e.g. "ἡμέρας" */
  full: string;
  /** The ending alone, e.g. "ας" — used in endings-only mode */
  ending: string;
}

export interface NounParadigm {
  id: string;
  /** Display name, e.g. "1st Declension Feminine — ἡμέρα" */
  name: string;
  declension: '1st' | '2nd' | '3rd';
  gender: 'masculine' | 'feminine' | 'neuter';
  forms: Record<CaseKey, Record<NumKey, NounForm>>;
}

export interface AdjParadigm {
  id: string;
  name: string;
  type: '2-1-2' | '3-1-3';
  /** forms[case][number][gender] — full inflected form */
  forms: Record<CaseKey, Record<NumKey, Record<GenderKey, string>>>;
}

// ---------------------------------------------------------------------------
// Verb types
// ---------------------------------------------------------------------------

export interface VerbParadigm {
  id: string;
  /** e.g. "Present Active Indicative" */
  label: string;
  group: 'indicative' | 'subjunctive' | 'imperative';
  /** Keyed by person-number; undefined = form does not exist (e.g. 1sg imperative) */
  forms: Partial<Record<PersonNum, string>>;
}

export interface InfinitivePair {
  label: string;
  form: string;
}

export interface ParticipleRow {
  label: string;
  m: string;
  f: string;
  n: string;
}

export type ParticipleTense = 'present' | 'future' | 'aorist' | 'perfect';
export type ParticipleVoice = 'active' | 'middle' | 'passive' | 'mid-pass';

export interface ParticipleParadigm {
  id: string;
  /** Display label, e.g. "Present Active" */
  label: string;
  tense: ParticipleTense;
  voice: ParticipleVoice;
  /** Short note on which declension patterns apply, shown below the table. */
  declensionNote: string;
  /** forms[case][number][gender] — full inflected form */
  forms: Record<CaseKey, Record<NumKey, Record<GenderKey, string>>>;
}

// ---------------------------------------------------------------------------
// Pronoun types
// ---------------------------------------------------------------------------

/** First and second person personal pronouns (no gender variation). */
export interface PersonalPronoun12 {
  id: string;
  name: string;
  kind: '1st' | '2nd';
  /** forms[number][case] — some cases may have two forms (emphatic / unemphatic) */
  forms: Record<NumKey, Partial<Record<CaseKey, string>>>;
}

/** Pronouns that decline for gender (3rd person, demonstrative, relative, interrogative). */
export interface GenderedPronoun {
  id: string;
  name: string;
  kind: '3rd-personal' | 'demonstrative' | 'relative' | 'interrogative';
  /** forms[case][number][gender] */
  forms: Partial<Record<CaseKey, Record<NumKey, Record<GenderKey, string>>>>;
}

// ---------------------------------------------------------------------------
// Preposition types
// ---------------------------------------------------------------------------

export interface PrepEntry {
  greek: string;
  cases: PrepCase[];
  glosses: Partial<Record<PrepCase, string>>;
}

// ---------------------------------------------------------------------------
// Contract verb types
// ---------------------------------------------------------------------------

export type ContractType = 'alpha' | 'epsilon' | 'omicron';

/** One row in the contraction rules reference table. */
export interface ContractionRule {
  /** The vowel or diphthong following the stem vowel, e.g. "+ ε" */
  following: string;
  /** Contraction result for α-stems */
  alpha: string;
  /** Contraction result for ε-stems */
  epsilon: string;
  /** Contraction result for ο-stems */
  omicron: string;
}

export interface ContractVerbParadigm {
  id: string;
  label: string;
  contractType: ContractType;
  group: 'indicative' | 'subjunctive' | 'imperative';
  /** Contracted forms — what students see in GNT texts */
  forms: Partial<Record<PersonNum, string>>;
  /** Uncontracted forms — shown as muted reference */
  uncontracted: Partial<Record<PersonNum, string>>;
}

export interface CommonContractVerb {
  greek: string;
  type: ContractType;
  gloss: string;
}

// ---------------------------------------------------------------------------
// Liquid verb types
// ---------------------------------------------------------------------------

/** One row in the standard-vs-liquid future comparison table. */
export interface LiquidFutureRow {
  person: PersonNum;
  standard: string;
  liquid: string;
}

export interface LiquidPrincipalParts {
  id: string;
  lexical: string;
  gloss: string;
  future: string;
  aoristAct: string;
  perfectAct: string;
  perfectMidPass: string;
  aoristPass: string;
}

// ---------------------------------------------------------------------------
// μι-verb types
// ---------------------------------------------------------------------------

export type MiVerbId = 'didomi' | 'histemi' | 'aphiemi' | 'tithemi';

export interface MiVerbEntry {
  id: MiVerbId;
  /** Lexical form, e.g. "δίδωμι" */
  lexical: string;
  /** English gloss */
  gloss: string;
  /** Approximate GNT occurrence count */
  gntCount: number;
  /** Short notes explaining key structural differences from ω-verbs */
  patternNotes: string[];
  /** Present and aorist active infinitives */
  infinitives: Array<{ label: string; form: string }>;
  /** Nominative singular of present and aorist active participles (m/f/n) */
  participleNomSg: Array<{ label: string; m: string; f: string; n: string }>;
}

export interface MiVerbParadigm {
  id: string;
  verbId: MiVerbId;
  /** Display label, e.g. "Present Active Indicative" */
  label: string;
  group: 'indicative' | 'subjunctive' | 'imperative';
  /** Active forms only; undefined = form does not exist (e.g. 1sg imperative) */
  forms: Partial<Record<PersonNum, string>>;
}

// ---------------------------------------------------------------------------
// Accent rule types
// ---------------------------------------------------------------------------

export interface AccentSection {
  title: string;
  rules: string[];
}

// ===========================================================================
// DATA
// ===========================================================================

// ---------------------------------------------------------------------------
// Nouns
// ---------------------------------------------------------------------------

export const nounParadigms: NounParadigm[] = [
  {
    id: '1f-alpha-pure',
    name: '1st Decl. Feminine — ἡμέρα (α-pure)',
    declension: '1st',
    gender: 'feminine',
    forms: {
      nom: { sg: { full: 'ἡμέρα', ending: 'α' }, pl: { full: 'ἡμέραι', ending: 'αι' } },
      gen: { sg: { full: 'ἡμέρας', ending: 'ας' }, pl: { full: 'ἡμερῶν', ending: 'ων' } },
      dat: { sg: { full: 'ἡμέρᾳ', ending: 'ᾳ' }, pl: { full: 'ἡμέραις', ending: 'αις' } },
      acc: { sg: { full: 'ἡμέραν', ending: 'αν' }, pl: { full: 'ἡμέρας', ending: 'ας' } },
      voc: { sg: { full: 'ἡμέρα', ending: 'α' }, pl: { full: 'ἡμέραι', ending: 'αι' } },
    },
  },
  {
    id: '1f-alpha-impure',
    name: '1st Decl. Feminine — δόξα (α-impure)',
    declension: '1st',
    gender: 'feminine',
    forms: {
      nom: { sg: { full: 'δόξα', ending: 'α' }, pl: { full: 'δόξαι', ending: 'αι' } },
      gen: { sg: { full: 'δόξης', ending: 'ης' }, pl: { full: 'δοξῶν', ending: 'ων' } },
      dat: { sg: { full: 'δόξῃ', ending: 'ῃ' }, pl: { full: 'δόξαις', ending: 'αις' } },
      acc: { sg: { full: 'δόξαν', ending: 'αν' }, pl: { full: 'δόξας', ending: 'ας' } },
      voc: { sg: { full: 'δόξα', ending: 'α' }, pl: { full: 'δόξαι', ending: 'αι' } },
    },
  },
  {
    id: '1m-as',
    name: '1st Decl. Masculine — νεανίας',
    declension: '1st',
    gender: 'masculine',
    forms: {
      nom: { sg: { full: 'νεανίας', ending: 'ας' }, pl: { full: 'νεανίαι', ending: 'αι' } },
      gen: { sg: { full: 'νεανίου', ending: 'ου' }, pl: { full: 'νεανιῶν', ending: 'ων' } },
      dat: { sg: { full: 'νεανίᾳ', ending: 'ᾳ' }, pl: { full: 'νεανίαις', ending: 'αις' } },
      acc: { sg: { full: 'νεανίαν', ending: 'αν' }, pl: { full: 'νεανίας', ending: 'ας' } },
      voc: { sg: { full: 'νεανία', ending: 'α' }, pl: { full: 'νεανίαι', ending: 'αι' } },
    },
  },
  {
    id: '2m-os',
    name: '2nd Decl. Masculine — λόγος',
    declension: '2nd',
    gender: 'masculine',
    forms: {
      nom: { sg: { full: 'λόγος', ending: 'ος' }, pl: { full: 'λόγοι', ending: 'οι' } },
      gen: { sg: { full: 'λόγου', ending: 'ου' }, pl: { full: 'λόγων', ending: 'ων' } },
      dat: { sg: { full: 'λόγῳ', ending: 'ῳ' }, pl: { full: 'λόγοις', ending: 'οις' } },
      acc: { sg: { full: 'λόγον', ending: 'ον' }, pl: { full: 'λόγους', ending: 'ους' } },
      voc: { sg: { full: 'λόγε', ending: 'ε' }, pl: { full: 'λόγοι', ending: 'οι' } },
    },
  },
  {
    id: '2n-on',
    name: '2nd Decl. Neuter — ἔργον',
    declension: '2nd',
    gender: 'neuter',
    forms: {
      nom: { sg: { full: 'ἔργον', ending: 'ον' }, pl: { full: 'ἔργα', ending: 'α' } },
      gen: { sg: { full: 'ἔργου', ending: 'ου' }, pl: { full: 'ἔργων', ending: 'ων' } },
      dat: { sg: { full: 'ἔργῳ', ending: 'ῳ' }, pl: { full: 'ἔργοις', ending: 'οις' } },
      acc: { sg: { full: 'ἔργον', ending: 'ον' }, pl: { full: 'ἔργα', ending: 'α' } },
      voc: { sg: { full: 'ἔργον', ending: 'ον' }, pl: { full: 'ἔργα', ending: 'α' } },
    },
  },
  {
    id: '3-mute',
    name: '3rd Decl. Mute Stem — σάρξ (κ-stem)',
    declension: '3rd',
    gender: 'feminine',
    forms: {
      nom: { sg: { full: 'σάρξ', ending: 'ξ' }, pl: { full: 'σάρκες', ending: 'ες' } },
      gen: { sg: { full: 'σαρκός', ending: 'ός' }, pl: { full: 'σαρκῶν', ending: 'ῶν' } },
      dat: { sg: { full: 'σαρκί', ending: 'ί' }, pl: { full: 'σαρξί(ν)', ending: 'σί(ν)' } },
      acc: { sg: { full: 'σάρκα', ending: 'α' }, pl: { full: 'σάρκας', ending: 'ας' } },
      voc: { sg: { full: 'σάρξ', ending: 'ξ' }, pl: { full: 'σάρκες', ending: 'ες' } },
    },
  },
  {
    id: '3-i-stem',
    name: '3rd Decl. i-Stem — πίστις',
    declension: '3rd',
    gender: 'feminine',
    forms: {
      nom: { sg: { full: 'πίστις', ending: 'ις' }, pl: { full: 'πίστεις', ending: 'εις' } },
      gen: { sg: { full: 'πίστεως', ending: 'εως' }, pl: { full: 'πίστεων', ending: 'εων' } },
      dat: { sg: { full: 'πίστει', ending: 'ει' }, pl: { full: 'πίστεσι(ν)', ending: 'εσι(ν)' } },
      acc: { sg: { full: 'πίστιν', ending: 'ιν' }, pl: { full: 'πίστεις', ending: 'εις' } },
      voc: { sg: { full: 'πίστι', ending: 'ι' }, pl: { full: 'πίστεις', ending: 'εις' } },
    },
  },
  {
    id: '3-u-stem',
    name: '3rd Decl. υ-Stem — βασιλεύς',
    declension: '3rd',
    gender: 'masculine',
    forms: {
      nom: { sg: { full: 'βασιλεύς', ending: 'ς' }, pl: { full: 'βασιλεῖς', ending: 'εῖς' } },
      gen: { sg: { full: 'βασιλέως', ending: 'ως' }, pl: { full: 'βασιλέων', ending: 'ων' } },
      dat: { sg: { full: 'βασιλεῖ', ending: 'ῖ' }, pl: { full: 'βασιλεῦσι(ν)', ending: 'σι(ν)' } },
      acc: { sg: { full: 'βασιλέα', ending: 'α' }, pl: { full: 'βασιλεῖς', ending: 'εῖς' } },
      voc: { sg: { full: 'βασιλεῦ', ending: 'ῦ' }, pl: { full: 'βασιλεῖς', ending: 'εῖς' } },
    },
  },
  {
    id: '3-s-stem',
    name: '3rd Decl. Neuter s-Stem — γένος',
    declension: '3rd',
    gender: 'neuter',
    forms: {
      nom: { sg: { full: 'γένος', ending: 'ος' }, pl: { full: 'γένη', ending: 'η' } },
      gen: { sg: { full: 'γένους', ending: 'ους' }, pl: { full: 'γενῶν', ending: 'ῶν' } },
      dat: { sg: { full: 'γένει', ending: 'ει' }, pl: { full: 'γένεσι(ν)', ending: 'εσι(ν)' } },
      acc: { sg: { full: 'γένος', ending: 'ος' }, pl: { full: 'γένη', ending: 'η' } },
      voc: { sg: { full: 'γένος', ending: 'ος' }, pl: { full: 'γένη', ending: 'η' } },
    },
  },
];

// ---------------------------------------------------------------------------
// Adjectives
// ---------------------------------------------------------------------------

export const adjParadigms: AdjParadigm[] = [
  {
    id: 'adj-2-1-2',
    name: '2-1-2 Adjective — ἀγαθός, -ή, -όν',
    type: '2-1-2',
    forms: {
      nom: {
        sg: { m: 'ἀγαθός', f: 'ἀγαθή', n: 'ἀγαθόν' },
        pl: { m: 'ἀγαθοί', f: 'ἀγαθαί', n: 'ἀγαθά' },
      },
      gen: {
        sg: { m: 'ἀγαθοῦ', f: 'ἀγαθῆς', n: 'ἀγαθοῦ' },
        pl: { m: 'ἀγαθῶν', f: 'ἀγαθῶν', n: 'ἀγαθῶν' },
      },
      dat: {
        sg: { m: 'ἀγαθῷ', f: 'ἀγαθῇ', n: 'ἀγαθῷ' },
        pl: { m: 'ἀγαθοῖς', f: 'ἀγαθαῖς', n: 'ἀγαθοῖς' },
      },
      acc: {
        sg: { m: 'ἀγαθόν', f: 'ἀγαθήν', n: 'ἀγαθόν' },
        pl: { m: 'ἀγαθούς', f: 'ἀγαθάς', n: 'ἀγαθά' },
      },
      voc: {
        sg: { m: 'ἀγαθέ', f: 'ἀγαθή', n: 'ἀγαθόν' },
        pl: { m: 'ἀγαθοί', f: 'ἀγαθαί', n: 'ἀγαθά' },
      },
    },
  },
  {
    id: 'adj-3-1-3',
    name: '3-1-3 Adjective — πᾶς, πᾶσα, πᾶν',
    type: '3-1-3',
    forms: {
      nom: {
        sg: { m: 'πᾶς', f: 'πᾶσα', n: 'πᾶν' },
        pl: { m: 'πάντες', f: 'πᾶσαι', n: 'πάντα' },
      },
      gen: {
        sg: { m: 'παντός', f: 'πάσης', n: 'παντός' },
        pl: { m: 'πάντων', f: 'πασῶν', n: 'πάντων' },
      },
      dat: {
        sg: { m: 'παντί', f: 'πάσῃ', n: 'παντί' },
        pl: { m: 'πᾶσι(ν)', f: 'πάσαις', n: 'πᾶσι(ν)' },
      },
      acc: {
        sg: { m: 'πάντα', f: 'πᾶσαν', n: 'πᾶν' },
        pl: { m: 'πάντας', f: 'πάσας', n: 'πάντα' },
      },
      voc: {
        sg: { m: 'πᾶς', f: 'πᾶσα', n: 'πᾶν' },
        pl: { m: 'πάντες', f: 'πᾶσαι', n: 'πάντα' },
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Verbs — λύω paradigms
// ---------------------------------------------------------------------------

export const verbParadigms: VerbParadigm[] = [
  // Indicative
  {
    id: 'pres-act-ind',
    label: 'Present Active Indicative',
    group: 'indicative',
    forms: {
      '1sg': 'λύω',
      '2sg': 'λύεις',
      '3sg': 'λύει',
      '1pl': 'λύομεν',
      '2pl': 'λύετε',
      '3pl': 'λύουσι(ν)',
    },
  },
  {
    id: 'pres-mid-ind',
    label: 'Present Middle/Passive Indicative',
    group: 'indicative',
    forms: {
      '1sg': 'λύομαι',
      '2sg': 'λύῃ',
      '3sg': 'λύεται',
      '1pl': 'λυόμεθα',
      '2pl': 'λύεσθε',
      '3pl': 'λύονται',
    },
  },
  {
    id: 'impf-act-ind',
    label: 'Imperfect Active Indicative',
    group: 'indicative',
    forms: {
      '1sg': 'ἔλυον',
      '2sg': 'ἔλυες',
      '3sg': 'ἔλυε(ν)',
      '1pl': 'ἐλύομεν',
      '2pl': 'ἐλύετε',
      '3pl': 'ἔλυον',
    },
  },
  {
    id: 'impf-mid-ind',
    label: 'Imperfect Middle/Passive Indicative',
    group: 'indicative',
    forms: {
      '1sg': 'ἐλυόμην',
      '2sg': 'ἐλύου',
      '3sg': 'ἐλύετο',
      '1pl': 'ἐλυόμεθα',
      '2pl': 'ἐλύεσθε',
      '3pl': 'ἐλύοντο',
    },
  },
  {
    id: 'fut-act-ind',
    label: 'Future Active Indicative',
    group: 'indicative',
    forms: {
      '1sg': 'λύσω',
      '2sg': 'λύσεις',
      '3sg': 'λύσει',
      '1pl': 'λύσομεν',
      '2pl': 'λύσετε',
      '3pl': 'λύσουσι(ν)',
    },
  },
  {
    id: 'fut-mid-ind',
    label: 'Future Middle Indicative',
    group: 'indicative',
    forms: {
      '1sg': 'λύσομαι',
      '2sg': 'λύσῃ',
      '3sg': 'λύσεται',
      '1pl': 'λυσόμεθα',
      '2pl': 'λύσεσθε',
      '3pl': 'λύσονται',
    },
  },
  {
    id: 'aor-act-ind',
    label: 'Aorist Active Indicative',
    group: 'indicative',
    forms: {
      '1sg': 'ἔλυσα',
      '2sg': 'ἔλυσας',
      '3sg': 'ἔλυσε(ν)',
      '1pl': 'ἐλύσαμεν',
      '2pl': 'ἐλύσατε',
      '3pl': 'ἔλυσαν',
    },
  },
  {
    id: 'aor-mid-ind',
    label: 'Aorist Middle Indicative',
    group: 'indicative',
    forms: {
      '1sg': 'ἐλυσάμην',
      '2sg': 'ἐλύσω',
      '3sg': 'ἐλύσατο',
      '1pl': 'ἐλυσάμεθα',
      '2pl': 'ἐλύσασθε',
      '3pl': 'ἐλύσαντο',
    },
  },
  {
    id: 'aor-pass-ind',
    label: 'Aorist Passive Indicative',
    group: 'indicative',
    forms: {
      '1sg': 'ἐλύθην',
      '2sg': 'ἐλύθης',
      '3sg': 'ἐλύθη',
      '1pl': 'ἐλύθημεν',
      '2pl': 'ἐλύθητε',
      '3pl': 'ἐλύθησαν',
    },
  },
  {
    id: 'perf-act-ind',
    label: 'Perfect Active Indicative',
    group: 'indicative',
    forms: {
      '1sg': 'λέλυκα',
      '2sg': 'λέλυκας',
      '3sg': 'λέλυκε(ν)',
      '1pl': 'λελύκαμεν',
      '2pl': 'λελύκατε',
      '3pl': 'λελύκασι(ν)',
    },
  },
  {
    id: 'perf-mid-pass-ind',
    label: 'Perfect Middle/Passive Indicative',
    group: 'indicative',
    forms: {
      '1sg': 'λέλυμαι',
      '2sg': 'λέλυσαι',
      '3sg': 'λέλυται',
      '1pl': 'λελύμεθα',
      '2pl': 'λέλυσθε',
      '3pl': 'λέλυνται',
    },
  },
  // Subjunctive
  {
    id: 'pres-act-subj',
    label: 'Present Active Subjunctive',
    group: 'subjunctive',
    forms: {
      '1sg': 'λύω',
      '2sg': 'λύῃς',
      '3sg': 'λύῃ',
      '1pl': 'λύωμεν',
      '2pl': 'λύητε',
      '3pl': 'λύωσι(ν)',
    },
  },
  {
    id: 'pres-pass-subj',
    label: 'Present Passive Subjunctive',
    group: 'subjunctive',
    forms: {
      '1sg': 'λύωμαι',
      '2sg': 'λύῃ',
      '3sg': 'λύηται',
      '1pl': 'λυώμεθα',
      '2pl': 'λύησθε',
      '3pl': 'λύωνται',
    },
  },
  {
    id: 'aor-act-subj',
    label: 'Aorist Active Subjunctive',
    group: 'subjunctive',
    forms: {
      '1sg': 'λύσω',
      '2sg': 'λύσῃς',
      '3sg': 'λύσῃ',
      '1pl': 'λύσωμεν',
      '2pl': 'λύσητε',
      '3pl': 'λύσωσι(ν)',
    },
  },
  {
    id: 'aor-pass-subj',
    label: 'Aorist Passive Subjunctive',
    group: 'subjunctive',
    forms: {
      '1sg': 'λυθῶ',
      '2sg': 'λυθῇς',
      '3sg': 'λυθῇ',
      '1pl': 'λυθῶμεν',
      '2pl': 'λυθῆτε',
      '3pl': 'λυθῶσι(ν)',
    },
  },
  // Imperative — no 1st person forms
  {
    id: 'pres-act-imp',
    label: 'Present Active Imperative',
    group: 'imperative',
    forms: { '2sg': 'λῦε', '3sg': 'λυέτω', '2pl': 'λύετε', '3pl': 'λυόντων' },
  },
  {
    id: 'pres-pass-imp',
    label: 'Present Middle/Passive Imperative',
    group: 'imperative',
    forms: { '2sg': 'λύου', '3sg': 'λυέσθω', '2pl': 'λύεσθε', '3pl': 'λυέσθωσαν' },
  },
  {
    id: 'aor-act-imp',
    label: 'Aorist Active Imperative',
    group: 'imperative',
    forms: { '2sg': 'λῦσον', '3sg': 'λυσάτω', '2pl': 'λύσατε', '3pl': 'λυσάντων' },
  },
  {
    id: 'aor-pass-imp',
    label: 'Aorist Passive Imperative',
    group: 'imperative',
    forms: { '2sg': 'λύθητι', '3sg': 'λυθήτω', '2pl': 'λύθητε', '3pl': 'λυθήτωσαν' },
  },
];

export const infinitiveForms: InfinitivePair[] = [
  { label: 'Present Active', form: 'λύειν' },
  { label: 'Present Mid./Pass.', form: 'λύεσθαι' },
  { label: 'Future Active', form: 'λύσειν' },
  { label: 'Future Middle', form: 'λύσεσθαι' },
  { label: 'Aorist Active', form: 'λῦσαι' },
  { label: 'Aorist Middle', form: 'λύσασθαι' },
  { label: 'Aorist Passive', form: 'λυθῆναι' },
  { label: 'Perfect Active', form: 'λελυκέναι' },
];

export const participleRows: ParticipleRow[] = [
  // Present
  { label: 'Present Active', m: 'λύων', f: 'λύουσα', n: 'λῦον' },
  { label: 'Present Mid./Pass.', m: 'λυόμενος', f: 'λυομένη', n: 'λυόμενον' },
  // Future
  { label: 'Future Active', m: 'λύσων', f: 'λύσουσα', n: 'λῦσον' },
  { label: 'Future Middle', m: 'λυσόμενος', f: 'λυσομένη', n: 'λυσόμενον' },
  { label: 'Future Passive', m: 'λυθησόμενος', f: 'λυθησομένη', n: 'λυθησόμενον' },
  // Aorist
  { label: 'Aorist Active', m: 'λύσας', f: 'λύσασα', n: 'λῦσαν' },
  { label: 'Aorist Middle', m: 'λυσάμενος', f: 'λυσαμένη', n: 'λυσάμενον' },
  { label: 'Aorist Passive', m: 'λυθείς', f: 'λυθεῖσα', n: 'λυθέν' },
  // Perfect
  { label: 'Perfect Active', m: 'λελυκώς', f: 'λελυκυῖα', n: 'λελυκός' },
  { label: 'Perfect Mid./Pass.', m: 'λελυμένος', f: 'λελυμένη', n: 'λελυμένον' },
];

export const participleParadigms: ParticipleParadigm[] = [
  // ── Present ───────────────────────────────────────────────────────────────
  {
    id: 'pres-act-ptc',
    label: 'Present Active',
    tense: 'present',
    voice: 'active',
    declensionNote: 'Masc./Neut.: 3rd declension (ντ-stem); Fem.: 1st declension',
    forms: {
      nom: {
        sg: { m: 'λύων', f: 'λύουσα', n: 'λῦον' },
        pl: { m: 'λύοντες', f: 'λύουσαι', n: 'λύοντα' },
      },
      gen: {
        sg: { m: 'λύοντος', f: 'λυούσης', n: 'λύοντος' },
        pl: { m: 'λυόντων', f: 'λυουσῶν', n: 'λυόντων' },
      },
      dat: {
        sg: { m: 'λύοντι', f: 'λυούσῃ', n: 'λύοντι' },
        pl: { m: 'λύουσι(ν)', f: 'λυούσαις', n: 'λύουσι(ν)' },
      },
      acc: {
        sg: { m: 'λύοντα', f: 'λύουσαν', n: 'λῦον' },
        pl: { m: 'λύοντας', f: 'λυούσας', n: 'λύοντα' },
      },
      voc: {
        sg: { m: 'λύων', f: 'λύουσα', n: 'λῦον' },
        pl: { m: 'λύοντες', f: 'λύουσαι', n: 'λύοντα' },
      },
    },
  },
  {
    id: 'pres-mid-pass-ptc',
    label: 'Present Mid./Pass.',
    tense: 'present',
    voice: 'mid-pass',
    declensionNote: 'Masc./Neut.: 2nd declension; Fem.: 1st declension',
    forms: {
      nom: {
        sg: { m: 'λυόμενος', f: 'λυομένη', n: 'λυόμενον' },
        pl: { m: 'λυόμενοι', f: 'λυόμεναι', n: 'λυόμενα' },
      },
      gen: {
        sg: { m: 'λυομένου', f: 'λυομένης', n: 'λυομένου' },
        pl: { m: 'λυομένων', f: 'λυομένων', n: 'λυομένων' },
      },
      dat: {
        sg: { m: 'λυομένῳ', f: 'λυομένῃ', n: 'λυομένῳ' },
        pl: { m: 'λυομένοις', f: 'λυομέναις', n: 'λυομένοις' },
      },
      acc: {
        sg: { m: 'λυόμενον', f: 'λυομένην', n: 'λυόμενον' },
        pl: { m: 'λυομένους', f: 'λυομένας', n: 'λυόμενα' },
      },
      voc: {
        sg: { m: 'λυόμενε', f: 'λυομένη', n: 'λυόμενον' },
        pl: { m: 'λυόμενοι', f: 'λυόμεναι', n: 'λυόμενα' },
      },
    },
  },
  // ── Future ────────────────────────────────────────────────────────────────
  {
    id: 'fut-act-ptc',
    label: 'Future Active',
    tense: 'future',
    voice: 'active',
    declensionNote: 'Masc./Neut.: 3rd declension (ντ-stem); Fem.: 1st declension',
    forms: {
      nom: {
        sg: { m: 'λύσων', f: 'λύσουσα', n: 'λῦσον' },
        pl: { m: 'λύσοντες', f: 'λύσουσαι', n: 'λύσοντα' },
      },
      gen: {
        sg: { m: 'λύσοντος', f: 'λυσούσης', n: 'λύσοντος' },
        pl: { m: 'λυσόντων', f: 'λυσουσῶν', n: 'λυσόντων' },
      },
      dat: {
        sg: { m: 'λύσοντι', f: 'λυσούσῃ', n: 'λύσοντι' },
        pl: { m: 'λύσουσι(ν)', f: 'λυσούσαις', n: 'λύσουσι(ν)' },
      },
      acc: {
        sg: { m: 'λύσοντα', f: 'λύσουσαν', n: 'λῦσον' },
        pl: { m: 'λύσοντας', f: 'λυσούσας', n: 'λύσοντα' },
      },
      voc: {
        sg: { m: 'λύσων', f: 'λύσουσα', n: 'λῦσον' },
        pl: { m: 'λύσοντες', f: 'λύσουσαι', n: 'λύσοντα' },
      },
    },
  },
  {
    id: 'fut-mid-ptc',
    label: 'Future Middle',
    tense: 'future',
    voice: 'middle',
    declensionNote: 'Masc./Neut.: 2nd declension; Fem.: 1st declension',
    forms: {
      nom: {
        sg: { m: 'λυσόμενος', f: 'λυσομένη', n: 'λυσόμενον' },
        pl: { m: 'λυσόμενοι', f: 'λυσόμεναι', n: 'λυσόμενα' },
      },
      gen: {
        sg: { m: 'λυσομένου', f: 'λυσομένης', n: 'λυσομένου' },
        pl: { m: 'λυσομένων', f: 'λυσομένων', n: 'λυσομένων' },
      },
      dat: {
        sg: { m: 'λυσομένῳ', f: 'λυσομένῃ', n: 'λυσομένῳ' },
        pl: { m: 'λυσομένοις', f: 'λυσομέναις', n: 'λυσομένοις' },
      },
      acc: {
        sg: { m: 'λυσόμενον', f: 'λυσομένην', n: 'λυσόμενον' },
        pl: { m: 'λυσομένους', f: 'λυσομένας', n: 'λυσόμενα' },
      },
      voc: {
        sg: { m: 'λυσόμενε', f: 'λυσομένη', n: 'λυσόμενον' },
        pl: { m: 'λυσόμενοι', f: 'λυσόμεναι', n: 'λυσόμενα' },
      },
    },
  },
  {
    id: 'fut-pass-ptc',
    label: 'Future Passive',
    tense: 'future',
    voice: 'passive',
    declensionNote: 'Masc./Neut.: 2nd declension; Fem.: 1st declension',
    forms: {
      nom: {
        sg: { m: 'λυθησόμενος', f: 'λυθησομένη', n: 'λυθησόμενον' },
        pl: { m: 'λυθησόμενοι', f: 'λυθησόμεναι', n: 'λυθησόμενα' },
      },
      gen: {
        sg: { m: 'λυθησομένου', f: 'λυθησομένης', n: 'λυθησομένου' },
        pl: { m: 'λυθησομένων', f: 'λυθησομένων', n: 'λυθησομένων' },
      },
      dat: {
        sg: { m: 'λυθησομένῳ', f: 'λυθησομένῃ', n: 'λυθησομένῳ' },
        pl: { m: 'λυθησομένοις', f: 'λυθησομέναις', n: 'λυθησομένοις' },
      },
      acc: {
        sg: { m: 'λυθησόμενον', f: 'λυθησομένην', n: 'λυθησόμενον' },
        pl: { m: 'λυθησομένους', f: 'λυθησομένας', n: 'λυθησόμενα' },
      },
      voc: {
        sg: { m: 'λυθησόμενε', f: 'λυθησομένη', n: 'λυθησόμενον' },
        pl: { m: 'λυθησόμενοι', f: 'λυθησόμεναι', n: 'λυθησόμενα' },
      },
    },
  },
  // ── Aorist ────────────────────────────────────────────────────────────────
  {
    id: 'aor-act-ptc',
    label: 'Aorist Active',
    tense: 'aorist',
    voice: 'active',
    declensionNote: 'Masc./Neut.: 3rd declension (αντ-stem); Fem.: 1st declension',
    forms: {
      nom: {
        sg: { m: 'λύσας', f: 'λύσασα', n: 'λῦσαν' },
        pl: { m: 'λύσαντες', f: 'λύσασαι', n: 'λύσαντα' },
      },
      gen: {
        sg: { m: 'λύσαντος', f: 'λυσάσης', n: 'λύσαντος' },
        pl: { m: 'λυσάντων', f: 'λυσασῶν', n: 'λυσάντων' },
      },
      dat: {
        sg: { m: 'λύσαντι', f: 'λυσάσῃ', n: 'λύσαντι' },
        pl: { m: 'λύσασι(ν)', f: 'λυσάσαις', n: 'λύσασι(ν)' },
      },
      acc: {
        sg: { m: 'λύσαντα', f: 'λύσασαν', n: 'λῦσαν' },
        pl: { m: 'λύσαντας', f: 'λυσάσας', n: 'λύσαντα' },
      },
      voc: {
        sg: { m: 'λύσας', f: 'λύσασα', n: 'λῦσαν' },
        pl: { m: 'λύσαντες', f: 'λύσασαι', n: 'λύσαντα' },
      },
    },
  },
  {
    id: 'aor-mid-ptc',
    label: 'Aorist Middle',
    tense: 'aorist',
    voice: 'middle',
    declensionNote: 'Masc./Neut.: 2nd declension; Fem.: 1st declension',
    forms: {
      nom: {
        sg: { m: 'λυσάμενος', f: 'λυσαμένη', n: 'λυσάμενον' },
        pl: { m: 'λυσάμενοι', f: 'λυσάμεναι', n: 'λυσάμενα' },
      },
      gen: {
        sg: { m: 'λυσαμένου', f: 'λυσαμένης', n: 'λυσαμένου' },
        pl: { m: 'λυσαμένων', f: 'λυσαμένων', n: 'λυσαμένων' },
      },
      dat: {
        sg: { m: 'λυσαμένῳ', f: 'λυσαμένῃ', n: 'λυσαμένῳ' },
        pl: { m: 'λυσαμένοις', f: 'λυσαμέναις', n: 'λυσαμένοις' },
      },
      acc: {
        sg: { m: 'λυσάμενον', f: 'λυσαμένην', n: 'λυσάμενον' },
        pl: { m: 'λυσαμένους', f: 'λυσαμένας', n: 'λυσάμενα' },
      },
      voc: {
        sg: { m: 'λυσάμενε', f: 'λυσαμένη', n: 'λυσάμενον' },
        pl: { m: 'λυσάμενοι', f: 'λυσάμεναι', n: 'λυσάμενα' },
      },
    },
  },
  {
    id: 'aor-pass-ptc',
    label: 'Aorist Passive',
    tense: 'aorist',
    voice: 'passive',
    declensionNote: 'Masc./Neut.: 3rd declension (εντ-stem); Fem.: 1st declension',
    forms: {
      nom: {
        sg: { m: 'λυθείς', f: 'λυθεῖσα', n: 'λυθέν' },
        pl: { m: 'λυθέντες', f: 'λυθεῖσαι', n: 'λυθέντα' },
      },
      gen: {
        sg: { m: 'λυθέντος', f: 'λυθείσης', n: 'λυθέντος' },
        pl: { m: 'λυθέντων', f: 'λυθεισῶν', n: 'λυθέντων' },
      },
      dat: {
        sg: { m: 'λυθέντι', f: 'λυθείσῃ', n: 'λυθέντι' },
        pl: { m: 'λυθεῖσι(ν)', f: 'λυθείσαις', n: 'λυθεῖσι(ν)' },
      },
      acc: {
        sg: { m: 'λυθέντα', f: 'λυθεῖσαν', n: 'λυθέν' },
        pl: { m: 'λυθέντας', f: 'λυθείσας', n: 'λυθέντα' },
      },
      voc: {
        sg: { m: 'λυθείς', f: 'λυθεῖσα', n: 'λυθέν' },
        pl: { m: 'λυθέντες', f: 'λυθεῖσαι', n: 'λυθέντα' },
      },
    },
  },
  // ── Perfect ───────────────────────────────────────────────────────────────
  {
    id: 'perf-act-ptc',
    label: 'Perfect Active',
    tense: 'perfect',
    voice: 'active',
    declensionNote: 'Masc./Neut.: 3rd declension (οτ-stem); Fem.: 1st declension (υι-stem)',
    forms: {
      nom: {
        sg: { m: 'λελυκώς', f: 'λελυκυῖα', n: 'λελυκός' },
        pl: { m: 'λελυκότες', f: 'λελυκυῖαι', n: 'λελυκότα' },
      },
      gen: {
        sg: { m: 'λελυκότος', f: 'λελυκυίας', n: 'λελυκότος' },
        pl: { m: 'λελυκότων', f: 'λελυκυιῶν', n: 'λελυκότων' },
      },
      dat: {
        sg: { m: 'λελυκότι', f: 'λελυκυίᾳ', n: 'λελυκότι' },
        pl: { m: 'λελυκόσι(ν)', f: 'λελυκυίαις', n: 'λελυκόσι(ν)' },
      },
      acc: {
        sg: { m: 'λελυκότα', f: 'λελυκυῖαν', n: 'λελυκός' },
        pl: { m: 'λελυκότας', f: 'λελυκυίας', n: 'λελυκότα' },
      },
      voc: {
        sg: { m: 'λελυκώς', f: 'λελυκυῖα', n: 'λελυκός' },
        pl: { m: 'λελυκότες', f: 'λελυκυῖαι', n: 'λελυκότα' },
      },
    },
  },
  {
    id: 'perf-mid-pass-ptc',
    label: 'Perfect Mid./Pass.',
    tense: 'perfect',
    voice: 'mid-pass',
    declensionNote: 'Masc./Neut.: 2nd declension; Fem.: 1st declension',
    forms: {
      nom: {
        sg: { m: 'λελυμένος', f: 'λελυμένη', n: 'λελυμένον' },
        pl: { m: 'λελυμένοι', f: 'λελυμέναι', n: 'λελυμένα' },
      },
      gen: {
        sg: { m: 'λελυμένου', f: 'λελυμένης', n: 'λελυμένου' },
        pl: { m: 'λελυμένων', f: 'λελυμένων', n: 'λελυμένων' },
      },
      dat: {
        sg: { m: 'λελυμένῳ', f: 'λελυμένῃ', n: 'λελυμένῳ' },
        pl: { m: 'λελυμένοις', f: 'λελυμέναις', n: 'λελυμένοις' },
      },
      acc: {
        sg: { m: 'λελυμένον', f: 'λελυμένην', n: 'λελυμένον' },
        pl: { m: 'λελυμένους', f: 'λελυμένας', n: 'λελυμένα' },
      },
      voc: {
        sg: { m: 'λελυμένε', f: 'λελυμένη', n: 'λελυμένον' },
        pl: { m: 'λελυμένοι', f: 'λελυμέναι', n: 'λελυμένα' },
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Pronouns
// ---------------------------------------------------------------------------

export const personalPronouns12: PersonalPronoun12[] = [
  {
    id: 'ego',
    name: 'ἐγώ — 1st Person',
    kind: '1st',
    forms: {
      sg: { nom: 'ἐγώ', gen: 'ἐμοῦ / μου', dat: 'ἐμοί / μοι', acc: 'ἐμέ / με' },
      pl: { nom: 'ἡμεῖς', gen: 'ἡμῶν', dat: 'ἡμῖν', acc: 'ἡμᾶς' },
    },
  },
  {
    id: 'su',
    name: 'σύ — 2nd Person',
    kind: '2nd',
    forms: {
      sg: { nom: 'σύ', gen: 'σοῦ / σου', dat: 'σοί / σοι', acc: 'σέ / σε' },
      pl: { nom: 'ὑμεῖς', gen: 'ὑμῶν', dat: 'ὑμῖν', acc: 'ὑμᾶς' },
    },
  },
];

export const genderedPronouns: GenderedPronoun[] = [
  {
    id: 'autos',
    name: 'αὐτός — 3rd Person / Intensive',
    kind: '3rd-personal',
    forms: {
      nom: { sg: { m: 'αὐτός', f: 'αὐτή', n: 'αὐτό' }, pl: { m: 'αὐτοί', f: 'αὐταί', n: 'αὐτά' } },
      gen: {
        sg: { m: 'αὐτοῦ', f: 'αὐτῆς', n: 'αὐτοῦ' },
        pl: { m: 'αὐτῶν', f: 'αὐτῶν', n: 'αὐτῶν' },
      },
      dat: {
        sg: { m: 'αὐτῷ', f: 'αὐτῇ', n: 'αὐτῷ' },
        pl: { m: 'αὐτοῖς', f: 'αὐταῖς', n: 'αὐτοῖς' },
      },
      acc: {
        sg: { m: 'αὐτόν', f: 'αὐτήν', n: 'αὐτό' },
        pl: { m: 'αὐτούς', f: 'αὐτάς', n: 'αὐτά' },
      },
    },
  },
  {
    id: 'outos',
    name: 'οὗτος — Near Demonstrative (this)',
    kind: 'demonstrative',
    forms: {
      nom: {
        sg: { m: 'οὗτος', f: 'αὕτη', n: 'τοῦτο' },
        pl: { m: 'οὗτοι', f: 'αὗται', n: 'ταῦτα' },
      },
      gen: {
        sg: { m: 'τούτου', f: 'ταύτης', n: 'τούτου' },
        pl: { m: 'τούτων', f: 'τούτων', n: 'τούτων' },
      },
      dat: {
        sg: { m: 'τούτῳ', f: 'ταύτῃ', n: 'τούτῳ' },
        pl: { m: 'τούτοις', f: 'ταύταις', n: 'τούτοις' },
      },
      acc: {
        sg: { m: 'τοῦτον', f: 'ταύτην', n: 'τοῦτο' },
        pl: { m: 'τούτους', f: 'ταύτας', n: 'ταῦτα' },
      },
    },
  },
  {
    id: 'ekeinos',
    name: 'ἐκεῖνος — Far Demonstrative (that)',
    kind: 'demonstrative',
    forms: {
      nom: {
        sg: { m: 'ἐκεῖνος', f: 'ἐκείνη', n: 'ἐκεῖνο' },
        pl: { m: 'ἐκεῖνοι', f: 'ἐκεῖναι', n: 'ἐκεῖνα' },
      },
      gen: {
        sg: { m: 'ἐκείνου', f: 'ἐκείνης', n: 'ἐκείνου' },
        pl: { m: 'ἐκείνων', f: 'ἐκείνων', n: 'ἐκείνων' },
      },
      dat: {
        sg: { m: 'ἐκείνῳ', f: 'ἐκείνῃ', n: 'ἐκείνῳ' },
        pl: { m: 'ἐκείνοις', f: 'ἐκείναις', n: 'ἐκείνοις' },
      },
      acc: {
        sg: { m: 'ἐκεῖνον', f: 'ἐκείνην', n: 'ἐκεῖνο' },
        pl: { m: 'ἐκείνους', f: 'ἐκείνας', n: 'ἐκεῖνα' },
      },
    },
  },
  {
    id: 'hos',
    name: 'ὅς — Relative Pronoun (who, which, that)',
    kind: 'relative',
    forms: {
      nom: { sg: { m: 'ὅς', f: 'ἥ', n: 'ὅ' }, pl: { m: 'οἵ', f: 'αἵ', n: 'ἅ' } },
      gen: { sg: { m: 'οὗ', f: 'ἧς', n: 'οὗ' }, pl: { m: 'ὧν', f: 'ὧν', n: 'ὧν' } },
      dat: { sg: { m: 'ᾧ', f: 'ᾗ', n: 'ᾧ' }, pl: { m: 'οἷς', f: 'αἷς', n: 'οἷς' } },
      acc: { sg: { m: 'ὅν', f: 'ἥν', n: 'ὅ' }, pl: { m: 'οὕς', f: 'ἅς', n: 'ἅ' } },
    },
  },
  {
    id: 'tis',
    name: 'τίς / τις — Interrogative / Indefinite',
    kind: 'interrogative',
    forms: {
      nom: {
        sg: { m: 'τίς / τις', f: 'τίς / τις', n: 'τί / τι' },
        pl: { m: 'τίνες / τινές', f: 'τίνες / τινές', n: 'τίνα / τινά' },
      },
      gen: {
        sg: { m: 'τίνος / τινός', f: 'τίνος / τινός', n: 'τίνος / τινός' },
        pl: { m: 'τίνων / τινῶν', f: 'τίνων / τινῶν', n: 'τίνων / τινῶν' },
      },
      dat: {
        sg: { m: 'τίνι / τινί', f: 'τίνι / τινί', n: 'τίνι / τινί' },
        pl: { m: 'τίσι(ν)', f: 'τίσι(ν)', n: 'τίσι(ν)' },
      },
      acc: {
        sg: { m: 'τίνα / τινά', f: 'τίνα / τινά', n: 'τί / τι' },
        pl: { m: 'τίνας / τινάς', f: 'τίνας / τινάς', n: 'τίνα / τινά' },
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Prepositions
// ---------------------------------------------------------------------------

export const prepositions: PrepEntry[] = [
  // Genitive only
  { greek: 'ἀντί', cases: ['gen'], glosses: { gen: 'instead of, in place of' } },
  { greek: 'ἀπό', cases: ['gen'], glosses: { gen: 'from, away from' } },
  { greek: 'ἐκ / ἐξ', cases: ['gen'], glosses: { gen: 'from, out of' } },
  { greek: 'πρό', cases: ['gen'], glosses: { gen: 'before, in front of' } },
  // Dative only
  { greek: 'ἐν', cases: ['dat'], glosses: { dat: 'in, by, among, with' } },
  { greek: 'σύν', cases: ['dat'], glosses: { dat: 'with, together with' } },
  // Accusative only
  { greek: 'ἀνά', cases: ['acc'], glosses: { acc: 'up, each, in turn' } },
  { greek: 'εἰς', cases: ['acc'], glosses: { acc: 'into, to, for, in order to' } },
  // Genitive or accusative
  {
    greek: 'διά',
    cases: ['gen', 'acc'],
    glosses: { gen: 'through', acc: 'because of, on account of' },
  },
  {
    greek: 'κατά',
    cases: ['gen', 'acc'],
    glosses: { gen: 'against, down from', acc: 'according to, throughout, during' },
  },
  { greek: 'μετά', cases: ['gen', 'acc'], glosses: { gen: 'with', acc: 'after, behind' } },
  {
    greek: 'περί',
    cases: ['gen', 'acc'],
    glosses: { gen: 'concerning, about', acc: 'around, about' },
  },
  {
    greek: 'ὑπέρ',
    cases: ['gen', 'acc'],
    glosses: { gen: 'on behalf of, for', acc: 'above, over, more than' },
  },
  { greek: 'ὑπό', cases: ['gen', 'acc'], glosses: { gen: 'by (agent)', acc: 'under' } },
  // Genitive, dative, or accusative
  {
    greek: 'ἐπί',
    cases: ['gen', 'dat', 'acc'],
    glosses: {
      gen: 'on, over, at the time of',
      dat: 'on the basis of, at',
      acc: 'on, to, against',
    },
  },
  {
    greek: 'παρά',
    cases: ['gen', 'dat', 'acc'],
    glosses: {
      gen: 'from beside, from',
      dat: 'beside, with, in the presence of',
      acc: 'alongside, contrary to',
    },
  },
  {
    greek: 'πρός',
    cases: ['gen', 'dat', 'acc'],
    glosses: { gen: 'for the benefit of', dat: 'near, at', acc: 'to, toward, with' },
  },
];

// ---------------------------------------------------------------------------
// Definite article
// ---------------------------------------------------------------------------

/**
 * All forms of the Greek definite article, keyed by case → number → gender.
 * Null indicates that no article form exists for that slot (vocative has no article).
 */
export const articleForms: Record<CaseKey, Record<NumKey, Record<GenderKey, string | null>>> = {
  nom: {
    sg: { m: 'ὁ', f: 'ἡ', n: 'τό' },
    pl: { m: 'οἱ', f: 'αἱ', n: 'τά' },
  },
  gen: {
    sg: { m: 'τοῦ', f: 'τῆς', n: 'τοῦ' },
    pl: { m: 'τῶν', f: 'τῶν', n: 'τῶν' },
  },
  dat: {
    sg: { m: 'τῷ', f: 'τῇ', n: 'τῷ' },
    pl: { m: 'τοῖς', f: 'ταῖς', n: 'τοῖς' },
  },
  acc: {
    sg: { m: 'τόν', f: 'τήν', n: 'τό' },
    pl: { m: 'τούς', f: 'τάς', n: 'τά' },
  },
  voc: {
    sg: { m: null, f: null, n: null },
    pl: { m: null, f: null, n: null },
  },
};

/**
 * Return the definite article for a given case, number, and noun gender.
 * Returns null for the vocative (no article form exists).
 */
export function getArticle(
  caseKey: CaseKey,
  numKey: NumKey,
  gender: 'masculine' | 'feminine' | 'neuter',
): string | null {
  const gMap: Record<'masculine' | 'feminine' | 'neuter', GenderKey> = {
    masculine: 'm',
    feminine: 'f',
    neuter: 'n',
  };
  return articleForms[caseKey][numKey][gMap[gender]];
}

// ---------------------------------------------------------------------------
// Accent rules
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Contract verbs
// ---------------------------------------------------------------------------

export const contractionRules: ContractionRule[] = [
  { following: '+ ε', alpha: 'ᾱ (α)', epsilon: 'ει', omicron: 'ου' },
  { following: '+ ει', alpha: 'ᾳ', epsilon: 'ει', omicron: 'οι' },
  { following: '+ η', alpha: 'ᾱ (α)', epsilon: 'η', omicron: 'ω' },
  { following: '+ ο', alpha: 'ω', epsilon: 'ου', omicron: 'ου' },
  { following: '+ οι', alpha: 'ῳ', epsilon: 'οι', omicron: 'οι' },
  { following: '+ ου', alpha: 'ω', epsilon: 'ου', omicron: 'ου' },
  { following: '+ ω', alpha: 'ω', epsilon: 'ω', omicron: 'ω' },
];

export const contractVerbParadigms: ContractVerbParadigm[] = [
  // -------------------------------------------------------------------------
  // α-contract — ἀγαπάω (I love)
  // -------------------------------------------------------------------------
  {
    id: 'alpha-pres-act-ind',
    label: 'Present Active Indicative',
    contractType: 'alpha',
    group: 'indicative',
    forms: {
      '1sg': 'ἀγαπῶ',
      '2sg': 'ἀγαπᾷς',
      '3sg': 'ἀγαπᾷ',
      '1pl': 'ἀγαπῶμεν',
      '2pl': 'ἀγαπᾶτε',
      '3pl': 'ἀγαπῶσι(ν)',
    },
    uncontracted: {
      '1sg': 'ἀγαπάω',
      '2sg': 'ἀγαπάεις',
      '3sg': 'ἀγαπάει',
      '1pl': 'ἀγαπάομεν',
      '2pl': 'ἀγαπάετε',
      '3pl': 'ἀγαπάουσι(ν)',
    },
  },
  {
    id: 'alpha-pres-mid-ind',
    label: 'Present Middle/Passive Indicative',
    contractType: 'alpha',
    group: 'indicative',
    forms: {
      '1sg': 'ἀγαπῶμαι',
      '2sg': 'ἀγαπᾷ',
      '3sg': 'ἀγαπᾶται',
      '1pl': 'ἀγαπώμεθα',
      '2pl': 'ἀγαπᾶσθε',
      '3pl': 'ἀγαπῶνται',
    },
    uncontracted: {
      '1sg': 'ἀγαπάομαι',
      '2sg': 'ἀγαπάεσαι',
      '3sg': 'ἀγαπάεται',
      '1pl': 'ἀγαπαόμεθα',
      '2pl': 'ἀγαπάεσθε',
      '3pl': 'ἀγαπάονται',
    },
  },
  {
    id: 'alpha-impf-act-ind',
    label: 'Imperfect Active Indicative',
    contractType: 'alpha',
    group: 'indicative',
    forms: {
      '1sg': 'ἠγάπων',
      '2sg': 'ἠγάπας',
      '3sg': 'ἠγάπα',
      '1pl': 'ἠγαπῶμεν',
      '2pl': 'ἠγαπᾶτε',
      '3pl': 'ἠγάπων',
    },
    uncontracted: {
      '1sg': 'ἠγάπαον',
      '2sg': 'ἠγάπαες',
      '3sg': 'ἠγάπαε',
      '1pl': 'ἠγαπάομεν',
      '2pl': 'ἠγαπάετε',
      '3pl': 'ἠγάπαον',
    },
  },
  {
    id: 'alpha-impf-mid-ind',
    label: 'Imperfect Middle/Passive Indicative',
    contractType: 'alpha',
    group: 'indicative',
    forms: {
      '1sg': 'ἠγαπώμην',
      '2sg': 'ἠγαπῶ',
      '3sg': 'ἠγαπᾶτο',
      '1pl': 'ἠγαπώμεθα',
      '2pl': 'ἠγαπᾶσθε',
      '3pl': 'ἠγαπῶντο',
    },
    uncontracted: {
      '1sg': 'ἠγαπαόμην',
      '2sg': 'ἠγαπάου',
      '3sg': 'ἠγαπάετο',
      '1pl': 'ἠγαπαόμεθα',
      '2pl': 'ἠγαπάεσθε',
      '3pl': 'ἠγαπάοντο',
    },
  },

  // -------------------------------------------------------------------------
  // ε-contract — ποιέω (I do, make)
  // -------------------------------------------------------------------------
  {
    id: 'epsilon-pres-act-ind',
    label: 'Present Active Indicative',
    contractType: 'epsilon',
    group: 'indicative',
    forms: {
      '1sg': 'ποιῶ',
      '2sg': 'ποιεῖς',
      '3sg': 'ποιεῖ',
      '1pl': 'ποιοῦμεν',
      '2pl': 'ποιεῖτε',
      '3pl': 'ποιοῦσι(ν)',
    },
    uncontracted: {
      '1sg': 'ποιέω',
      '2sg': 'ποιέεις',
      '3sg': 'ποιέει',
      '1pl': 'ποιέομεν',
      '2pl': 'ποιέετε',
      '3pl': 'ποιέουσι(ν)',
    },
  },
  {
    id: 'epsilon-pres-mid-ind',
    label: 'Present Middle/Passive Indicative',
    contractType: 'epsilon',
    group: 'indicative',
    forms: {
      '1sg': 'ποιοῦμαι',
      '2sg': 'ποιῇ',
      '3sg': 'ποιεῖται',
      '1pl': 'ποιούμεθα',
      '2pl': 'ποιεῖσθε',
      '3pl': 'ποιοῦνται',
    },
    uncontracted: {
      '1sg': 'ποιέομαι',
      '2sg': 'ποιέεσαι',
      '3sg': 'ποιέεται',
      '1pl': 'ποιεόμεθα',
      '2pl': 'ποιέεσθε',
      '3pl': 'ποιέονται',
    },
  },
  {
    id: 'epsilon-impf-act-ind',
    label: 'Imperfect Active Indicative',
    contractType: 'epsilon',
    group: 'indicative',
    forms: {
      '1sg': 'ἐποίουν',
      '2sg': 'ἐποίεις',
      '3sg': 'ἐποίει',
      '1pl': 'ἐποιοῦμεν',
      '2pl': 'ἐποιεῖτε',
      '3pl': 'ἐποίουν',
    },
    uncontracted: {
      '1sg': 'ἐποίεον',
      '2sg': 'ἐποίεες',
      '3sg': 'ἐποίεε',
      '1pl': 'ἐποιέομεν',
      '2pl': 'ἐποιέετε',
      '3pl': 'ἐποίεον',
    },
  },
  {
    id: 'epsilon-impf-mid-ind',
    label: 'Imperfect Middle/Passive Indicative',
    contractType: 'epsilon',
    group: 'indicative',
    forms: {
      '1sg': 'ἐποιούμην',
      '2sg': 'ἐποιοῦ',
      '3sg': 'ἐποιεῖτο',
      '1pl': 'ἐποιούμεθα',
      '2pl': 'ἐποιεῖσθε',
      '3pl': 'ἐποιοῦντο',
    },
    uncontracted: {
      '1sg': 'ἐποιεόμην',
      '2sg': 'ἐποιέου',
      '3sg': 'ἐποιέετο',
      '1pl': 'ἐποιεόμεθα',
      '2pl': 'ἐποιέεσθε',
      '3pl': 'ἐποιέοντο',
    },
  },

  // -------------------------------------------------------------------------
  // ο-contract — πληρόω (I fill, fulfill)
  // -------------------------------------------------------------------------
  {
    id: 'omicron-pres-act-ind',
    label: 'Present Active Indicative',
    contractType: 'omicron',
    group: 'indicative',
    forms: {
      '1sg': 'πληρῶ',
      '2sg': 'πληροῖς',
      '3sg': 'πληροῖ',
      '1pl': 'πληροῦμεν',
      '2pl': 'πληροῦτε',
      '3pl': 'πληροῦσι(ν)',
    },
    uncontracted: {
      '1sg': 'πληρόω',
      '2sg': 'πληρόεις',
      '3sg': 'πληρόει',
      '1pl': 'πληρόομεν',
      '2pl': 'πληρόετε',
      '3pl': 'πληρόουσι(ν)',
    },
  },
  {
    id: 'omicron-pres-mid-ind',
    label: 'Present Middle/Passive Indicative',
    contractType: 'omicron',
    group: 'indicative',
    forms: {
      '1sg': 'πληροῦμαι',
      '2sg': 'πληροῖ',
      '3sg': 'πληροῦται',
      '1pl': 'πληρούμεθα',
      '2pl': 'πληροῦσθε',
      '3pl': 'πληροῦνται',
    },
    uncontracted: {
      '1sg': 'πληρόομαι',
      '2sg': 'πληρόεσαι',
      '3sg': 'πληρόεται',
      '1pl': 'πληροόμεθα',
      '2pl': 'πληρόεσθε',
      '3pl': 'πληρόονται',
    },
  },
  {
    id: 'omicron-impf-act-ind',
    label: 'Imperfect Active Indicative',
    contractType: 'omicron',
    group: 'indicative',
    forms: {
      '1sg': 'ἐπλήρουν',
      '2sg': 'ἐπλήρους',
      '3sg': 'ἐπλήρου',
      '1pl': 'ἐπληροῦμεν',
      '2pl': 'ἐπληροῦτε',
      '3pl': 'ἐπλήρουν',
    },
    uncontracted: {
      '1sg': 'ἐπλήρόον',
      '2sg': 'ἐπλήρόες',
      '3sg': 'ἐπλήρόε',
      '1pl': 'ἐπληρόομεν',
      '2pl': 'ἐπληρόετε',
      '3pl': 'ἐπλήρόον',
    },
  },
  {
    id: 'omicron-impf-mid-ind',
    label: 'Imperfect Middle/Passive Indicative',
    contractType: 'omicron',
    group: 'indicative',
    forms: {
      '1sg': 'ἐπληρούμην',
      '2sg': 'ἐπληροῦ',
      '3sg': 'ἐπληροῦτο',
      '1pl': 'ἐπληρούμεθα',
      '2pl': 'ἐπληροῦσθε',
      '3pl': 'ἐπληροῦντο',
    },
    uncontracted: {
      '1sg': 'ἐπληροόμην',
      '2sg': 'ἐπληρόου',
      '3sg': 'ἐπληρόετο',
      '1pl': 'ἐπληροόμεθα',
      '2pl': 'ἐπληρόεσθε',
      '3pl': 'ἐπληρόοντο',
    },
  },
];

export const commonContractVerbs: CommonContractVerb[] = [
  // α-contracts
  { greek: 'ἀγαπάω', type: 'alpha', gloss: 'I love' },
  { greek: 'ὁράω', type: 'alpha', gloss: 'I see' },
  { greek: 'ἐρωτάω', type: 'alpha', gloss: 'I ask' },
  { greek: 'νικάω', type: 'alpha', gloss: 'I conquer' },
  { greek: 'τιμάω', type: 'alpha', gloss: 'I honor' },
  { greek: 'γεννάω', type: 'alpha', gloss: 'I beget, give birth' },
  { greek: 'πλανάω', type: 'alpha', gloss: 'I lead astray' },
  // ε-contracts
  { greek: 'ποιέω', type: 'epsilon', gloss: 'I do, make' },
  { greek: 'λαλέω', type: 'epsilon', gloss: 'I speak' },
  { greek: 'καλέω', type: 'epsilon', gloss: 'I call' },
  { greek: 'ζητέω', type: 'epsilon', gloss: 'I seek' },
  { greek: 'θεωρέω', type: 'epsilon', gloss: 'I see, observe' },
  { greek: 'τηρέω', type: 'epsilon', gloss: 'I keep, guard' },
  { greek: 'μαρτυρέω', type: 'epsilon', gloss: 'I bear witness' },
  { greek: 'ἀκολουθέω', type: 'epsilon', gloss: 'I follow' },
  { greek: 'προσκυνέω', type: 'epsilon', gloss: 'I worship' },
  // ο-contracts
  { greek: 'πληρόω', type: 'omicron', gloss: 'I fill, fulfill' },
  { greek: 'δικαιόω', type: 'omicron', gloss: 'I justify' },
  { greek: 'σταυρόω', type: 'omicron', gloss: 'I crucify' },
  { greek: 'φανερόω', type: 'omicron', gloss: 'I reveal, manifest' },
  { greek: 'ἐλευθερόω', type: 'omicron', gloss: 'I set free' },
];

// ---------------------------------------------------------------------------
// Liquid verbs
// ---------------------------------------------------------------------------

export const liquidFutureComparison: LiquidFutureRow[] = [
  { person: '1sg', standard: 'λύσω', liquid: 'βαλῶ' },
  { person: '2sg', standard: 'λύσεις', liquid: 'βαλεῖς' },
  { person: '3sg', standard: 'λύσει', liquid: 'βαλεῖ' },
  { person: '1pl', standard: 'λύσομεν', liquid: 'βαλοῦμεν' },
  { person: '2pl', standard: 'λύσετε', liquid: 'βαλεῖτε' },
  { person: '3pl', standard: 'λύσουσι(ν)', liquid: 'βαλοῦσι(ν)' },
];

export const liquidPrincipalParts: LiquidPrincipalParts[] = [
  {
    id: 'ballo',
    lexical: 'βάλλω',
    gloss: 'I throw, put',
    future: 'βαλῶ',
    aoristAct: 'ἔβαλον',
    perfectAct: 'βέβληκα',
    perfectMidPass: 'βέβλημαι',
    aoristPass: 'ἐβλήθην',
  },
  {
    id: 'airo',
    lexical: 'αἴρω',
    gloss: 'I lift, take away',
    future: 'ἀρῶ',
    aoristAct: 'ἦρα',
    perfectAct: 'ἦρκα',
    perfectMidPass: 'ἦρμαι',
    aoristPass: 'ἤρθην',
  },
  {
    id: 'apostello',
    lexical: 'ἀποστέλλω',
    gloss: 'I send (out)',
    future: 'ἀποστελῶ',
    aoristAct: 'ἀπέστειλα',
    perfectAct: 'ἀπέσταλκα',
    perfectMidPass: 'ἀπέσταλμαι',
    aoristPass: 'ἀπεστάλην',
  },
  {
    id: 'krino',
    lexical: 'κρίνω',
    gloss: 'I judge',
    future: 'κρινῶ',
    aoristAct: 'ἔκρινα',
    perfectAct: 'κέκρικα',
    perfectMidPass: 'κέκριμαι',
    aoristPass: 'ἐκρίθην',
  },
  {
    id: 'meno',
    lexical: 'μένω',
    gloss: 'I remain, stay',
    future: 'μενῶ',
    aoristAct: 'ἔμεινα',
    perfectAct: 'μεμένηκα',
    perfectMidPass: '—',
    aoristPass: '—',
  },
  {
    id: 'egeiro',
    lexical: 'ἐγείρω',
    gloss: 'I raise up, wake',
    future: 'ἐγερῶ',
    aoristAct: 'ἤγειρα',
    perfectAct: 'ἐγήγερκα',
    perfectMidPass: 'ἐγήγερμαι',
    aoristPass: 'ἠγέρθην',
  },
  {
    id: 'aggello',
    lexical: 'ἀγγέλλω',
    gloss: 'I announce, report',
    future: 'ἀγγελῶ',
    aoristAct: 'ἤγγειλα',
    perfectAct: 'ἤγγελκα',
    perfectMidPass: 'ἤγγελμαι',
    aoristPass: 'ἠγγέλην',
  },
  {
    id: 'phaino',
    lexical: 'φαίνω',
    gloss: 'I shine; appear (mid.)',
    future: 'φανῶ',
    aoristAct: 'ἔφηνα',
    perfectAct: 'πέφηνα',
    perfectMidPass: '—',
    aoristPass: 'ἐφάνην',
  },
];

// ---------------------------------------------------------------------------
// μι-verb entries and paradigms
// ---------------------------------------------------------------------------

export const miVerbEntries: MiVerbEntry[] = [
  {
    id: 'didomi',
    lexical: 'δίδωμι',
    gloss: 'I give',
    gntCount: 415,
    patternNotes: [
      'Reduplication: δι- (the initial consonant + ι).',
      'Present stem δίδω-/δίδο-: the ω in sg lengthens to ω, shortens to ο in pl.',
      'No thematic vowel — endings attach directly to the stem.',
      'κ-Aorist: ἔδωκα (not the standard -σα ending); 3pl ἔδωκαν is unique.',
      'Imperfect uses contracted ου forms (ε + ο → ου).',
    ],
    infinitives: [
      { label: 'Present Active', form: 'διδόναι' },
      { label: 'Aorist Active', form: 'δοῦναι' },
    ],
    participleNomSg: [
      { label: 'Present Active', m: 'διδούς', f: 'διδοῦσα', n: 'διδόν' },
      { label: 'Aorist Active', m: 'δούς', f: 'δοῦσα', n: 'δόν' },
    ],
  },
  {
    id: 'histemi',
    lexical: 'ἵστημι',
    gloss: 'I set, stand',
    gntCount: 154,
    patternNotes: [
      'Reduplication: ἱ- (vocalic; the initial σ drops, leaving only the vowel).',
      'Present stem ἱστη-/ἱστα-: η in sg, α in pl (η/α ablaut).',
      'Transitive vs. intransitive: present/imperfect/1st aorist (ἔστησα) are transitive; 2nd aorist (ἔστην) and perfect are intransitive.',
      'The 2nd aorist (ἔστην) is by far the most common in the GNT.',
      '2nd aorist uses secondary active endings without a thematic vowel.',
    ],
    infinitives: [
      { label: 'Present Active', form: 'ἱστάναι' },
      { label: 'Aorist Active (2nd)', form: 'στῆναι' },
    ],
    participleNomSg: [
      { label: 'Present Active', m: 'ἱστάς', f: 'ἱστᾶσα', n: 'ἱστάν' },
      { label: 'Aorist Active (2nd)', m: 'στάς', f: 'στᾶσα', n: 'στάν' },
    ],
  },
  {
    id: 'aphiemi',
    lexical: 'ἀφίημι',
    gloss: 'I forgive, release, allow',
    gntCount: 143,
    patternNotes: [
      'Compound: ἀπό + ἵημι; ἀπο- assimilates to ἀφ- before ι.',
      'Present stem ἀφιε-/ἀφιη-: derived from ἵημι (reduplication ἱε-).',
      'κ-Aorist: ἀφῆκα — the prefix carries the augment (ἀπ → ἀφ + η).',
      'Imperfect augments the verb root: ἤφιον (η replaces ε of ἵημι).',
      'GNT aorist imperative ἄφες is the most frequent imperatival form.',
    ],
    infinitives: [
      { label: 'Present Active', form: 'ἀφιέναι' },
      { label: 'Aorist Active', form: 'ἀφεῖναι' },
    ],
    participleNomSg: [
      { label: 'Present Active', m: 'ἀφιείς', f: 'ἀφιεῖσα', n: 'ἀφιέν' },
      { label: 'Aorist Active', m: 'ἀφείς', f: 'ἀφεῖσα', n: 'ἀφέν' },
    ],
  },
  {
    id: 'tithemi',
    lexical: 'τίθημι',
    gloss: 'I place, put',
    gntCount: 100,
    patternNotes: [
      'Reduplication: τι- (initial τ + ι).',
      'Present stem τίθη-/τίθε-: η in sg lengthens, shortens to ε in pl.',
      'κ-Aorist: ἔθηκα — note the η-grade in the aorist stem (θη- vs. θε-).',
      'Aorist subjunctive/imperative use short stem θε- (θῶ, θές).',
      'Closely parallels δίδωμι in its overall pattern.',
    ],
    infinitives: [
      { label: 'Present Active', form: 'τιθέναι' },
      { label: 'Aorist Active', form: 'θεῖναι' },
    ],
    participleNomSg: [
      { label: 'Present Active', m: 'τιθείς', f: 'τιθεῖσα', n: 'τιθέν' },
      { label: 'Aorist Active', m: 'θείς', f: 'θεῖσα', n: 'θέν' },
    ],
  },
];

export const miVerbParadigms: MiVerbParadigm[] = [
  // ── δίδωμι ──────────────────────────────────────────────────────────────
  {
    id: 'didomi-pres-ind',
    verbId: 'didomi',
    label: 'Present Active Indicative',
    group: 'indicative',
    forms: {
      '1sg': 'δίδωμι',
      '2sg': 'δίδως',
      '3sg': 'δίδωσι(ν)',
      '1pl': 'δίδομεν',
      '2pl': 'δίδοτε',
      '3pl': 'διδόασι(ν)',
    },
  },
  {
    id: 'didomi-impf-ind',
    verbId: 'didomi',
    label: 'Imperfect Active Indicative',
    group: 'indicative',
    forms: {
      '1sg': 'ἐδίδουν',
      '2sg': 'ἐδίδους',
      '3sg': 'ἐδίδου',
      '1pl': 'ἐδίδομεν',
      '2pl': 'ἐδίδοτε',
      '3pl': 'ἐδίδοσαν',
    },
  },
  {
    id: 'didomi-aor-ind',
    verbId: 'didomi',
    label: 'Aorist Active Indicative',
    group: 'indicative',
    forms: {
      '1sg': 'ἔδωκα',
      '2sg': 'ἔδωκας',
      '3sg': 'ἔδωκε(ν)',
      '1pl': 'ἐδώκαμεν',
      '2pl': 'ἐδώκατε',
      '3pl': 'ἔδωκαν',
    },
  },
  {
    id: 'didomi-pres-subj',
    verbId: 'didomi',
    label: 'Present Active Subjunctive',
    group: 'subjunctive',
    forms: {
      '1sg': 'διδῶ',
      '2sg': 'διδῷς',
      '3sg': 'διδῷ',
      '1pl': 'διδῶμεν',
      '2pl': 'διδῶτε',
      '3pl': 'διδῶσι(ν)',
    },
  },
  {
    id: 'didomi-aor-subj',
    verbId: 'didomi',
    label: 'Aorist Active Subjunctive',
    group: 'subjunctive',
    forms: {
      '1sg': 'δῶ',
      '2sg': 'δῷς',
      '3sg': 'δῷ',
      '1pl': 'δῶμεν',
      '2pl': 'δῶτε',
      '3pl': 'δῶσι(ν)',
    },
  },
  {
    id: 'didomi-pres-imptv',
    verbId: 'didomi',
    label: 'Present Active Imperative',
    group: 'imperative',
    forms: {
      '2sg': 'δίδου',
      '3sg': 'διδότω',
      '2pl': 'δίδοτε',
      '3pl': 'διδότωσαν',
    },
  },
  {
    id: 'didomi-aor-imptv',
    verbId: 'didomi',
    label: 'Aorist Active Imperative',
    group: 'imperative',
    forms: {
      '2sg': 'δός',
      '3sg': 'δότω',
      '2pl': 'δότε',
      '3pl': 'δότωσαν',
    },
  },

  // ── ἵστημι ──────────────────────────────────────────────────────────────
  {
    id: 'histemi-pres-ind',
    verbId: 'histemi',
    label: 'Present Active Indicative',
    group: 'indicative',
    forms: {
      '1sg': 'ἵστημι',
      '2sg': 'ἵστης',
      '3sg': 'ἵστησι(ν)',
      '1pl': 'ἵσταμεν',
      '2pl': 'ἵστατε',
      '3pl': 'ἱστᾶσι(ν)',
    },
  },
  {
    id: 'histemi-impf-ind',
    verbId: 'histemi',
    label: 'Imperfect Active Indicative',
    group: 'indicative',
    forms: {
      '1sg': 'ἵστην',
      '2sg': 'ἵστης',
      '3sg': 'ἵστη',
      '1pl': 'ἵσταμεν',
      '2pl': 'ἵστατε',
      '3pl': 'ἵστασαν',
    },
  },
  {
    id: 'histemi-aor-ind',
    verbId: 'histemi',
    label: 'Aorist Active Indicative (2nd)',
    group: 'indicative',
    forms: {
      '1sg': 'ἔστην',
      '2sg': 'ἔστης',
      '3sg': 'ἔστη',
      '1pl': 'ἔστημεν',
      '2pl': 'ἔστητε',
      '3pl': 'ἔστησαν',
    },
  },
  {
    id: 'histemi-pres-subj',
    verbId: 'histemi',
    label: 'Present Active Subjunctive',
    group: 'subjunctive',
    forms: {
      '1sg': 'ἱστῶ',
      '2sg': 'ἱστῇς',
      '3sg': 'ἱστῇ',
      '1pl': 'ἱστῶμεν',
      '2pl': 'ἱστῆτε',
      '3pl': 'ἱστῶσι(ν)',
    },
  },
  {
    id: 'histemi-aor-subj',
    verbId: 'histemi',
    label: 'Aorist Active Subjunctive (2nd)',
    group: 'subjunctive',
    forms: {
      '1sg': 'στῶ',
      '2sg': 'στῇς',
      '3sg': 'στῇ',
      '1pl': 'στῶμεν',
      '2pl': 'στῆτε',
      '3pl': 'στῶσι(ν)',
    },
  },
  {
    id: 'histemi-pres-imptv',
    verbId: 'histemi',
    label: 'Present Active Imperative',
    group: 'imperative',
    forms: {
      '2sg': 'ἵστη',
      '3sg': 'ἱστάτω',
      '2pl': 'ἵστατε',
      '3pl': 'ἱστάτωσαν',
    },
  },
  {
    id: 'histemi-aor-imptv',
    verbId: 'histemi',
    label: 'Aorist Active Imperative (2nd)',
    group: 'imperative',
    forms: {
      '2sg': 'στῆθι',
      '3sg': 'στήτω',
      '2pl': 'στῆτε',
      '3pl': 'στήτωσαν',
    },
  },

  // ── ἀφίημι ──────────────────────────────────────────────────────────────
  {
    id: 'aphiemi-pres-ind',
    verbId: 'aphiemi',
    label: 'Present Active Indicative',
    group: 'indicative',
    forms: {
      '1sg': 'ἀφίημι',
      '2sg': 'ἀφίης',
      '3sg': 'ἀφίησι(ν)',
      '1pl': 'ἀφίεμεν',
      '2pl': 'ἀφίετε',
      '3pl': 'ἀφιᾶσι(ν)',
    },
  },
  {
    id: 'aphiemi-impf-ind',
    verbId: 'aphiemi',
    label: 'Imperfect Active Indicative',
    group: 'indicative',
    forms: {
      '1sg': 'ἤφιον',
      '2sg': 'ἤφιες',
      '3sg': 'ἤφιε(ν)',
      '1pl': 'ἀφίεμεν',
      '2pl': 'ἀφίετε',
      '3pl': 'ἤφιον',
    },
  },
  {
    id: 'aphiemi-aor-ind',
    verbId: 'aphiemi',
    label: 'Aorist Active Indicative',
    group: 'indicative',
    forms: {
      '1sg': 'ἀφῆκα',
      '2sg': 'ἀφῆκας',
      '3sg': 'ἀφῆκε(ν)',
      '1pl': 'ἀφήκαμεν',
      '2pl': 'ἀφήκατε',
      '3pl': 'ἀφῆκαν',
    },
  },
  {
    id: 'aphiemi-pres-subj',
    verbId: 'aphiemi',
    label: 'Present Active Subjunctive',
    group: 'subjunctive',
    forms: {
      '1sg': 'ἀφιῶ',
      '2sg': 'ἀφιῇς',
      '3sg': 'ἀφιῇ',
      '1pl': 'ἀφιῶμεν',
      '2pl': 'ἀφιῆτε',
      '3pl': 'ἀφιῶσι(ν)',
    },
  },
  {
    id: 'aphiemi-aor-subj',
    verbId: 'aphiemi',
    label: 'Aorist Active Subjunctive',
    group: 'subjunctive',
    forms: {
      '1sg': 'ἀφῶ',
      '2sg': 'ἀφῇς',
      '3sg': 'ἀφῇ',
      '1pl': 'ἀφῶμεν',
      '2pl': 'ἀφῆτε',
      '3pl': 'ἀφῶσι(ν)',
    },
  },
  {
    id: 'aphiemi-pres-imptv',
    verbId: 'aphiemi',
    label: 'Present Active Imperative',
    group: 'imperative',
    forms: {
      '2sg': 'ἀφίει',
      '3sg': 'ἀφιέτω',
      '2pl': 'ἀφίετε',
      '3pl': 'ἀφιέτωσαν',
    },
  },
  {
    id: 'aphiemi-aor-imptv',
    verbId: 'aphiemi',
    label: 'Aorist Active Imperative',
    group: 'imperative',
    forms: {
      '2sg': 'ἄφες',
      '3sg': 'ἀφέτω',
      '2pl': 'ἄφετε',
      '3pl': 'ἀφέτωσαν',
    },
  },

  // ── τίθημι ──────────────────────────────────────────────────────────────
  {
    id: 'tithemi-pres-ind',
    verbId: 'tithemi',
    label: 'Present Active Indicative',
    group: 'indicative',
    forms: {
      '1sg': 'τίθημι',
      '2sg': 'τίθης',
      '3sg': 'τίθησι(ν)',
      '1pl': 'τίθεμεν',
      '2pl': 'τίθετε',
      '3pl': 'τιθέασι(ν)',
    },
  },
  {
    id: 'tithemi-impf-ind',
    verbId: 'tithemi',
    label: 'Imperfect Active Indicative',
    group: 'indicative',
    forms: {
      '1sg': 'ἐτίθειν',
      '2sg': 'ἐτίθεις',
      '3sg': 'ἐτίθει',
      '1pl': 'ἐτίθεμεν',
      '2pl': 'ἐτίθετε',
      '3pl': 'ἐτίθεσαν',
    },
  },
  {
    id: 'tithemi-aor-ind',
    verbId: 'tithemi',
    label: 'Aorist Active Indicative',
    group: 'indicative',
    forms: {
      '1sg': 'ἔθηκα',
      '2sg': 'ἔθηκας',
      '3sg': 'ἔθηκε(ν)',
      '1pl': 'ἐθήκαμεν',
      '2pl': 'ἐθήκατε',
      '3pl': 'ἔθηκαν',
    },
  },
  {
    id: 'tithemi-pres-subj',
    verbId: 'tithemi',
    label: 'Present Active Subjunctive',
    group: 'subjunctive',
    forms: {
      '1sg': 'τιθῶ',
      '2sg': 'τιθῇς',
      '3sg': 'τιθῇ',
      '1pl': 'τιθῶμεν',
      '2pl': 'τιθῆτε',
      '3pl': 'τιθῶσι(ν)',
    },
  },
  {
    id: 'tithemi-aor-subj',
    verbId: 'tithemi',
    label: 'Aorist Active Subjunctive',
    group: 'subjunctive',
    forms: {
      '1sg': 'θῶ',
      '2sg': 'θῇς',
      '3sg': 'θῇ',
      '1pl': 'θῶμεν',
      '2pl': 'θῆτε',
      '3pl': 'θῶσι(ν)',
    },
  },
  {
    id: 'tithemi-pres-imptv',
    verbId: 'tithemi',
    label: 'Present Active Imperative',
    group: 'imperative',
    forms: {
      '2sg': 'τίθει',
      '3sg': 'τιθέτω',
      '2pl': 'τίθετε',
      '3pl': 'τιθέτωσαν',
    },
  },
  {
    id: 'tithemi-aor-imptv',
    verbId: 'tithemi',
    label: 'Aorist Active Imperative',
    group: 'imperative',
    forms: {
      '2sg': 'θές',
      '3sg': 'θέτω',
      '2pl': 'θέτε',
      '3pl': 'θέτωσαν',
    },
  },
];

// ---------------------------------------------------------------------------
// Accent rules
// ---------------------------------------------------------------------------

export const accentSections: AccentSection[] = [
  {
    title: 'The Three Accents',
    rules: [
      'Acute (ά) — can stand on any of the last three syllables (antepenult, penult, or ultima).',
      'Circumflex (ᾶ) — can stand only on the last two syllables (penult or ultima), and only on a long vowel or diphthong.',
      'Grave (ὰ) — replaces an acute on the ultima when another word follows immediately in the sentence.',
    ],
  },
  {
    title: 'Syllable Terminology',
    rules: [
      'Ultima — the last syllable.',
      'Penult — the second-to-last syllable.',
      'Antepenult — the third-to-last syllable.',
      'A syllable is long if it contains a long vowel (η, ω) or a diphthong.',
    ],
  },
  {
    title: 'Recessive Accent (Verbs)',
    rules: [
      'Finite verb forms take a recessive accent — it moves as far toward the beginning of the word as the rules allow.',
      'If the ultima is short, the accent falls on the antepenult (acute): λύ-ο-μεν.',
      'If the ultima is long, the accent falls on the penult (acute): λύ-ω (long ultima -ω forces accent to penult).',
    ],
  },
  {
    title: 'Persistent Accent (Nouns)',
    rules: [
      'Nouns try to keep the accent on the same syllable as the lexical form (nominative singular).',
      'The accent shifts only when forced by the accent rules (e.g., long ultima forces antepenult accent back to penult).',
      'Genitive and dative plurals of 1st and 2nd declension nouns always receive a circumflex on the ultima: ἡμερῶν, λόγων.',
    ],
  },
  {
    title: 'Penult Rule',
    rules: [
      'If the penult is long and the ultima is short, the penult takes a circumflex: δοῦλος.',
      'If the penult is long and the ultima is long, the penult takes an acute: δούλου.',
      'If the penult is short, it can only take an acute.',
    ],
  },
  {
    title: 'Proclitics & Enclitics',
    rules: [
      'Proclitics are words that attach to the following word and normally have no accent: ὁ, ἡ, οἱ, αἱ, εἰ, ὡς, εἰς, ἐκ/ἐξ, ἐν, οὐ/οὐκ/οὐχ.',
      'Enclitics attach to the preceding word: μου, μοι, με, σου, σοι, σε, τις, τι, εἰμί (most forms), φημί (some forms).',
      'When an enclitic follows an oxytone (acute on ultima), the grave is replaced by the acute: καρπός τις → καρπός τις (accent retained).',
    ],
  },
  {
    title: 'Common Accent Shifts to Know',
    rules: [
      'Oxytone nouns (acute on ultima) change to grave before another word: λόγος is λογός in isolation but λογὸς before the next word.',
      '1st declension genitive plural always has circumflex on ultima: γλωσσῶν, ἡμερῶν.',
      'Monosyllabic 3rd declension nouns accent the ultima in genitive and dative: σαρκός, σαρκί.',
    ],
  },
];
