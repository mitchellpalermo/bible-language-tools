// Whether the on-screen Hebrew keypad is open, for every page that has one.
//
// A touch screen starts with it open: that is the iPad, where the system
// keyboard hides the points a pointed form needs. It is read after mount,
// because every page is prerendered and the server has no pointer to ask about.
//
// Hold this where it outlives one item. A page that keeps it in a component
// remounted per item (one verb on /parse, one table in Today's Session) closes
// the keypad again on every item the student opened it for. Today's Session
// holds one for the whole run and hands it to each part through `session`.

import { useCallback, useEffect, useState } from 'react';

export interface KeypadState {
  open: boolean;
  toggle: () => void;
}

export function useKeypad(): KeypadState {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(window.matchMedia?.('(pointer: coarse)').matches ?? false);
  }, []);
  const toggle = useCallback(() => setOpen((o) => !o), []);
  return { open, toggle };
}
