// Access to the shared bible-language-tools D1 database.
//
// One database backs both greek.tools and hebrew.tools. A user who signs in to
// both resolves to a single `users` row; their study progress is kept apart by
// the `language` column on srs_cards, study_stats, and sync_state. That column
// is the entire isolation mechanism — every read and write this app issues must
// be scoped by LANGUAGE, or it will reach into greek-tools' data.
//
// Schema and migrations live in packages/db. This module is deliberately thin;
// it exists so LANGUAGE has one definition and one import site. See issue #91.

import { createDb, type Language } from '@tools/db';

/** The language tag on every row hebrew-tools reads or writes. */
export const LANGUAGE: Language = 'hebrew';

export type { Language };
export { createDb };
