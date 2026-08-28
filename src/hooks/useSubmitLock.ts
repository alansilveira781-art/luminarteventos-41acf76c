import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Trava síncrona de envio de formulário: impede que um segundo clique (ou toque
 * duplo) dispare o mesmo lançamento antes do React re-renderizar com o estado
 * "salvando". A trava é liberada quando a operação termina (sucesso ou erro).
 *
 * Uso:
 *   const { locked, tryLock } = useSubmitLock(submitting);
 *   ... validações ...
 *   if (!tryLock()) return;
 *   onSubmit(...)
 *   <Button disabled={submitting || locked}>
 */
export function useSubmitLock(submitting?: boolean) {
  const lockedRef = useRef(false);
  const startedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [locked, setLocked] = useState(false);

  const unlock = useCallback(() => {
    lockedRef.current = false;
    startedRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setLocked(false);
  }, []);

  useEffect(() => {
    if (submitting) startedRef.current = true;
    else if (startedRef.current) unlock();
  }, [submitting, unlock]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const tryLock = useCallback(() => {
    if (lockedRef.current) return false;
    lockedRef.current = true;
    setLocked(true);
    // Failsafe: nunca deixar o botão travado para sempre.
    timerRef.current = setTimeout(() => {
      if (!startedRef.current) unlock();
    }, 20_000);
    return true;
  }, [unlock]);

  return { locked, tryLock, unlock };
}
