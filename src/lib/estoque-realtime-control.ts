/**
 * Controle local para suprimir a invalidação automática da query ["itens"]
 * pelo hook global useEstoqueRealtimeSync enquanto o usuário está conferindo
 * estoque (filtrando/digitando). Quando suprimido, o hook global avisa via
 * `notifyEstoquePending` para que a tela mostre um banner não-intrusivo.
 *
 * Não afeta a sincronia das outras telas (Entradas/Saídas/Devoluções etc.).
 */

let suppressed = false;
const pendingListeners = new Set<() => void>();

export function setEstoqueItensSuppressed(v: boolean) {
  suppressed = v;
}

export function isEstoqueItensSuppressed() {
  return suppressed;
}

export function onEstoqueItensPending(cb: () => void): () => void {
  pendingListeners.add(cb);
  return () => {
    pendingListeners.delete(cb);
  };
}

export function notifyEstoqueItensPending() {
  pendingListeners.forEach((l) => {
    try {
      l();
    } catch {
      /* noop */
    }
  });
}
