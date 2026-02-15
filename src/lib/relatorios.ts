import ExcelJS from 'exceljs'
import { createClient } from '@/lib/supabase/client'
import {
  contarPaletes,
  intervalToHours,
  calcularValorAcuracidade,
  calcularValorChecklist,
  calcularValorPltHsPorFilial,
  calcularValorPerda,
} from '@/lib/calculos'
import { getMesNome } from '@/lib/dashboard-filters'
import { formatDateBR } from '@/lib/date-utils'
import { fetchAllRows } from '@/lib/supabase/fetch-all'

const MES_NOME_TO_NUM: Record<string, string> = {
  janeiro: '01',
  fevereiro: '02',
  março: '03',
  abril: '04',
  maio: '05',
  junho: '06',
  julho: '07',
  agosto: '08',
  setembro: '09',
  outubro: '10',
  novembro: '11',
  dezembro: '12',
}

export function mesNomeParaNum(mesNome: string): string {
  return MES_NOME_TO_NUM[mesNome] ?? '01'
}

export interface FechamentoLinha {
  id: string
  id_colaborador: string
  id_filial: string
  mes: string
  ano: number
  colaborador_nome: string
  filial_nome: string
  peso_liquido_total: number
  volume_total: number
  paletes_total: number
  tempo_total: number
  kg_hs: number
  vol_hs: number
  plt_hs: number
  erro_separacao_total: number
  erro_entregas_total: number
  percentual_erros: number
  valor_kg_hs: number
  valor_vol_hs: number
  valor_plt_hs: number
  produtividade_bruta: number
  percentual_descontos: number
  valor_descontos: number
  produtividade_final: number
  meta: number
  percentual_atingimento: number
}

export interface EvolucaoTemporalRow {
  data_carga: string
  total_kg: number
  total_volume: number
  total_paletes: number
}

/** Linha de dados de produtividade para relatórios "Dados Gerais" (agrupado por id_carga_cliente). */
export interface DadoProdutividadeRelatorio {
  id_carga_cliente: string
  carga: string
  data_carga: string
  filial: string
  cliente: string
  colaborador: string | null
  hora_inicial: string | null
  hora_final: string | null
  peso_liquido_total: number
  volume_total: number
  paletes_total: number
  tempo: number | null
  kg_hs: number | null
  vol_hs: number | null
  plt_hs: number | null
  erro_separacao: number
  erro_entregas: number
  observacao: string | null
}

/** ISO date em horário local (evita timezone: 01/01 local não vira 31/12 UTC). */
function toISODateLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Busca dados de evolução temporal por data_carga para o relatório HTML (mesmo RPC do dashboard). */
export async function fetchEvolucaoTemporal(
  mesNome: string,
  ano: number,
  idFilial: string | null
): Promise<EvolucaoTemporalRow[]> {
  const supabase = createClient()
  let dataInicio: Date
  let dataFim: Date
  if (!mesNome || mesNome === 'todos') {
    dataInicio = new Date(ano, 0, 1)
    dataFim = new Date(ano, 11, 31)
  } else {
    const numStr = MES_NOME_TO_NUM[mesNome.toLowerCase()]
    const month = numStr ? parseInt(numStr, 10) - 1 : 0
    dataInicio = new Date(ano, month, 1)
    dataFim = new Date(ano, month + 1, 0)
  }
  const { data, error } = await supabase.rpc('get_dashboard_evolucao', {
    p_data_inicio: toISODateLocal(dataInicio),
    p_data_fim: toISODateLocal(dataFim),
    p_id_filial: idFilial,
    p_busca: null,
    p_id_colaborador: null,
    p_carga: null,
    p_nota_fiscal: null,
    p_cliente: null,
    p_rede: null,
    p_cidade_cliente: null,
    p_uf: null,
    p_produto: null,
    p_familia: null,
    p_tempo_min: null,
    p_tempo_max: null,
  })
  if (error || !data || data.length === 0) {
    return await fetchEvolucaoTemporalFromRecebimentos(supabase, dataInicio, dataFim, idFilial)
  }
  return (data ?? []).map((r: { data_carga: string; total_kg: number; total_volume: number; total_paletes: number }) => ({
    data_carga: r.data_carga,
    total_kg: Number(r.total_kg ?? 0),
    total_volume: Number(r.total_volume ?? 0),
    total_paletes: Number(r.total_paletes ?? 0),
  }))
}

