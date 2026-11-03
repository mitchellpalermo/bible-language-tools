// This app's binding of `@tools/shared/attempt-log` (#196). One log for every
// drill on hebrew.tools, kept apart from greek.tools' by its key. Concept ids
// are namespaced by drill, e.g. `accent-shift/open-pretonic-long`. Synced when
// signed in, through `sync-manager.ts`.

import { createAttemptLog } from '@tools/shared/attempt-log';

export const ATTEMPT_LOG_KEY = 'hebrew-tools-attempts-v1';

export const { loadAttempts, logAttempts, saveAttempts } = createAttemptLog(ATTEMPT_LOG_KEY);
