import { useEffect, useRef, useState } from "react";

/**
 * useState que persiste o valor em localStorage por chave.
 * Sobrevive a F5 / reabertura de aba.
 *
 * IMPORTANTE: para evitar mismatch de hidratação no SSR, o estado inicial
 * é sempre `initial`. O valor salvo é carregado no client em useEffect,
 * após a montagem.
 */
export function usePersistedState<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const storageKey = `lov:filter:${key}`;
  const [state, setState] = useState<T>(initial);
  const hydrated = useRef(false);

  // Carrega valor salvo apenas no client, após mount (evita SSR hydration mismatch).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw != null) {
        setState(JSON.parse(raw) as T);
      }
    } catch {
      // ignore
    } finally {
      hydrated.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Persiste apenas após hidratação inicial, para não sobrescrever com `initial`.
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // quota / disabled storage — ignore
    }
  }, [storageKey, state]);

  return [state, setState];
}
