// The workload guard's binding for hebrew.tools (#190): today's review estimate
// and the pause on new cards, over `@tools/shared/workload`. Local to this
// browser and never synced; see the shared module for why.

import { createWorkloadStore } from '@tools/shared/workload';
import { PARADIGM_KEY_PREFIX } from './paradigm-srs';

export const WORKLOAD_KEY = 'hebrew-tools-workload-v1';
export const workloadStore = createWorkloadStore(WORKLOAD_KEY);

/**
 * The estimate counts vocabulary only. Paradigm forms share the SRS store but
 * are reviewed in the paradigm quiz, at their own pace, and the pause does not
 * touch them.
 */
export const isVocabularyCard = (key: string) => !key.startsWith(PARADIGM_KEY_PREFIX);
