// The workload guard's state for a page: the stored pause and limit, and the
// student's pace. Both apps' /flashcards and Today's Session hold one, each
// over its own store (`createWorkloadStore`), and hand it to `WorkloadGuard`
// with the SRS store, which turns it into today's estimate.
//
// It takes no SRS store itself because /flashcards needs `pauseNew` before
// its session hook runs, and that hook is what holds the store.

import { useCallback } from 'react';
import { useStoredState } from './use-stored-state';
import {
  type createWorkloadStore,
  defaultWorkloadState,
  recordPace,
  secondsPerReview,
  type WorkloadState,
} from './workload';

export type WorkloadStore = ReturnType<typeof createWorkloadStore>;
export type Workload = ReturnType<typeof useWorkload>;

const FALLBACK = defaultWorkloadState();

export function useWorkload(store: WorkloadStore) {
  const [state, setState, loaded] = useStoredState<WorkloadState>(store.load, FALLBACK, store.save);

  const setPauseNew = useCallback(
    (pauseNew: boolean) => setState((s) => ({ ...s, pauseNew })),
    [setState],
  );
  const setLimitMinutes = useCallback(
    (limitMinutes: number) => setState((s) => ({ ...s, limitMinutes })),
    [setState],
  );
  /** One more answer's time, in seconds, toward the pace. */
  const recordAnswer = useCallback(
    (seconds: number) =>
      setState((s) => ({ ...s, paceSeconds: recordPace(s.paceSeconds, seconds) })),
    [setState],
  );

  return {
    /** False only while hydrating, when the stored pause is not known yet. */
    loaded,
    pauseNew: state.pauseNew,
    limitMinutes: state.limitMinutes,
    /** Seconds per review: the student's median, or the default. */
    pace: secondsPerReview(state.paceSeconds),
    setPauseNew,
    setLimitMinutes,
    recordAnswer,
  };
}