/** Fallback: busca evolução temporal a partir de recebimentos (DockProd). */
async function fetchEvolucaoTemporalFromRecebimentos(
  supabase: ReturnType<typeof createClient>,
  dataInicio: Date,
  dataFim: Date,
  idFilial: string | null
): Promise<EvolucaoTemporalRow[]> {
  const queryFn = () => {
    let qRec = supabase
      .from('recebimentos')
      .select('id, id_filial, dta_receb, id_coleta_recebimento, peso_liquido_recebido, qtd_caixas_recebidas')
      .gte('dta_receb', toISODateLocal(dataInicio))
      .lte('dta_receb', toISODateLocal(dataFim))
    if (idFilial) qRec = qRec.eq('id_filial', idFilial)
    return qRec
  }

  const recList = await fetchAllRows<any>(queryFn)
  const recs = (recList ?? []) as Array<{
    id: string
    id_filial: string | null
    dta_receb: string | null
    id_coleta_recebimento: string | null
    peso_liquido_recebido: number | null
    qtd_caixas_recebidas: number | null
  }>
  const porDia = new Map<string, { kg: number; volume: number; paletes: number }>()
  const coletasPorDia = new Map<string, Map<string, number[]>>()
  recs.forEach((r) => {
    const d = r.dta_receb ?? ''
    if (!d) return
    if (!porDia.has(d)) {
      porDia.set(d, { kg: 0, volume: 0, paletes: 0 })
      coletasPorDia.set(d, new Map())
    }
    const pd = porDia.get(d)!
    pd.kg += Number(r.peso_liquido_recebido ?? 0)
    pd.volume += Number(r.qtd_caixas_recebidas ?? 0)
    const idColeta = r.id_coleta_recebimento ?? ''
    if (!coletasPorDia.get(d)!.has(idColeta)) coletasPorDia.get(d)!.set(idColeta, [])
    coletasPorDia.get(d)!.get(idColeta)!.push(Number(r.qtd_caixas_recebidas ?? 0))
  })
  coletasPorDia.forEach((coletas, d) => {
    let plts = 0
    coletas.forEach((qtds) => { plts += contarPaletes(qtds) })
    const pd = porDia.get(d)
    if (pd) pd.paletes = plts
  })
  return Array.from(porDia.entries())
    .map(([data_carga, v]) => ({
      data_carga,
      total_kg: v.kg,
      total_volume: v.volume,
      total_paletes: v.paletes,
    }))
    .sort((a, b) => a.data_carga.localeCompare(b.data_carga))
}

/** Filtros opcionais para relatórios Dados Gerais (mesmo padrão da tela Relatórios). */
export interface FiltrosDadosGerais {
  dataInicio?: string
  dataFim?: string
  id_filial?: string
  id_colaborador?: string
}

