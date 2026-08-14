import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TarefaDialog, type TarefaFormValues } from "@/components/lembretes/TarefaDialog";
import { ProjetoDialog } from "@/components/lembretes/ProjetoDialog";
import {
  PRIORIDADES,
  STATUSES,
  addDays,
  dataPorExtenso,
  estaAtrasada,
  formatarDataHora,
  horaLocal,
  startOfDay,
  toDateKey,
  weekDays,
  type LembreteProjeto,
  type LembreteTarefa,
} from "@/lib/lembretes";

export const Route = createFileRoute("/lembretes")({
  head: () => ({
    meta: [
      { title: "Lembretes — agenda pessoal | Luminart" },
      { name: "description", content: "Organize suas atividades pessoais com data, hora, projeto e lembrete." },
      { property: "og:title", content: "Lembretes — agenda pessoal | Luminart" },
      { property: "og:description", content: "Organize suas atividades pessoais com data, hora, projeto e lembrete." },
    ],
  }),
  component: LembretesPage,
});

const sb = supabase as any;
const TODOS = "__todos__";

function useProjetos(userId: string | undefined) {
  return useQuery({
    queryKey: ["lembretes", "projetos", userId],
    enabled: !!userId,
    queryFn: async (): Promise<LembreteProjeto[]> => {
      const { data, error } = await sb
        .from("lembretes_projetos")
        .select("*")
        .order("nome", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useTarefas(userId: string | undefined) {
  return useQuery({
    queryKey: ["lembretes", "tarefas", userId],
    enabled: !!userId,
    queryFn: async (): Promise<LembreteTarefa[]> => {
      const { data, error } = await sb
        .from("lembretes_tarefas")
        .select("*")
        .order("data_hora", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function LembretesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const projetosQ = useProjetos(user?.id);
  const tarefasQ = useTarefas(user?.id);

  const [tarefaDialog, setTarefaDialog] = useState<{ open: boolean; tarefa: LembreteTarefa | null; data?: Date }>({
    open: false,
    tarefa: null,
  });
  const [projetoDialog, setProjetoDialog] = useState<{ open: boolean; projeto: LembreteProjeto | null }>({
    open: false,
    projeto: null,
  });

  const projetos = projetosQ.data ?? [];
  const tarefas = tarefasQ.data ?? [];
  const projetoPorId = useMemo(
    () => Object.fromEntries(projetos.map((p) => [p.id, p])) as Record<string, LembreteProjeto>,
    [projetos],
  );

  const invalidarTarefas = () => qc.invalidateQueries({ queryKey: ["lembretes", "tarefas"] });
  const invalidarProjetos = () => qc.invalidateQueries({ queryKey: ["lembretes", "projetos"] });

  const salvarTarefa = useMutation({
    mutationFn: async (values: TarefaFormValues) => {
      if (tarefaDialog.tarefa) {
        const { error } = await sb.from("lembretes_tarefas").update(values).eq("id", tarefaDialog.tarefa.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("lembretes_tarefas").insert({ ...values, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setTarefaDialog({ open: false, tarefa: null });
      invalidarTarefas();
      toast.success("Tarefa salva.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível salvar a tarefa."),
  });

  const atualizarTarefa = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<LembreteTarefa> }) => {
      const { error } = await sb.from("lembretes_tarefas").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidarTarefas,
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível atualizar a tarefa."),
  });

  const excluirTarefa = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("lembretes_tarefas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidarTarefas();
      toast.success("Tarefa excluída.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível excluir a tarefa."),
  });

  const salvarProjeto = useMutation({
    mutationFn: async (values: { nome: string; cor: string; ativo: boolean }) => {
      if (projetoDialog.projeto) {
        const { error } = await sb.from("lembretes_projetos").update(values).eq("id", projetoDialog.projeto.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("lembretes_projetos").insert({ ...values, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setProjetoDialog({ open: false, projeto: null });
      invalidarProjetos();
      toast.success("Projeto salvo.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível salvar o projeto."),
  });

  const excluirProjeto = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("lembretes_projetos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidarProjetos();
      invalidarTarefas();
      toast.success("Projeto excluído.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível excluir o projeto."),
  });

  const toggleConcluida = (t: LembreteTarefa) =>
    atualizarTarefa.mutate({
      id: t.id,
      patch:
        t.status === "concluida"
          ? { status: "pendente", concluida_em: null }
          : { status: "concluida", concluida_em: new Date().toISOString() },
    });

  const carregando = projetosQ.isLoading || tarefasQ.isLoading;
  const erro = projetosQ.error || tarefasQ.error;

  return (
    <div>
      <PageHeader
        title="Lembretes"
        description={dataPorExtenso(new Date())}
        actions={
          <Button onClick={() => setTarefaDialog({ open: true, tarefa: null })}>
            <Plus className="h-4 w-4" />
            <span className="ml-1.5">Nova tarefa</span>
          </Button>
        }
      />

      {erro && (
        <Card className="p-4 mb-4 border-destructive/40">
          <p className="text-sm text-destructive">
            Não foi possível carregar seus lembretes. Recarregue a página e tente novamente.
          </p>
        </Card>
      )}

      <Tabs defaultValue="hoje">
        <TabsList>
          <TabsTrigger value="hoje">Hoje</TabsTrigger>
          <TabsTrigger value="semana">Semana</TabsTrigger>
          <TabsTrigger value="todas">Todas</TabsTrigger>
          <TabsTrigger value="projetos">Projetos</TabsTrigger>
        </TabsList>

        <TabsContent value="hoje" className="mt-4">
          <HojeView
            carregando={carregando}
            tarefas={tarefas}
            projetoPorId={projetoPorId}
            onToggle={toggleConcluida}
            onEditar={(t) => setTarefaDialog({ open: true, tarefa: t })}
          />
        </TabsContent>

        <TabsContent value="semana" className="mt-4">
          <SemanaView
            carregando={carregando}
            tarefas={tarefas}
            projetoPorId={projetoPorId}
            onToggle={toggleConcluida}
            onEditar={(t) => setTarefaDialog({ open: true, tarefa: t })}
            onNova={(d) => setTarefaDialog({ open: true, tarefa: null, data: d })}
          />
        </TabsContent>

        <TabsContent value="todas" className="mt-4">
          <TodasView
            carregando={carregando}
            tarefas={tarefas}
            projetos={projetos}
            projetoPorId={projetoPorId}
            onEditar={(t) => setTarefaDialog({ open: true, tarefa: t })}
            onExcluir={(id) => excluirTarefa.mutate(id)}
          />
        </TabsContent>

        <TabsContent value="projetos" className="mt-4">
          <ProjetosView
            carregando={carregando}
            projetos={projetos}
            onNovo={() => setProjetoDialog({ open: true, projeto: null })}
            onEditar={(p) => setProjetoDialog({ open: true, projeto: p })}
            onExcluir={(id) => excluirProjeto.mutate(id)}
          />
        </TabsContent>
      </Tabs>

      <TarefaDialog
        open={tarefaDialog.open}
        onOpenChange={(v) => setTarefaDialog((s) => ({ ...s, open: v }))}
        tarefa={tarefaDialog.tarefa}
        dataPadrao={tarefaDialog.data}
        projetos={projetos}
        saving={salvarTarefa.isPending}
        onSubmit={(v) => salvarTarefa.mutate(v)}
      />

      <ProjetoDialog
        open={projetoDialog.open}
        onOpenChange={(v) => setProjetoDialog((s) => ({ ...s, open: v }))}
        projeto={projetoDialog.projeto}
        saving={salvarProjeto.isPending}
        onSubmit={(v) => salvarProjeto.mutate(v)}
      />
    </div>
  );
}

function ProjetoTag({ projeto }: { projeto?: LembreteProjeto }) {
  if (!projeto) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: projeto.cor }} />
      {projeto.nome}
    </span>
  );
}

function Vazio({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>;
}

function LinhaTarefa({
  t,
  projeto,
  onToggle,
  onEditar,
}: {
  t: LembreteTarefa;
  projeto?: LembreteProjeto;
  onToggle: (t: LembreteTarefa) => void;
  onEditar: (t: LembreteTarefa) => void;
}) {
  const concluida = t.status === "concluida";
  const atrasada = estaAtrasada(t);
  return (
    <div className="flex items-start gap-3 border-b px-4 py-3 last:border-b-0">
      <Checkbox checked={concluida} onCheckedChange={() => onToggle(t)} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("text-xs tabular-nums", atrasada ? "text-destructive font-medium" : "text-muted-foreground")}>
            {t.dia_inteiro ? "Dia inteiro" : horaLocal(t.data_hora)}
          </span>
          <button
            type="button"
            onClick={() => onEditar(t)}
            className={cn(
              "text-sm font-medium text-left hover:underline",
              concluida && "line-through text-muted-foreground",
              !concluida && atrasada && "text-destructive",
            )}
          >
            {t.titulo}
          </button>
          {t.prioridade === "alta" && !concluida && (
            <Badge variant="outline" className="text-[10px]">
              Alta
            </Badge>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-3">
          <ProjetoTag projeto={projeto} />
          {t.descricao && <span className="truncate text-xs text-muted-foreground">{t.descricao}</span>}
        </div>
      </div>
    </div>
  );
}

function HojeView({
  carregando,
  tarefas,
  projetoPorId,
  onToggle,
  onEditar,
}: {
  carregando: boolean;
  tarefas: LembreteTarefa[];
  projetoPorId: Record<string, LembreteProjeto>;
  onToggle: (t: LembreteTarefa) => void;
  onEditar: (t: LembreteTarefa) => void;
}) {
  const hoje = toDateKey(new Date());
  const doDia = tarefas.filter((t) => toDateKey(new Date(t.data_hora)) === hoje);
  const pendentes = doDia.filter((t) => t.status === "pendente");
  const concluidas = doDia.filter((t) => t.status === "concluida");

  if (carregando) return <Card className="p-6 text-sm text-muted-foreground">Carregando tarefas…</Card>;

  return (
    <div className="space-y-4">
      <Card>
        {pendentes.length === 0 ? (
          <Vazio>Nenhuma tarefa pendente para hoje.</Vazio>
        ) : (
          pendentes.map((t) => (
            <LinhaTarefa
              key={t.id}
              t={t}
              projeto={t.projeto_id ? projetoPorId[t.projeto_id] : undefined}
              onToggle={onToggle}
              onEditar={onEditar}
            />
          ))
        )}
      </Card>

      {concluidas.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">Concluídas hoje</h2>
          <Card>
            {concluidas.map((t) => (
              <LinhaTarefa
                key={t.id}
                t={t}
                projeto={t.projeto_id ? projetoPorId[t.projeto_id] : undefined}
                onToggle={onToggle}
                onEditar={onEditar}
              />
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}

function SemanaView({
  carregando,
  tarefas,
  projetoPorId,
  onToggle,
  onEditar,
  onNova,
}: {
  carregando: boolean;
  tarefas: LembreteTarefa[];
  projetoPorId: Record<string, LembreteProjeto>;
  onToggle: (t: LembreteTarefa) => void;
  onEditar: (t: LembreteTarefa) => void;
  onNova: (d: Date) => void;
}) {
  const [base, setBase] = useState(() => startOfDay(new Date()));
  const dias = weekDays(base);
  const hoje = toDateKey(new Date());

  if (carregando) return <Card className="p-6 text-sm text-muted-foreground">Carregando tarefas…</Card>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setBase(addDays(base, -7))}>
          <ChevronLeft className="h-4 w-4" />
          <span className="ml-1">Semana anterior</span>
        </Button>
        <Button variant="outline" size="sm" onClick={() => setBase(startOfDay(new Date()))}>
          Esta semana
        </Button>
        <Button variant="outline" size="sm" onClick={() => setBase(addDays(base, 7))}>
          <span className="mr-1">Próxima semana</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {dias.map((d) => {
          const key = toDateKey(d);
          const doDia = tarefas
            .filter((t) => toDateKey(new Date(t.data_hora)) === key)
            .sort((a, b) => a.data_hora.localeCompare(b.data_hora));
          return (
            <Card key={key} className={cn("flex flex-col", key === hoje && "border-primary")}>
              <div className="flex items-center justify-between border-b px-3 py-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}
                  </p>
                  <p className="text-sm font-medium">{d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onNova(d)} aria-label="Nova tarefa">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 p-2">
                {doDia.length === 0 ? (
                  <p className="px-1 py-3 text-xs text-muted-foreground">Sem tarefas</p>
                ) : (
                  <div className="space-y-1.5">
                    {doDia.map((t) => {
                      const projeto = t.projeto_id ? projetoPorId[t.projeto_id] : undefined;
                      const concluida = t.status === "concluida";
                      return (
                        <div key={t.id} className="flex items-start gap-2 rounded-md border px-2 py-1.5">
                          <Checkbox
                            checked={concluida}
                            onCheckedChange={() => onToggle(t)}
                            className="mt-0.5"
                          />
                          <button type="button" onClick={() => onEditar(t)} className="min-w-0 flex-1 text-left">
                            <span
                              className={cn(
                                "block truncate text-xs font-medium",
                                concluida && "line-through text-muted-foreground",
                                !concluida && estaAtrasada(t) && "text-destructive",
                              )}
                            >
                              {t.dia_inteiro ? "" : `${horaLocal(t.data_hora)} `}
                              {t.titulo}
                            </span>
                            <ProjetoTag projeto={projeto} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function TodasView({
  carregando,
  tarefas,
  projetos,
  projetoPorId,
  onEditar,
  onExcluir,
}: {
  carregando: boolean;
  tarefas: LembreteTarefa[];
  projetos: LembreteProjeto[];
  projetoPorId: Record<string, LembreteProjeto>;
  onEditar: (t: LembreteTarefa) => void;
  onExcluir: (id: string) => void;
}) {
  const [busca, setBusca] = useState("");
  const [projeto, setProjeto] = useState(TODOS);
  const [status, setStatus] = useState(TODOS);
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return tarefas.filter((t) => {
      if (termo && !t.titulo.toLowerCase().includes(termo)) return false;
      if (projeto !== TODOS && (t.projeto_id ?? "") !== projeto) return false;
      if (status !== TODOS && t.status !== status) return false;
      const key = toDateKey(new Date(t.data_hora));
      if (de && key < de) return false;
      if (ate && key > ate) return false;
      return true;
    });
  }, [tarefas, busca, projeto, status, de, ate]);

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label className="text-xs">Buscar no título</Label>
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Projeto</Label>
            <Select value={projeto} onValueChange={setProjeto}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos</SelectItem>
                <SelectItem value="">Sem projeto</SelectItem>
                {projetos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">De</Label>
            <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Até</Label>
            <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </div>
        </div>
      </Card>

      <div className="overflow-auto rounded-lg border max-h-[calc(100vh-320px)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data e hora</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Projeto</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {carregando ? (
              <TableRow>
                <TableCell colSpan={6} className="text-sm text-muted-foreground">
                  Carregando tarefas…
                </TableCell>
              </TableRow>
            ) : filtradas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-sm text-muted-foreground">
                  Nenhuma tarefa encontrada com esses filtros.
                </TableCell>
              </TableRow>
            ) : (
              filtradas.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatarDataHora(t.data_hora, t.dia_inteiro)}
                  </TableCell>
                  <TableCell className="text-sm font-medium">{t.titulo}</TableCell>
                  <TableCell>
                    <ProjetoTag projeto={t.projeto_id ? projetoPorId[t.projeto_id] : undefined} />
                  </TableCell>
                  <TableCell className="text-sm">
                    {PRIORIDADES.find((p) => p.value === t.prioridade)?.label}
                  </TableCell>
                  <TableCell className="text-sm">{STATUSES.find((s) => s.value === t.status)?.label}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEditar(t)} aria-label="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onExcluir(t.id)}
                        aria-label="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ProjetosView({
  carregando,
  projetos,
  onNovo,
  onEditar,
  onExcluir,
}: {
  carregando: boolean;
  projetos: LembreteProjeto[];
  onNovo: () => void;
  onEditar: (p: LembreteProjeto) => void;
  onExcluir: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={onNovo}>
          <Plus className="h-4 w-4" />
          <span className="ml-1.5">Novo projeto</span>
        </Button>
      </div>
      <Card>
        {carregando ? (
          <p className="p-6 text-sm text-muted-foreground">Carregando projetos…</p>
        ) : projetos.length === 0 ? (
          <Vazio>Você ainda não criou projetos pessoais.</Vazio>
        ) : (
          projetos.map((p) => (
            <div key={p.id} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: p.cor }} />
              <span className="flex-1 text-sm font-medium">{p.nome}</span>
              {!p.ativo && (
                <Badge variant="outline" className="text-[10px]">
                  Inativo
                </Badge>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEditar(p)} aria-label="Editar">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onExcluir(p.id)} aria-label="Excluir">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
