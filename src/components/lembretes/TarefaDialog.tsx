import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  PRIORIDADES,
  RECORRENCIAS,
  combinarDataHora,
  dataLocal,
  horaLocal,
  toDateKey,
  type LembreteProjeto,
  type LembretePrioridade,
  type LembreteRecorrencia,
  type LembreteTarefa,
} from "@/lib/lembretes";

export type TarefaFormValues = {
  titulo: string;
  descricao: string | null;
  projeto_id: string | null;
  data_hora: string;
  dia_inteiro: boolean;
  duracao_min: number;
  lembrete_min: number;
  recorrencia: LembreteRecorrencia;
  prioridade: LembretePrioridade;
};

const SEM_PROJETO = "__sem__";

export function TarefaDialog({
  open,
  onOpenChange,
  tarefa,
  projetos,
  dataPadrao,
  onSubmit,
  saving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tarefa: LembreteTarefa | null;
  projetos: LembreteProjeto[];
  dataPadrao?: Date;
  onSubmit: (values: TarefaFormValues) => void;
  saving: boolean;
}) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [projetoId, setProjetoId] = useState<string>(SEM_PROJETO);
  const [data, setData] = useState("");
  const [hora, setHora] = useState("09:00");
  const [diaInteiro, setDiaInteiro] = useState(false);
  const [duracao, setDuracao] = useState(30);
  const [lembrete, setLembrete] = useState(15);
  const [recorrencia, setRecorrencia] = useState<LembreteRecorrencia>("nenhuma");
  const [prioridade, setPrioridade] = useState<LembretePrioridade>("normal");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErro(null);
    if (tarefa) {
      setTitulo(tarefa.titulo);
      setDescricao(tarefa.descricao ?? "");
      setProjetoId(tarefa.projeto_id ?? SEM_PROJETO);
      setData(dataLocal(tarefa.data_hora));
      setHora(horaLocal(tarefa.data_hora));
      setDiaInteiro(tarefa.dia_inteiro);
      setDuracao(tarefa.duracao_min);
      setLembrete(tarefa.lembrete_min);
      setRecorrencia(tarefa.recorrencia);
      setPrioridade(tarefa.prioridade);
    } else {
      setTitulo("");
      setDescricao("");
      setProjetoId(SEM_PROJETO);
      setData(toDateKey(dataPadrao ?? new Date()));
      setHora("09:00");
      setDiaInteiro(false);
      setDuracao(30);
      setLembrete(15);
      setRecorrencia("nenhuma");
      setPrioridade("normal");
    }
  }, [open, tarefa, dataPadrao]);

  const ativos = projetos.filter((p) => p.ativo || p.id === tarefa?.projeto_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tarefa ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!titulo.trim()) return setErro("Informe o título da tarefa.");
            if (!data) return setErro("Informe a data da tarefa.");
            setErro(null);
            onSubmit({
              titulo: titulo.trim(),
              descricao: descricao.trim() || null,
              projeto_id: projetoId === SEM_PROJETO ? null : projetoId,
              data_hora: combinarDataHora(data, hora, diaInteiro).toISOString(),
              dia_inteiro: diaInteiro,
              duracao_min: diaInteiro ? 0 : Number(duracao) || 0,
              lembrete_min: Number(lembrete) || 0,
              recorrencia,
              prioridade,
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="t-titulo">Título</Label>
            <Input id="t-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="t-desc">Descrição</Label>
            <Textarea id="t-desc" rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Projeto</Label>
            <Select value={projetoId} onValueChange={setProjetoId}>
              <SelectTrigger>
                <SelectValue placeholder="Sem projeto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_PROJETO}>Sem projeto</SelectItem>
                {ativos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="t-data">Data</Label>
              <Input id="t-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            {!diaInteiro && (
              <div className="space-y-2">
                <Label htmlFor="t-hora">Hora</Label>
                <Input id="t-hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <Label htmlFor="t-dia" className="cursor-pointer">
              Dia inteiro
            </Label>
            <Switch id="t-dia" checked={diaInteiro} onCheckedChange={setDiaInteiro} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {!diaInteiro && (
              <div className="space-y-2">
                <Label htmlFor="t-dur">Duração (min)</Label>
                <Input
                  id="t-dur"
                  type="number"
                  min={0}
                  value={duracao}
                  onChange={(e) => setDuracao(Number(e.target.value))}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="t-lem">Lembrete (min antes)</Label>
              <Input
                id="t-lem"
                type="number"
                min={0}
                value={lembrete}
                onChange={(e) => setLembrete(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Recorrência</Label>
              <Select value={recorrencia} onValueChange={(v) => setRecorrencia(v as LembreteRecorrencia)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECORRENCIAS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={(v) => setPrioridade(v as LembretePrioridade)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORIDADES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
