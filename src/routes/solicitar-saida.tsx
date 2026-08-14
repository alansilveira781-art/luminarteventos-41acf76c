import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EventoPublicCombobox } from "@/components/EventoPublicCombobox";
import { Plus, Trash2, Check, Loader2, PackageMinus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/solicitar-saida")({
  head: () => ({
    meta: [
      { title: "Retirada de material — Grupo Luminart" },
      {
        name: "description",
        content: "Registre a retirada de compensado, MDF e outros materiais do estoque do Grupo Luminart.",
      },
      { property: "og:title", content: "Retirada de material — Grupo Luminart" },
      {
        property: "og:description",
        content: "Formulário de solicitação de saída de material do estoque.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
    ],
  }),
  component: SolicitarSaidaPage,
});

type MaterialRow = { descricao: string; quantidade: string };
type Solicitante = { id: string; nome: string; apelido?: string | null };

const emptyRow = (): MaterialRow => ({ descricao: "", quantidade: "1" });
const hojeISO = () => new Date().toISOString().slice(0, 10);

function SolicitarSaidaPage() {
  const [solicitantes, setSolicitantes] = useState<Solicitante[]>([]);
  const [dataRetirada, setDataRetirada] = useState(hojeISO());
  const [solicitanteId, setSolicitanteId] = useState("");
  const [isEvento, setIsEvento] = useState<"sim" | "nao">("sim");
  const [eventoProjeto, setEventoProjeto] = useState<string>("");
  const [finalidade, setFinalidade] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [materiais, setMateriais] = useState<MaterialRow[]>([emptyRow()]);
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/public/solicitar-saida")
      .then((r) => r.json())
      .then((d) => setSolicitantes((d?.solicitantes ?? []) as Solicitante[]))
      .catch(() => {});
  }, []);

  const setRow = (i: number, patch: Partial<MaterialRow>) =>
    setMateriais((arr) => arr.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => setMateriais((a) => [...a, emptyRow()]);
  const remRow = (i: number) => setMateriais((a) => (a.length === 1 ? a : a.filter((_, idx) => idx !== i)));

  function resetForm() {
    setDataRetirada(hojeISO());
    setSolicitanteId("");
    setIsEvento("sim");
    setEventoProjeto("");
    setFinalidade("");
    setObservacoes("");
    setMateriais([emptyRow()]);
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const solicitante = solicitantes.find((s) => s.id === solicitanteId);
    if (!solicitante) return toast.error("Selecione o solicitante");
    if (isEvento === "sim" && !eventoProjeto) return toast.error("Selecione o evento/projeto");
    if (isEvento === "nao" && !finalidade.trim()) return toast.error("Informe para onde vai o material");
    const validos = materiais
      .map((m) => ({ descricao: m.descricao.trim(), quantidade: Number(String(m.quantidade).replace(",", ".")) }))
      .filter((m) => m.descricao && m.quantidade > 0);
    if (!validos.length) return toast.error("Informe ao menos um material com quantidade");

    setEnviando(true);
    try {
      const res = await fetch("/api/public/solicitar-saida", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data_retirada: dataRetirada,
          solicitante_id: solicitante.id,
          solicitante_nome: solicitante.nome,
          is_evento: isEvento === "sim",
          evento_projeto: isEvento === "sim" ? eventoProjeto : "",
          finalidade_livre: isEvento === "nao" ? finalidade.trim() : "",
          observacoes: observacoes.trim(),
          materiais: validos,
        }),
      });
      const d = await res.json();
      if (!res.ok || !d?.ok) throw new Error(d?.error ?? "Falha ao enviar");
      setSucesso(d.numero ?? 0);
      resetForm();
    } catch (err: any) {
      toast.error(err?.message ?? "Não foi possível enviar");
    } finally {
      setEnviando(false);
    }
  }

  if (sucesso !== null) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Check className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold">Retirada registrada</h1>
          <p className="text-sm text-muted-foreground">
            Solicitação nº {String(sucesso).padStart(4, "0")} enviada. O estoque vai conferir e validar a saída.
          </p>
          <Button onClick={() => setSucesso(null)}>Registrar outra retirada</Button>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-1">
          <div className="flex items-center gap-2 text-primary">
            <PackageMinus className="h-5 w-5" />
            <span className="text-xs font-medium uppercase tracking-wider">Grupo Luminart · Estoque</span>
          </div>
          <h1 className="text-2xl font-semibold">Retirada de material</h1>
          <p className="text-sm text-muted-foreground">
            Registre aqui a retirada de compensado, MDF e outros materiais. A saída será validada pelo estoque.
          </p>
        </header>

        <form onSubmit={enviar} className="space-y-6">
          <Card className="p-5 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Data de retirada*</Label>
                <Input
                  type="date"
                  required
                  value={dataRetirada}
                  onChange={(e) => setDataRetirada(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Solicitante*</Label>
                <Select value={solicitanteId} onValueChange={setSolicitanteId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione…" />
                  </SelectTrigger>
                  <SelectContent>
                    {solicitantes.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.apelido ? `${s.nome} (${s.apelido})` : s.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>É para um evento?*</Label>
                <Select value={isEvento} onValueChange={(v) => setIsEvento(v as "sim" | "nao")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sim">Sim</SelectItem>
                    <SelectItem value="nao">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                {isEvento === "sim" ? (
                  <>
                    <Label>Evento / Projeto*</Label>
                    <EventoPublicCombobox value={eventoProjeto} onChange={(v) => setEventoProjeto(v ?? "")} />
                  </>
                ) : (
                  <>
                    <Label>Para onde vai o material?*</Label>
                    <Input
                      value={finalidade}
                      onChange={(e) => setFinalidade(e.target.value)}
                      placeholder="Ex.: manutenção da sede, marcenaria…"
                    />
                  </>
                )}
              </div>
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Materiais retirados</h2>
              <Button type="button" size="sm" variant="outline" onClick={addRow}>
                <Plus className="h-3 w-3 mr-1" /> Adicionar
              </Button>
            </div>
            {materiais.map((m, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-8 space-y-1.5">
                  {i === 0 && <Label className="text-xs">Descrição do material*</Label>}
                  <Input
                    value={m.descricao}
                    onChange={(e) => setRow(i, { descricao: e.target.value })}
                    placeholder="Ex.: Compensado 15mm 2,20 x 1,60"
                  />
                </div>
                <div className="col-span-3 space-y-1.5">
                  {i === 0 && <Label className="text-xs">Qtde*</Label>}
                  <Input
                    inputMode="decimal"
                    value={m.quantidade}
                    onChange={(e) => setRow(i, { quantidade: e.target.value })}
                    className="text-right"
                  />
                </div>
                <div className="col-span-1 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remRow(i)}
                    disabled={materiais.length === 1}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            ))}
          </Card>

          <Card className="p-5 space-y-1.5">
            <Label>Observações</Label>
            <Textarea rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </Card>

          <div className="flex justify-end">
            <Button type="submit" size="lg" disabled={enviando}>
              {enviando ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando…
                </>
              ) : (
                "Enviar retirada"
              )}
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
