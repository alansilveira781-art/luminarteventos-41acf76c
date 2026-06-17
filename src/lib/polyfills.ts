// Polyfill para URL.parse (Safari < 18, navegadores mais antigos)
if (typeof URL !== "undefined" && typeof (URL as any).parse !== "function") {
  (URL as any).parse = function (input: string | URL, base?: string | URL): URL | null {
    try {
      return base !== undefined ? new URL(input as any, base as any) : new URL(input as any);
    } catch {
      return null;
    }
  };
}

// Polyfill para URL.canParse, também recente
if (typeof URL !== "undefined" && typeof (URL as any).canParse !== "function") {
  (URL as any).canParse = function (input: string | URL, base?: string | URL): boolean {
    try {
      base !== undefined ? new URL(input as any, base as any) : new URL(input as any);
      return true;
    } catch {
      return false;
    }
  };
}

export {};
