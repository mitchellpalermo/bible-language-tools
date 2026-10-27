/**
 * greek.tools' binding of the shared quiz settings — accent strictness and
 * difficulty, kept in localStorage so they survive page reloads.
 *
 * This was a hand-written copy of the shared module, identical in behaviour.
 * It became a binding when the page needed the defaults too (ADR 006): two
 * copies would have needed the same change made twice.
 */

export type { Density, QuizSettings } from '@tools/shared/quiz-settings';

import { createQuizSettings } from '@tools/shared/quiz-settings';

export const QUIZ_SETTINGS_KEY = 'greek-tools-quiz-settings-v1';

export const { loadQuizSettings, saveQuizSettings, defaultQuizSettings } =
  createQuizSettings(QUIZ_SETTINGS_KEY);