/** Busca dados de produtividade (recebimentos + tempo agrupados por coleta) para relatórios Dados Gerais (DockProd). */
export async function fetchAllDadosProdutividade(filtros?: FiltrosDadosGerais | null): Promise<DadoProdutividadeRelatorio[]> {
  const supabase = createClient()
  const hoje = new Date()
  const dataInicio = filtros?.dataInicio ?? toISODateLocal(new Date(hoje.getFullYear(), hoje.getMonth(), 1))
  const dataFim = filtros?.dataFim ?? toISODateLocal(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0))
  let nomeColaborador: string | null = null
  if (filtros?.id_colaborador) {
    const { data: col } = await supabase.from('colaboradores').select('nome').eq('id', filtros.id_colaborador).single()
    nomeColaborador = (col as { nome?: string } | null)?.nome ?? null
  }

  const queryFn = () => {
    let q = supabase
      .from('recebimentos')
      .select('*')
      .gte('dta_receb', dataInicio)
      .lte('dta_receb', dataFim)
      .order('dta_receb', { ascending: false })
    if (filtros?.id_filial) q = q.eq('id_filial', filtros.id_filial)
    if (nomeColaborador) q = q.eq('usuario_recebto', nomeColaborador)
    return q
  }

  const recebimentos = await fetchAllRows<any>(queryFn)

  const recList = (recebimentos ?? []) as Array<{
    id: string
    id_filial: string | null
    id_coleta_recebimento: string | null
    filial: string | null
    fornecedor: string | null
    coleta: string | null
    dta_receb: string | null
    usuario_recebto: string | null
    qtd_caixas_recebidas: number | null
    peso_liquido_recebido: number | null
    observacao: string | null
  }>

  const coletasIds = [...new Set(recList.map((r) => r.id_coleta_recebimento ?? r.id).filter(Boolean))] as string[]
  if (coletasIds.length === 0) return []

  const { data: tempoData } = await supabase
    .from('tempo')
    .select('*')
    .in('id_coleta_recebimento', coletasIds)
  const tempoList = (tempoData ?? []) as Array<{
    id: string
    id_coleta_recebimento: string | null
    inicio_recebimento: string | null
    final_recebimento: string | null
    tempo_recebimento: string | null
  }>
  const tempoPorColeta = new Map<string, { inicio: string | null; final: string | null; tempo_recebimento: string | null }>()
  tempoList.forEach((t) => {
    const key = t.id_coleta_recebimento ?? ''
    if (key && coletasIds.includes(key) && !tempoPorColeta.has(key)) {
      tempoPorColeta.set(key, {
        inicio: t.inicio_recebimento ? String(t.inicio_recebimento) : null,
        final: t.final_recebimento ? String(t.final_recebimento) : null,
        tempo_recebimento: t.tempo_recebimento ? String(t.tempo_recebimento) : null,
      })
    }
  })

  const grupos = new Map<string, {
    id_coleta: string
    id_filial: string | null
    filial: string
    coleta: string
    fornecedor: string
    data_carga: string
    colaborador: string | null
    qtd_caixas: number
    peso_liquido: number
    qtd_caixas_arr: number[]
    observacoes: string[]
  }>()
  recList.forEach((r) => {
    const key = (r.id_coleta_recebimento ?? r.id) as string
    if (!grupos.has(key)) {
      grupos.set(key, {
        id_coleta: key,
        id_filial: r.id_filial,
        filial: (r.filial ?? '') as string,
        coleta: (r.coleta ?? '') as string,
        fornecedor: (r.fornecedor ?? '') as string,
        data_carga: r.dta_receb ? String(r.dta_receb).slice(0, 10) : '',
        colaborador: r.usuario_recebto ? String(r.usuario_recebto) : null,
        qtd_caixas: 0,
        peso_liquido: 0,
        qtd_caixas_arr: [],
        observacoes: [],
      })
    }
    const g = grupos.get(key)!
    g.qtd_caixas += Number(r.qtd_caixas_recebidas ?? 0)
    g.peso_liquido += Number(r.peso_liquido_recebido ?? 0)
    g.qtd_caixas_arr.push(Number(r.qtd_caixas_recebidas ?? 0))
    if (r.observacao && r.observacao.trim()) g.observacoes.push(String(r.observacao).trim())
  })

  const all: DadoProdutividadeRelatorio[] = []
  const gruposOrdenados = [...grupos.entries()].sort((a, b) => b[1].data_carga.localeCompare(a[1].data_carga))
  gruposOrdenados.forEach(([, g]) => {
    const tempo = tempoPorColeta.get(g.id_coleta)
    const tempoHoras = tempo?.tempo_recebimento != null ? intervalToHours(tempo.tempo_recebimento) : null
    const paletes = contarPaletes(g.qtd_caixas_arr)
    const th = tempoHoras ?? null
    const kgHs = th != null && th > 0 ? g.peso_liquido / th : null
    const volHs = th != null && th > 0 ? g.qtd_caixas / th : null
    const pltHs = th != null && th > 0 ? paletes / th : null
    let horaInicial: string | null = null
    let horaFinal: string | null = null
    if (tempo?.inicio) {
      try {
        const d = new Date(tempo.inicio)
        horaInicial = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
      } catch {
        horaInicial = null
      }
    }
    if (tempo?.final) {
      try {
        const d = new Date(tempo.final)
        horaFinal = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
      } catch {
        horaFinal = null
      }
    }
    all.push({
      id_carga_cliente: g.id_coleta,
      carga: g.coleta,
      data_carga: g.data_carga,
      filial: g.filial,
      cliente: g.fornecedor ?? '',
      colaborador: g.colaborador,
      hora_inicial: horaInicial,
      hora_final: horaFinal,
      peso_liquido_total: g.peso_liquido,
      volume_total: g.qtd_caixas,
      paletes_total: paletes,
      tempo: tempoHoras,
      kg_hs: kgHs,
      vol_hs: volHs,
      plt_hs: pltHs,
      erro_separacao: 0,
      erro_entregas: 0,
      observacao: g.observacoes.length > 0 ? g.observacoes.join('; ') : null,
    })
  })
  return all
}

