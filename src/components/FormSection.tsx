import { ReactNode } from "react";

export function FormSection({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>;
}

export function FormActions({ children }: { children: ReactNode }) {
  return (
    <div className="md:col-span-2 flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
      {children}
    </div>
  );
}

export function FormField({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`space-y-1.5 ${wide ? "md:col-span-2" : ""}`}>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}