import { useEffect, useRef, useState } from "react";

/**
 * useState que persiste o valor em localStorage por chave.
 * Sobrevive a F5 / reabertura de aba.
 */
export function usePersistedState<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const storageKey = `lov:filter:${key}`;
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw == null) return initial;
      return JSON.parse(raw) as T;
    } catch {
      return initial;
    }
  });

  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // quota / disabled storage — ignore
    }
  }, [storageKey, state]);

  return [state, setState];
}
