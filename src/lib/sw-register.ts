/** Registra o service worker de push apenas em ambientes publicados/instalados.
 *  Nunca registra no preview do Lovable, iframe ou dev. */
export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const hostname = window.location.hostname;
  const search = window.location.search;

  const isPreview =
    hostname.startsWith("id-preview--") ||
    hostname.includes("preview--") ||
    hostname === "lovableproject.com" ||
    hostname.endsWith(".lovableproject.com") ||
    hostname === "lovableproject-dev.com" ||
    hostname.endsWith(".lovableproject-dev.com") ||
    hostname === "beta.lovable.dev" ||
    hostname.endsWith(".beta.lovable.dev");

  const isIframe = window.self !== window.top;
  const isDev = !import.meta.env.PROD;
  const isOff = search.includes("sw=off");

  if (isDev || isIframe || isPreview || isOff) {
    // Em preview/iframe/dev, remove qualquer registro ativo do /sw.js para evitar cache stale.
    navigator.serviceWorker.getRegistration("/sw.js").then((reg) => {
      if (reg) void reg.unregister();
    });
    return;
  }

  navigator.serviceWorker
    .register("/sw.js")
    .catch((err) => {
      console.warn("Falha ao registrar service worker:", err);
    });
}
