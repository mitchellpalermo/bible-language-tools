/**
 * hebrew.tools' binding of the shared quiz settings.
 *
 * The default density is `hard` — every cell blank. The paradigm quiz is
 * rehearsal for writing a table out from memory, which is what a Section Exam
 * asks for; a quiz that hands back half the forms is the easier exercise, and
 * it is there for whoever wants it rather than being where everyone starts.
 *
 * `accentStrict` keeps its Greek-flavoured name because the stored shape is
 * shared. Here it means: a wrong vowel or a missing dagesh counts against you.
 */

export type { Density, QuizSettings } from '@tools/shared/quiz-settings';

import { createQuizSettings } from '@tools/shared/quiz-settings';

export const QUIZ_SETTINGS_KEY = 'hebrew-tools-quiz-settings-v1';

export const { loadQuizSettings, saveQuizSettings } = createQuizSettings(QUIZ_SETTINGS_KEY, {
  density: 'hard',
});