export async function fetchReportData(mesNome: string, ano: number) {
  const supabase = createClient()
  let query = supabase
    .from('fechamento')
    .select(`
      id,
      id_colaborador,
      id_filial,
      mes,
      ano,
      peso_liquido_total,
      volume_total,
      paletes_total,
      tempo_total,
      kg_hs,
      vol_hs,
      plt_hs,
      erro_separacao_total,
      erro_entregas_total,
      percentual_erros,
      valor_kg_hs,
      valor_vol_hs,
      valor_plt_hs,
      produtividade_bruta,
      percentual_descontos,
      valor_descontos,
      produtividade_final,
      meta,
      percentual_atingimento,
      colaboradores (nome),
      filiais (nome)
    `)
  // Se mesNome não for "todos", filtrar por mês específico
  if (mesNome && mesNome !== 'todos') {
    query = query.eq('mes', mesNome)
  }
  const { data, error } = await query
    .eq('ano', ano)
    .order('id_filial')
    .order('id_colaborador')

  if (error) throw error

  let linhas: FechamentoLinha[] = (data ?? []).map((f: Record<string, unknown>) => ({
    id: f.id as string,
    id_colaborador: f.id_colaborador as string,
    id_filial: f.id_filial as string,
    mes: f.mes as string,
    ano: f.ano as number,
    colaborador_nome: (f.colaboradores as { nome?: string } | null)?.nome ?? '',
    filial_nome: (f.filiais as { nome?: string } | null)?.nome ?? '',
    peso_liquido_total: Number(f.peso_liquido_total ?? 0),
    volume_total: Number(f.volume_total ?? 0),
    paletes_total: Number(f.paletes_total ?? 0),
    tempo_total: Number(f.tempo_total ?? 0),
    kg_hs: Number(f.kg_hs ?? 0),
    vol_hs: Number(f.vol_hs ?? 0),
    plt_hs: Number(f.plt_hs ?? 0),
    erro_separacao_total: Number(f.erro_separacao_total ?? 0),
    erro_entregas_total: Number(f.erro_entregas_total ?? 0),
    percentual_erros: Number(f.percentual_erros ?? 0),
    valor_kg_hs: Number(f.valor_kg_hs ?? 0),
    valor_vol_hs: Number(f.valor_vol_hs ?? 0),
    valor_plt_hs: Number(f.valor_plt_hs ?? 0),
    produtividade_bruta: Number(f.produtividade_bruta ?? 0),
    percentual_descontos: Number(f.percentual_descontos ?? 0),
    valor_descontos: Number(f.valor_descontos ?? 0),
    produtividade_final: Number(f.produtividade_final ?? 0),
    meta: Number(f.meta ?? 300),
    percentual_atingimento: Number(f.percentual_atingimento ?? 0),
  }))

  // Enriquecer com resultados (bonus_final, desconto) – fechamento não popula esses campos
  if (mesNome && mesNome !== 'todos') {
    const { data: resData } = await supabase
      .from('resultados')
      .select('id_colaborador, id_filial, mes, bonus_final, desconto')
      .eq('mes', mesNome)
    const resultadosMap = new Map<string, { bonus_final: number; desconto: number }>()
    for (const r of resData ?? []) {
      const key = `${r.id_colaborador}|${r.id_filial}|${r.mes}`
      resultadosMap.set(key, {
        bonus_final: Number(r.bonus_final ?? 0),
        desconto: Number(r.desconto ?? 0),
      })
    }
    const metaPadrao = 250
    linhas = linhas.map((l) => {
      const key = `${l.id_colaborador}|${l.id_filial}|${l.mes}`
      const res = resultadosMap.get(key)
      if (res) {
        const meta = l.meta > 0 ? l.meta : metaPadrao
        const pctAting = meta > 0 ? (res.bonus_final / meta) * 100 : 0
        return {
          ...l,
          produtividade_final: res.bonus_final,
          valor_descontos: res.desconto,
          percentual_atingimento: pctAting,
        }
      }
      return l
    })
  }

  return linhas
}

/** Linha da Tabela de Descontos no relatório HTML (fonte: tabela descontos). */
export interface DescontoReportRow {
  colaborador_nome: string
  filial_nome: string
  mes_ano_formatado: string
  falta_injustificada: number
  ferias: string
  advertencia: number
  suspensao: number
  atestado: number
  percentual_total: number
  observacao: string
}

