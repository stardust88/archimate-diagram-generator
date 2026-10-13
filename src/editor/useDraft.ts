import { useState } from 'react';

/**
 * Local draft of a committed value: edits stay local until committed, and the draft resets when
 * the committed value changes (e.g. after undo). Uses the adjust-state-during-render pattern.
 */
export function useDraft(value: string): [string, (v: string) => void] {
  const [draft, setDraft] = useState(value);
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    setDraft(value);
  }
  return [draft, setDraft];
}
