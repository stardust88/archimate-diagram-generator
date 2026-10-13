// Promise-based dialogs (confirm / prompt / choice menu), rendered by <Dialogs />. Keeps editor
// actions linear: `if (await confirm(...)) dispatch(...)`.
import { create } from 'zustand';

export interface ChoiceOption {
  value: string;
  label: string;
  hint?: string;
}

export type Dialog =
  | {
      kind: 'confirm';
      title: string;
      message: string;
      details?: string[];
      confirmLabel: string;
      danger?: boolean;
      resolve: (ok: boolean) => void;
    }
  | {
      kind: 'prompt';
      title: string;
      label: string;
      initial: string;
      confirmLabel: string;
      resolve: (v: string | null) => void;
    }
  | {
      kind: 'choice';
      title: string;
      options: ChoiceOption[];
      at: { x: number; y: number };
      resolve: (v: string | null) => void;
    };

interface DialogState {
  current: Dialog | null;
}

export const useDialogs = create<DialogState>(() => ({ current: null }));

function open<T>(make: (resolve: (v: T) => void) => Dialog): Promise<T> {
  return new Promise<T>((resolve) => {
    const prev = useDialogs.getState().current;
    // A new dialog cancels an open one.
    if (prev) prev.resolve(prev.kind === 'confirm' ? (false as never) : (null as never));
    useDialogs.setState({
      current: make((v) => {
        useDialogs.setState({ current: null });
        resolve(v);
      }),
    });
  });
}

export function confirmDialog(opts: {
  title: string;
  message: string;
  details?: string[];
  confirmLabel?: string;
  danger?: boolean;
}): Promise<boolean> {
  return open((resolve) => ({ kind: 'confirm', confirmLabel: 'OK', ...opts, resolve }));
}

export function promptDialog(opts: {
  title: string;
  label: string;
  initial?: string;
  confirmLabel?: string;
}): Promise<string | null> {
  return open((resolve) => ({ kind: 'prompt', initial: '', confirmLabel: 'OK', ...opts, resolve }));
}

export function choiceMenu(opts: {
  title: string;
  options: ChoiceOption[];
  at: { x: number; y: number };
}): Promise<string | null> {
  return open((resolve) => ({ kind: 'choice', ...opts, resolve }));
}
