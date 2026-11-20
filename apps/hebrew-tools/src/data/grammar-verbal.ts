// The prose around the Qal tables in the Grammar Reference (6d, #153): a note
// or two under each group that needs one, and the Waw Consecutive section.
//
// The tables themselves are `verb-paradigms.ts`, which the paradigm quiz also
// reads. This file is only what a reference adds on top. It is general grammar
// in the app's own words, and every Hebrew word in it is looked up in the
// Westminster Leningrad Codex by `grammar-verbal.test.ts`, as the noun and
// pronoun notes are.

import type { QalGroup } from './verb-paradigms';

/** Notes under a Qal group's table. A group with nothing to add has none. */
export const QAL_GROUP_NOTES: Partial<Record<QalGroup, string[]>> = {
  weqatal: [
    'The qatal with וְ, read as the next step of something still to happen. See Waw Consecutive.',
  ],
  imperative: [
    'A command to the person addressed, so only the second person. It is the yiqtol without its preformative: תִּכְתֹּב, כְּתֹב.',
    'Where an ending adds a vowel, the two shewas that would stand together at the front become hireq: כִּתְבוּ.',
    'A prohibition never uses the imperative. It is לֹא with the yiqtol, or אַל with the jussive.',
  ],
  infinitives: [
    'The infinitive construct is spelled like the 2ms imperative. It is a verbal noun and most often follows a preposition: לִכְתֹּב, "to write".',
    'The infinitive absolute stands on its own, with no preposition or suffix. Before a finite verb of the same root it strengthens it: מוֹת תָּמוּת, "you shall surely die".',
  ],
  participles: [
    'A participle is a verbal adjective. It agrees with its noun in gender and number, and can stand for a noun itself: שֹׁמֵר, "one who keeps".',
    'The active participle describes action in progress. It has no time of its own; the context sets it in the past, present or future.',
    'The passive participle describes the state an action leaves behind: כָּתוּב, "written".',
  ],
};

/** What the Waw Consecutive section says, under its tables. */
export const wawConsecutiveNotes: string[] = [
  'Biblical narrative moves forward on the wayyiqtol: וַ, the preformative doubled, and the verb. Each one is the next event: וַיֹּאמֶר, "and he said".',
  'The א of the 1cs cannot be doubled, so the וַ lengthens to וָ instead: וָאֶכְתֹּב.',
  'In the III-ה verbs the wayyiqtol drops its final syllable where no ending follows: וַיִּבֶן, not וַיִּבְנֶה.',
  'The weqatal is the qatal with וְ. It carries on whatever a yiqtol or an imperative began, so it reads as future, habitual or a further command: וְאָמַרְתָּ, "and you shall say".',
  'Before a vocal sheva the waw is written וּ: וּשְׁמַרְתֶּם.',
  'In the 2ms and 1cs of the weqatal the stress moves to the last syllable: כָּתַ֫בְתָּ but וְכָתַבְתָּ֫. The tables mark it there.',
  'The chain breaks wherever a clause does not open with the verb. A negative, or a subject or time phrase put first, takes a plain qatal or yiqtol.',
];