export async function fetchReportDescontos(
  mesNome: string,
  ano: number,
  idFilial: string | null
): Promise<DescontoReportRow[]> {
  const supabase = createClient()
  if (!mesNome || mesNome === 'todos') {
    return []
  }
  const numStr = MES_NOME_TO_NUM[mesNome.toLowerCase()]
  const monthIdx = numStr ? parseInt(numStr, 10) - 1 : 0
  const dataInicio = new Date(ano, monthIdx, 1)
  const dataFim = new Date(ano, monthIdx + 1, 0)
  const queryFn = () => {
    let query = supabase
      .from('descontos')
      .select(`
        *,
        colaboradores (nome),
        filiais (nome)
      `)
      .gte('mes_desconto', toISODateLocal(dataInicio))
      .lte('mes_desconto', toISODateLocal(dataFim))
    if (idFilial) query = query.eq('id_filial', idFilial)
    return query
  }

  const data = await fetchAllRows<any>(queryFn)
  return (data ?? []).map((d: Record<string, unknown>) => {
    const mesDesconto = d.mes_desconto ? String(d.mes_desconto).slice(0, 10) : ''
    let mesAnoFormatado = ''
    if (mesDesconto) {
      const year = parseInt(mesDesconto.slice(0, 4), 10)
      const monthNum = parseInt(mesDesconto.slice(5, 7), 10) - 1
      const mes = getMesNome(monthNum)
      mesAnoFormatado = `${mes.charAt(0).toUpperCase() + mes.slice(1)}/${year}`
    }
    const colab = d.colaboradores as { nome?: string } | null
    const filial = d.filiais as { nome?: string } | null
    const feriasVal = Number(d.ferias ?? 0)
    return {
      colaborador_nome: colab?.nome ?? '',
      filial_nome: filial?.nome ?? '',
      mes_ano_formatado: mesAnoFormatado,
      falta_injustificada: Number(d.falta_injustificada ?? 0),
      ferias: feriasVal ? 'Sim' : '-',
      advertencia: Number(d.advertencia ?? 0),
      suspensao: Number(d.suspensao ?? 0),
      atestado: Number(d.atestado ?? 0),
      percentual_total: Number(d.percentual_total ?? 0),
      observacao: (d.observacao ?? '') as string,
    }
  })
}

/** Linha da tabela Dados por Coleta no relatório HTML (fonte: recebimentos + tempo). */
export interface DadoColetaReportRow {
  mes_ano: string
  filial: string
  coleta: string
  fornec: string
  dta_receb: string
  qtd_caixas: number
  peso_liquido: number
  qtd_paletes: number
  hora_inicial: string | null
  hora_final: string | null
  tempo_horas: number | null
  kg_hs: number | null
  vol_hs: number | null
  plt_hs: number | null
}

/** Linha da Tabela de Fechamento/Resultado no relatório HTML (fonte: tabela resultados). */
export interface ResultadoReportRow {
  filial_nome: string
  mes_ano_formatado: string
  funcao: string
  matricula: string
  colaborador_nome: string
  plt_hs: number
  acuracidade: number
  checklist: number
  perda: number
  vlr_acuracidade: number
  vlr_checklist: number
  vlr_plt_hs: number
  vlr_perda: number
  desconto: number
  prod_final: number
  meta: number
}

const META_BONUS = 250

export async function fetchReportResultados(
  mesNome: string,
  ano: number,
  idFilial: string | null
): Promise<ResultadoReportRow[]> {
  const supabase = createClient()
  if (!mesNome || mesNome === 'todos') {
    return []
  }
  const queryFn = () => {
    let query = supabase
      .from('resultados')
      .select(`
        *,
        colaboradores (nome, matricula, funcao, filiais (codigo, nome))
      `)
      .eq('mes', mesNome)
    if (idFilial) query = query.eq('id_filial', idFilial)
    return query
  }

  const data = await fetchAllRows<any>(queryFn)
  const mesesLongos: Record<string, string> = {
    janeiro: 'Janeiro', fevereiro: 'Fevereiro', março: 'Março', abril: 'Abril',
    maio: 'Maio', junho: 'Junho', julho: 'Julho', agosto: 'Agosto',
    setembro: 'Setembro', outubro: 'Outubro', novembro: 'Novembro', dezembro: 'Dezembro',
  }
  const mesFormatado = mesesLongos[mesNome.toLowerCase()] || mesNome
  const mesAnoFormatado = `${mesFormatado}/${ano}`
  return (data ?? []).map((r: Record<string, unknown>) => {
    const col = r.colaboradores as { nome?: string; matricula?: string; funcao?: string; filiais?: { codigo?: string; nome?: string } } | null
    const filiaisObj = col?.filiais
    const codigo = (Array.isArray(filiaisObj) ? filiaisObj[0] : filiaisObj)?.codigo ?? ''
    const funcao = (col?.funcao ?? '') as string
    const setor = funcao.toLowerCase().includes('estoque') ? 'estoque' : 'recebimento'
    const acuracidade = Number(r.acuracidade ?? 0)
    const checklist = Number(r.checklist ?? 0)
    const pltHs = Number(r.plt_hs ?? 0)
    const perda = Number(r.perda ?? 0)
    const bonusFinal = Number(r.bonus_final ?? 0)
    const desconto = Number(r.desconto ?? 0)
    return {
      filial_nome: (r.filial ?? '') as string,
      mes_ano_formatado: mesAnoFormatado,
      funcao: funcao || '—',
      matricula: (col?.matricula ?? '') as string,
      colaborador_nome: (col?.nome ?? '') as string,
      plt_hs: pltHs,
      acuracidade,
      checklist,
      perda,
      vlr_acuracidade: calcularValorAcuracidade(acuracidade),
      vlr_checklist: calcularValorChecklist(checklist),
      vlr_plt_hs: calcularValorPltHsPorFilial(pltHs, codigo, setor),
      vlr_perda: setor === 'estoque' ? calcularValorPerda(perda) : 0,
      desconto,
      prod_final: bonusFinal,
      meta: META_BONUS,
    }
  })
}

