// This app's binding of `@tools/shared/attempt-log` (#196, #209). One log for
// every drill on greek.tools, kept apart from hebrew.tools' by its key.
// Concept ids are namespaced by drill; passage parsing uses `parse/passage/<id>`
// (see `parse-attempts.ts`).
//
// Unlike hebrew.tools' log this one does not sync yet: the account-side
// endpoint arrives with #200. Until then a device's log is its own, and the
// synced `parseHistory` totals remain the cross-device record.

import { createAttemptLog } from '@tools/shared/attempt-log';

export const ATTEMPT_LOG_KEY = 'greek-tools-attempts-v1';

export const { loadAttempts, logAttempts, saveAttempts } = createAttemptLog(ATTEMPT_LOG_KEY);
