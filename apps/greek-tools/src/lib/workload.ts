// The workload guard's binding for greek.tools (#203): today's review estimate
// and the pause on new cards, over `@tools/shared/workload`. Local to this
// browser and never synced; see the shared module for why.

import { createWorkloadStore } from '@tools/shared/workload';

export const WORKLOAD_KEY = 'greek-tools-workload-v1';
export const workloadStore = createWorkloadStore(WORKLOAD_KEY);