const mesesLongosReport: Record<string, string> = {
  janeiro: 'Janeiro', fevereiro: 'Fevereiro', março: 'Março', abril: 'Abril',
  maio: 'Maio', junho: 'Junho', julho: 'Julho', agosto: 'Agosto',
  setembro: 'Setembro', outubro: 'Outubro', novembro: 'Novembro', dezembro: 'Dezembro',
}

/** Busca dados por coleta (recebimentos + tempo) para o relatório HTML, filtrado por mês/ano. */
export async function fetchReportDadosPorColeta(
  mesNome: string,
  ano: number,
  idFilial: string | null
): Promise<DadoColetaReportRow[]> {
  const supabase = createClient()
  if (!mesNome || mesNome === 'todos') return []

  const numStr = MES_NOME_TO_NUM[mesNome.toLowerCase()]
  const monthIdx = numStr ? parseInt(numStr, 10) - 1 : 0
  const dataInicio = new Date(ano, monthIdx, 1)
  const dataFim = new Date(ano, monthIdx + 1, 0)
  const dataInicioStr = toISODateLocal(dataInicio)
  const dataFimStr = toISODateLocal(dataFim)
  const mesAnoFormatado = `${mesesLongosReport[mesNome.toLowerCase()] || mesNome}/${ano}`

  const queryFn = () => {
    let q = supabase
      .from('recebimentos')
      .select('*')
      .gte('dta_receb', dataInicioStr)
      .lte('dta_receb', dataFimStr)
      .order('dta_receb', { ascending: false })
    if (idFilial) q = q.eq('id_filial', idFilial)
    return q
  }

  const recebimentos = await fetchAllRows<any>(queryFn)

  const recList = (recebimentos ?? []) as Array<{
    id: string
    id_filial: string | null
    id_coleta_recebimento: string | null
    filial: string | null
    coleta: string | null
    fornecedor: string | null
    dta_receb: string | null
    qtd_caixas_recebidas: number | null
    peso_liquido_recebido: number | null
    observacao: string | null
  }>

  const coletasIds = [...new Set(recList.map((r) => r.id_coleta_recebimento ?? r.id).filter(Boolean))] as string[]

  const { data: tempoData } = await supabase.from('tempo').select('*')
  const tempoList = (tempoData ?? []) as Array<{
    id: string
    id_coleta_recebimento: string | null
    inicio_recebimento: string | null
    final_recebimento: string | null
    tempo_recebimento: string | null
  }>
  const tempoPorColeta = new Map<string, { id: string; inicio: string | null; final: string | null; tempo_recebimento: string | null }>()
  tempoList.forEach((t) => {
    const key = t.id_coleta_recebimento ?? ''
    if (key && coletasIds.includes(key) && !tempoPorColeta.has(key)) {
      tempoPorColeta.set(key, {
        id: t.id,
        inicio: t.inicio_recebimento ? (typeof t.inicio_recebimento === 'string' ? t.inicio_recebimento : null) : null,
        final: t.final_recebimento ? (typeof t.final_recebimento === 'string' ? t.final_recebimento : null) : null,
        tempo_recebimento: t.tempo_recebimento ? String(t.tempo_recebimento) : null,
      })
    }
  })

  const grupos = new Map<string, {
    ids: string[]
    id_filial: string | null
    filial: string
    coleta: string
    fornec: string
    dta_receb: string
    qtd_caixas: number
    peso_liquido: number
    qtd_caixas_arr: number[]
  }>()
  recList.forEach((r) => {
    const key = (r.id_coleta_recebimento ?? r.id) as string
    if (!grupos.has(key)) {
      grupos.set(key, {
        ids: [],
        id_filial: r.id_filial ?? null,
        filial: (r.filial ?? '') as string,
        coleta: (r.coleta ?? '') as string,
        fornec: (r.fornecedor ?? '') as string,
        dta_receb: r.dta_receb ? String(r.dta_receb).slice(0, 10) : '',
        qtd_caixas: 0,
        peso_liquido: 0,
        qtd_caixas_arr: [],
      })
    }
    const g = grupos.get(key)!
    g.ids.push(r.id)
    g.qtd_caixas += Number(r.qtd_caixas_recebidas ?? 0)
    g.peso_liquido += Number(r.peso_liquido_recebido ?? 0)
    g.qtd_caixas_arr.push(Number(r.qtd_caixas_recebidas ?? 0))
  })

  const gruposOrdenados = [...grupos.entries()].sort((a, b) => b[1].dta_receb.localeCompare(a[1].dta_receb))
  const rows: DadoColetaReportRow[] = []
  gruposOrdenados.forEach(([idColeta, g]) => {
    const tempo = tempoPorColeta.get(idColeta)
    const tempoHoras = tempo?.tempo_recebimento != null ? intervalToHours(tempo.tempo_recebimento) : null
    const paletes = contarPaletes(g.qtd_caixas_arr)
    const th = tempoHoras ?? null
    const kgHs = th != null && th > 0 ? g.peso_liquido / th : null
    const volHs = th != null && th > 0 ? g.qtd_caixas / th : null
    const pltHs = th != null && th > 0 ? paletes / th : null
    let horaInicial: string | null = null
    let horaFinal: string | null = null
    if (tempo?.inicio) {
      try {
        const d = new Date(tempo.inicio)
        horaInicial = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
      } catch {
        horaInicial = null
      }
    }
    if (tempo?.final) {
      try {
        const d = new Date(tempo.final)
        horaFinal = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
      } catch {
        horaFinal = null
      }
    }
    rows.push({
      mes_ano: mesAnoFormatado,
      filial: g.filial,
      coleta: g.coleta,
      fornec: g.fornec,
      dta_receb: formatDateBR(g.dta_receb || ''),
      qtd_caixas: g.qtd_caixas,
      peso_liquido: g.peso_liquido,
      qtd_paletes: paletes,
      hora_inicial: horaInicial,
      hora_final: horaFinal,
      tempo_horas: tempoHoras,
      kg_hs: kgHs,
      vol_hs: volHs,
      plt_hs: pltHs,
    })
  })

  return rows
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const XLSX_COLUMNS = [
  { header: 'Filial', key: 'filial_nome', width: 18 },
  { header: 'Colaborador', key: 'colaborador_nome', width: 22 },
  { header: 'Peso Liq. Total', key: 'peso_liquido_total', width: 14 },
  { header: 'Volume Total', key: 'volume_total', width: 14 },
  { header: 'Paletes Total', key: 'paletes_total', width: 14 },
  { header: 'Tempo Total', key: 'tempo_total', width: 12 },
  { header: 'Kg/Hs', key: 'kg_hs', width: 10 },
  { header: 'Vol/Hs', key: 'vol_hs', width: 10 },
  { header: 'Plt/Hs', key: 'plt_hs', width: 10 },
  { header: 'Erros Sep.', key: 'erro_separacao_total', width: 10 },
  { header: 'Erros Ent.', key: 'erro_entregas_total', width: 10 },
  { header: 'Vlr Kg/Hs', key: 'valor_kg_hs', width: 10 },
  { header: 'Vlr Vol/Hs', key: 'valor_vol_hs', width: 10 },
  { header: 'Vlr Plt/Hs', key: 'valor_plt_hs', width: 10 },
  { header: 'Prod. Bruta', key: 'produtividade_bruta', width: 12 },
  { header: '% Descontos', key: 'percentual_descontos', width: 12 },
  { header: 'Prod. Final R$', key: 'produtividade_final', width: 14 },
  { header: 'Meta', key: 'meta', width: 10 },
  { header: '% Atingimento', key: 'percentual_atingimento', width: 14 },
]

export async function exportXLSX(data: FechamentoLinha[], mesNome: string, ano: number) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Fechamento', { headerFooter: { firstHeader: 'Relatório PickProd - Fechamento' } })

  sheet.columns = XLSX_COLUMNS as unknown as ExcelJS.Column[]
  const headerRow = sheet.getRow(1)
  headerRow.values = XLSX_COLUMNS.map((c) => c.header) as unknown as ExcelJS.CellValue[]
  headerRow.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF006400' },
  }
  sheet.addRows(data)
  const lastCol = String.fromCharCode(64 + XLSX_COLUMNS.length)
  const lastRow = data.length + 1
  sheet.autoFilter = { from: 'A1', to: `${lastCol}${lastRow}` }
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF90EE90' } },
        left: { style: 'thin', color: { argb: 'FF90EE90' } },
        bottom: { style: 'thin', color: { argb: 'FF90EE90' } },
        right: { style: 'thin', color: { argb: 'FF90EE90' } },
      }
    })
  })

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  downloadBlob(blob, `relatorio-fechamento-${mesNome}-${ano}.xlsx`)
}

