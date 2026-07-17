export type UF = { sigla: string; nome: string };
export type Municipio = { nome: string; uf: string };

export async function fetchEstados(): Promise<UF[]> {
  const res = await fetch("https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome");
  if (!res.ok) throw new Error("Falha ao carregar estados");
  const data: Array<{ sigla: string; nome: string }> = await res.json();
  return data.map((e) => ({ sigla: e.sigla, nome: e.nome }));
}

export async function fetchMunicipios(): Promise<Municipio[]> {
  const res = await fetch("https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome");
  if (!res.ok) throw new Error("Falha ao carregar municípios");
  const data: Array<{ nome: string; microrregiao?: { mesorregiao?: { UF?: { sigla?: string } } } }> = await res.json();
  return data
    .map((m) => ({ nome: m.nome, uf: m.microrregiao?.mesorregiao?.UF?.sigla ?? "" }))
    .filter((m) => m.uf);
}
