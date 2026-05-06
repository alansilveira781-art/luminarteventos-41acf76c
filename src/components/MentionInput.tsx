import { useEffect, useMemo, useRef, useState } from "react";

export type MentionUser = { id: string; nome: string };

export function MentionInput({
  value,
  onChange,
  users,
  onSubmit,
  placeholder,
}: {
  value: string;
  onChange: (v: string, mentions: string[]) => void;
  users: MentionUser[];
  onSubmit?: () => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [showList, setShowList] = useState(false);
  const [query, setQuery] = useState("");
  const [hl, setHl] = useState(0);

  const mentioned = useMemo(() => {
    const ids: string[] = [];
    const re = /@\[([^\]]+)\]\(([0-9a-f-]+)\)/g;
    let m;
    while ((m = re.exec(value))) ids.push(m[2]);
    return ids;
  }, [value]);

  useEffect(() => {
    onChange(value, mentioned);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    const pos = e.target.selectionStart ?? v.length;
    const before = v.slice(0, pos);
    const at = before.lastIndexOf("@");
    if (at >= 0 && !/\s/.test(before.slice(at + 1))) {
      setQuery(before.slice(at + 1).toLowerCase());
      setShowList(true);
      setHl(0);
    } else {
      setShowList(false);
    }
    const re = /@\[([^\]]+)\]\(([0-9a-f-]+)\)/g;
    const ids: string[] = [];
    let mm;
    while ((mm = re.exec(v))) ids.push(mm[2]);
    onChange(v, ids);
  }

  function pick(u: MentionUser) {
    const el = ref.current;
    if (!el) return;
    const pos = el.selectionStart ?? value.length;
    const before = value.slice(0, pos);
    const at = before.lastIndexOf("@");
    const newBefore = value.slice(0, at) + `@[${u.nome}](${u.id}) `;
    const newVal = newBefore + value.slice(pos);
    const re = /@\[([^\]]+)\]\(([0-9a-f-]+)\)/g;
    const ids: string[] = [];
    let mm;
    while ((mm = re.exec(newVal))) ids.push(mm[2]);
    onChange(newVal, ids);
    setShowList(false);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(newBefore.length, newBefore.length);
    }, 0);
  }

  const filtered = users.filter((u) => u.nome.toLowerCase().includes(query)).slice(0, 6);

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        rows={2}
        placeholder={placeholder ?? "Escreva um comentário… use @ para mencionar"}
        className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        onChange={handleChange}
        onKeyDown={(e) => {
          if (showList && filtered.length > 0) {
            if (e.key === "ArrowDown") { e.preventDefault(); setHl((h) => (h + 1) % filtered.length); return; }
            if (e.key === "ArrowUp") { e.preventDefault(); setHl((h) => (h - 1 + filtered.length) % filtered.length); return; }
            if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(filtered[hl]); return; }
            if (e.key === "Escape") { setShowList(false); return; }
          } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            onSubmit?.();
          }
        }}
      />
      {showList && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-56 max-h-56 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
          {filtered.map((u, i) => (
            <button
              key={u.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); pick(u); }}
              className={`w-full text-left px-3 py-1.5 text-sm ${i === hl ? "bg-accent" : "hover:bg-accent"}`}
            >
              @{u.nome}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function renderCommentText(text: string) {
  const parts: React.ReactNode[] = [];
  const re = /@\[([^\]]+)\]\(([0-9a-f-]+)\)/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <span key={i++} className="rounded bg-primary/15 text-primary px-1 py-0.5 text-xs font-medium">
        @{m[1]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