export function exportCSV(data: FechamentoLinha[], mesNome: string, ano: number) {
  const headers = [
    'Filial',
    'Colaborador',
    'Peso Liq. Total',
    'Volume Total',
    'Paletes Total',
    'Tempo Total',
    'Kg/Hs',
    'Vol/Hs',
    'Plt/Hs',
    'Erros Sep.',
    'Erros Ent.',
    'Vlr Kg/Hs',
    'Vlr Vol/Hs',
    'Vlr Plt/Hs',
    'Prod. Bruta',
    '% Descontos',
    'Prod. Final R$',
    'Meta',
    '% Atingimento',
  ]
  const escape = (v: string | number) => {
    const s = String(v)
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const rows = data.map((r) =>
    [
      r.filial_nome,
      r.colaborador_nome,
      r.peso_liquido_total,
      r.volume_total,
      r.paletes_total,
      r.tempo_total,
      r.kg_hs,
      r.vol_hs,
      r.plt_hs,
      r.erro_separacao_total,
      r.erro_entregas_total,
      r.valor_kg_hs,
      r.valor_vol_hs,
      r.valor_plt_hs,
      r.produtividade_bruta,
      r.percentual_descontos,
      r.produtividade_final,
      r.meta,
      r.percentual_atingimento,
    ].map(escape).join(',')
  )
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  downloadBlob(blob, `relatorio-fechamento-${String(mesNome).replace(/\s/g, '-')}-${ano}.csv`)
}

export function exportHTML(data: FechamentoLinha[], mesNome: string, ano: number) {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Relatório Fechamento - ${mesNome} ${ano}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 1rem; }
    h1 { color: #166534; }
    table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
    th, td { border: 1px solid #86efac; padding: 0.5rem; text-align: left; }
    th { background: #166534; color: #fff; }
    tr:nth-child(even) { background: #f0fdf4; }
  </style>
</head>
<body>
  <h1>PickProd - Relatório de Fechamento</h1>
  <p><strong>Período:</strong> ${mesNome} ${ano}</p>
  <p><strong>Gerado em:</strong> ${new Date().toLocaleString('pt-BR')}</p>
  <table>
    <thead>
      <tr>
        <th>Filial</th>
        <th>Colaborador</th>
        <th>Peso Liq.</th>
        <th>Volume</th>
        <th>Paletes</th>
        <th>Tempo</th>
        <th>Kg/Hs</th>
        <th>Vol/Hs</th>
        <th>Plt/Hs</th>
        <th>Prod. Final R$</th>
        <th>Meta</th>
        <th>% Ating.</th>
      </tr>
    </thead>
    <tbody>
      ${data
      .map(
        (r) => `
      <tr>
        <td>${r.filial_nome}</td>
        <td>${r.colaborador_nome}</td>
        <td>${r.peso_liquido_total.toFixed(2)}</td>
        <td>${r.volume_total.toFixed(2)}</td>
        <td>${r.paletes_total.toFixed(2)}</td>
        <td>${r.tempo_total.toFixed(2)}</td>
        <td>${r.kg_hs.toFixed(2)}</td>
        <td>${r.vol_hs.toFixed(2)}</td>
        <td>${r.plt_hs.toFixed(2)}</td>
        <td>${r.produtividade_final.toFixed(2)}</td>
        <td>${r.meta.toFixed(2)}</td>
        <td>${r.percentual_atingimento.toFixed(1)}%</td>
      </tr>`
      )
      .join('')}
    </tbody>
  </table>
</body>
</html>`
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function getWhatsAppSummaryLink(data: FechamentoLinha[], mesNome: string, ano: number): string {
  const totalProd = data.reduce((s, r) => s + r.produtividade_final, 0)
  const metaTotal = data.length * 300
  const atingimento = metaTotal > 0 ? ((totalProd / metaTotal) * 100).toFixed(1) : '0'
  const text = `*PickProd - Resumo ${mesNome} ${ano}*
• Total Produtividade: R$ ${totalProd.toFixed(2)}
• Colaboradores: ${data.length}
• % Atingimento: ${atingimento}%
Gerado em ${new Date().toLocaleDateString('pt-BR')}`
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}
