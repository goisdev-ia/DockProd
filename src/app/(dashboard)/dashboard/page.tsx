'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  getDatasPorPeriodo,
  toISODate,
  parseISODateLocal,
  getMesAnoPorPeriodo,
  type PeriodoOption,
} from '@/lib/dashboard-filters'
import { contarPaletes, intervalToHours } from '@/lib/calculos'
import {
  DollarSign,
  TrendingUp,
  Package,
  FileText,
  Weight,
  Box,
  Boxes,
  Clock,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react'
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  LabelList,
} from 'recharts'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu'

// DockProd: dados para gráficos vêm de resultados + fechamento (totais)
interface FechamentoChartRow {
  id_colaborador: string
  id_filial: string
  colaborador_nome: string
  filial_nome: string
  produtividade_final: number
  peso_liquido_total: number
  volume_total: number
  paletes_total: number
  valor_descontos: number
}

interface ResumoColaboradorRow {
  id_colaborador: string
  nome: string
  total_cargas: number
  total_pedidos: number
  peso_total: number
  volume_total: number
  paletes_total: number
  tempo_total: number
  tempo_medio: number
}

interface ResumoFilialRow {
  id_filial: string
  nome: string
  total_cargas: number
  total_pedidos: number
  peso_total: number
  volume_total: number
  paletes_total: number
  tempo_total: number
}

interface EvolucaoRow {
  data_carga: string
  total_kg: number
  total_volume: number
  total_paletes: number
}

interface TopFornecedorRow {
  fornecedor: string
  total_peso: number
}

interface KPICardProps {
  title: string
  value: string | number
  description?: string
  icon: React.ReactNode
  trend?: {
    value: number
    positive: boolean
  }
}

function KPICard({ title, value, description, icon, trend }: KPICardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend && (
          <div className={`text-xs flex items-center mt-2 ${trend.positive ? 'text-green-600' : 'text-red-600'}`}>
            <TrendingUp className="w-3 h-3 mr-1" />
            {trend.positive ? '+' : ''}{trend.value}% vs período anterior
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const PERIODO_OPCOES: { value: PeriodoOption; label: string }[] = [
  { value: 'hoje', label: 'Hoje' },
  { value: 'ontem', label: 'Ontem' },
  { value: 'ultimos_7', label: 'Últimos 7 dias' },
  { value: 'ultimos_15', label: 'Últimos 15 dias' },
  { value: 'mes_atual', label: 'Mês Atual' },
  { value: 'mes_anterior', label: 'Mês Anterior' },
  { value: 'trimestre_atual', label: 'Trimestre Atual' },
  { value: 'trimestre_anterior', label: 'Trimestre Anterior' },
  { value: 'semestre_atual', label: 'Semestre Atual' },
  { value: 'semestre_anterior', label: 'Semestre Anterior' },
  { value: 'ano_atual', label: 'Ano Atual' },
  { value: 'ano_anterior', label: 'Ano Anterior' },
]

export default function DashboardPage() {
  const [usuarioLogado, setUsuarioLogado] = useState<{ tipo: string; id_filial: string | null } | null>(null)
  const [filialSelecionada, setFilialSelecionada] = useState<string>('todas')
  const [periodoSelecionado, setPeriodoSelecionado] = useState<string>('ano_atual')
  const [busca, setBusca] = useState('')
  const [buscaDebounced, setBuscaDebounced] = useState('')
  const [dataCargaInicio, setDataCargaInicio] = useState<string>('')
  const [dataCargaFim, setDataCargaFim] = useState<string>('')
  const [colaboradorIds, setColaboradorIds] = useState<string[]>([])
  const [filtroFornecedor, setFiltroFornecedor] = useState('__TODOS__')
  const [periodoEvolucao, setPeriodoEvolucao] = useState<PeriodoOption>('trimestre_atual')
  const [filiais, setFiliais] = useState<{ id: string; nome: string; codigo?: string }[]>([])
  const [colaboradores, setColaboradores] = useState<{ id: string; nome: string }[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [opcoesFornecedores, setOpcoesFornecedores] = useState<string[]>([])
  const [kpis, setKpis] = useState({
    totalProdutividade: 0,
    percentualAtingimento: 0,
    totalCargas: 0,
    totalPedidos: 0,
    totalKg: 0,
    totalVolume: 0,
    totalPaletes: 0,
    tempoMedio: 0,
  })
  const [loading, setLoading] = useState(true)
  const [topFornecedoresData, setTopFornecedoresData] = useState<TopFornecedorRow[]>([])
  const [fechamentoList, setFechamentoList] = useState<FechamentoChartRow[]>([])
  const [resumoColaborador, setResumoColaborador] = useState<ResumoColaboradorRow[]>([])
  const [resumoFilial, setResumoFilial] = useState<ResumoFilialRow[]>([])
  const [evolucaoDataInterna, setEvolucaoDataInterna] = useState<EvolucaoRow[]>([])
  const [pieChartMesAno, setPieChartMesAno] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [cargasPorColaborador, setCargasPorColaborador] = useState<{ nome: string; total: number }[]>([])

  const carregarUsuarioLogado = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data: usuario } = await supabase
        .from('usuarios')
        .select('tipo, id_filial')
        .eq('id', user.id)
        .single()

      if (usuario) {
        setUsuarioLogado(usuario)

        // Se for colaborador, fixar a filial
        if (usuario.tipo === 'colaborador' && usuario.id_filial) {
          setFilialSelecionada(usuario.id_filial)
        }
      }
    }
  }, [])

  const carregarFiliais = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('filiais')
      .select('id, nome, codigo')
      .eq('ativo', true)
    if (data) setFiliais(data)
  }, [])

  const carregarColaboradores = useCallback(async () => {
    const supabase = createClient()
    let q = supabase.from('colaboradores').select('id, nome').eq('ativo', true)
    if (filialSelecionada !== 'todas') q = q.eq('id_filial', filialSelecionada)
    const { data } = await q
    if (data) setColaboradores(data)
  }, [filialSelecionada])

  const carregarOpcoesFiltros = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('recebimentos').select('fornecedor').not('fornecedor', 'is', null)
    if (data) {
      const unique = Array.from(new Set(data.map((r: { fornecedor?: string }) => r.fornecedor).filter(Boolean))) as string[]
      setOpcoesFornecedores(unique.sort())
    }
  }, [])

  const idFilial = filialSelecionada === 'todas' ? null : filialSelecionada
  const datasPrincipal = useMemo(() => {
    if (dataCargaInicio && dataCargaFim) {
      const di = parseISODateLocal(dataCargaInicio)
      const df = parseISODateLocal(dataCargaFim)
      if (di && df) return { data_inicio: di, data_fim: df }
    }
    return getDatasPorPeriodo(periodoSelecionado as PeriodoOption)
  }, [periodoSelecionado, dataCargaInicio, dataCargaFim])

  const filtrosPrincipal = useMemo(() => ({
    id_filial: idFilial,
    data_inicio: toISODate(datasPrincipal.data_inicio),
    data_fim: toISODate(datasPrincipal.data_fim),
    busca: buscaDebounced?.trim() || '',
    id_colaborador: colaboradorIds,
    fornecedor: (filtroFornecedor && filtroFornecedor !== '__TODOS__') ? filtroFornecedor.trim() : null,
  }), [idFilial, datasPrincipal, buscaDebounced, colaboradorIds, filtroFornecedor])

  const carregarCargasPorColaborador = useCallback(async () => {
    const supabase = createClient()
    try {
      const [ano, mes] = pieChartMesAno.split('-').map(Number)
      const mesInicio = new Date(ano, mes - 1, 1)
      const mesFim = new Date(ano, mes, 0)

      let query = supabase
        .from('recebimentos')
        .select('usuario_recebto, id_coleta_recebimento')
        .gte('dta_receb', toISODate(mesInicio))
        .lte('dta_receb', toISODate(mesFim))

      if (idFilial) query = query.eq('id_filial', idFilial)
      if (buscaDebounced) query = query.ilike('usuario_recebto', `%${buscaDebounced}%`)

      const { data } = await query

      if (data) {
        const grouped = (data as { usuario_recebto?: string; id_coleta_recebimento?: string }[]).reduce((acc, row) => {
          const nome = row.usuario_recebto || 'Sem nome'
          if (!acc[nome]) acc[nome] = new Set<string>()
          if (row.id_coleta_recebimento) acc[nome].add(row.id_coleta_recebimento)
          return acc
        }, {} as Record<string, Set<string>>)

        const result = Object.entries(grouped)
          .map(([nome, cargas]) => ({ nome, total: cargas.size }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 10)
        setCargasPorColaborador(result)
      }
    } catch (error) {
      console.error('Erro ao carregar cargas por colaborador:', error)
    }
  }, [pieChartMesAno, idFilial, buscaDebounced])

  const carregarKPIs = useCallback(async () => {
    const supabase = createClient()
    setLoading(true)
    try {
      const { data_inicio, data_fim, id_filial, fornecedor, busca } = filtrosPrincipal

      // Recebimentos no período
      let qRec = supabase
        .from('recebimentos')
        .select('id, id_filial, filial, fornecedor, usuario_recebto, dta_receb, nota_fiscal, id_coleta_recebimento, peso_liquido_recebido, qtd_caixas_recebidas')
        .gte('dta_receb', data_inicio)
        .lte('dta_receb', data_fim)
      if (id_filial) qRec = qRec.eq('id_filial', id_filial)
      if (fornecedor) qRec = qRec.eq('fornecedor', fornecedor)
      if (busca) qRec = qRec.or(`fornecedor.ilike.%${busca}%,coleta.ilike.%${busca}%`)

      const { data: recebimentos } = await qRec
      const recList = (recebimentos ?? []) as Array<{
        id: string
        id_filial: string | null
        filial: string | null
        fornecedor: string | null
        usuario_recebto: string | null
        dta_receb: string | null
        nota_fiscal: string | null
        id_coleta_recebimento: string | null
        peso_liquido_recebido: number | null
        qtd_caixas_recebidas: number | null
      }>

      const idColetas = Array.from(new Set(recList.map((r) => r.id_coleta_recebimento).filter(Boolean))) as string[]
      let tempoList: Array<{ id_coleta_recebimento: string | null; tempo_recebimento: string | null }> = []
      if (idColetas.length > 0) {
        const { data: tempoData } = await supabase
          .from('tempo')
          .select('id_coleta_recebimento, tempo_recebimento')
          .in('id_coleta_recebimento', idColetas)
        tempoList = (tempoData ?? []) as Array<{ id_coleta_recebimento: string | null; tempo_recebimento: string | null }>
      }

      const tempoPorColeta = new Map<string, number>()
      tempoList.forEach((t) => {
        const id = t.id_coleta_recebimento
        if (id) {
          const h = intervalToHours(t.tempo_recebimento)
          if (h != null) tempoPorColeta.set(id, (tempoPorColeta.get(id) ?? 0) + h)
        }
      })

      const porColeta = new Map<string, { id_filial: string | null; peso: number; volume: number; qtd_caixas: number[] }>()
      recList.forEach((r) => {
        const id = r.id_coleta_recebimento ?? r.id
        if (!porColeta.has(id)) porColeta.set(id, { id_filial: r.id_filial, peso: 0, volume: 0, qtd_caixas: [] })
        const g = porColeta.get(id)!
        g.peso += Number(r.peso_liquido_recebido ?? 0)
        g.volume += Number(r.qtd_caixas_recebidas ?? 0)
        g.qtd_caixas.push(Number(r.qtd_caixas_recebidas ?? 0))
      })

      let totalKg = 0
      let totalVolume = 0
      let totalPaletes = 0
      const totalCargas = porColeta.size
      const notasSet = new Set(recList.map((r) => r.nota_fiscal).filter(Boolean))
      const totalNotas = notasSet.size
      let somaTempo = 0
      porColeta.forEach((g, idColeta) => {
        totalKg += g.peso
        totalVolume += g.volume
        totalPaletes += contarPaletes(g.qtd_caixas)
        const th = tempoPorColeta.get(idColeta) ?? 0
        somaTempo += th
      })
      const tempoMedio = totalCargas > 0 ? somaTempo / totalCargas : 0

      // Evolução por dia (dta_receb)
      const porDia = new Map<string, { kg: number; volume: number; paletes: number }>()
      const coletasPorDia = new Map<string, Map<string, number[]>>()
      recList.forEach((r) => {
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
        const pd = porDia.get(d)!
        if (pd) pd.paletes = plts
      })
      const evolucaoArr: EvolucaoRow[] = Array.from(porDia.entries())
        .map(([data_carga, v]) => ({ data_carga, total_kg: v.kg, total_volume: v.volume, total_paletes: v.paletes }))
        .sort((a, b) => a.data_carga.localeCompare(b.data_carga))
      setEvolucaoDataInterna(evolucaoArr)

      // Top 5 fornecedores por peso
      const porFornec = new Map<string, number>()
      recList.forEach((r) => {
        const f = r.fornecedor ?? 'N/A'
        porFornec.set(f, (porFornec.get(f) ?? 0) + Number(r.peso_liquido_recebido ?? 0))
      })
      const topFornec = Array.from(porFornec.entries())
        .map(([fornecedor, total_peso]) => ({ fornecedor, total_peso }))
        .sort((a, b) => b.total_peso - a.total_peso)
        .slice(0, 5)
      setTopFornecedoresData(topFornec)

      // Resumo por colaborador (usuario_recebto)
      const porUsuario = new Map<string, { idColetas: Set<string>; notas: Set<string>; peso: number; volume: number; qtd_caixas: number[] }>()
      recList.forEach((r) => {
        const u = r.usuario_recebto ?? 'Sem nome'
        if (!porUsuario.has(u)) porUsuario.set(u, { idColetas: new Set(), notas: new Set(), peso: 0, volume: 0, qtd_caixas: [] })
        const g = porUsuario.get(u)!
        if (r.id_coleta_recebimento) g.idColetas.add(r.id_coleta_recebimento)
        if (r.nota_fiscal) g.notas.add(r.nota_fiscal)
        g.peso += Number(r.peso_liquido_recebido ?? 0)
        g.volume += Number(r.qtd_caixas_recebidas ?? 0)
        g.qtd_caixas.push(Number(r.qtd_caixas_recebidas ?? 0))
      })
      const horasPorColeta = new Map<string, number>()
      tempoList.forEach((t) => {
        const id = t.id_coleta_recebimento
        if (id) {
          const h = intervalToHours(t.tempo_recebimento) ?? 0
          horasPorColeta.set(id, (horasPorColeta.get(id) ?? 0) + h)
        }
      })
      const resumoColArr: ResumoColaboradorRow[] = Array.from(porUsuario.entries()).map(([nome, g]) => {
        let tempoTotal = 0
        g.idColetas.forEach((idc) => { tempoTotal += horasPorColeta.get(idc) ?? 0 })
        const tempoMedio = g.idColetas.size > 0 ? tempoTotal / g.idColetas.size : 0
        return {
          id_colaborador: nome,
          nome,
          total_cargas: g.idColetas.size,
          total_pedidos: g.notas.size,
          peso_total: g.peso,
          volume_total: g.volume,
          paletes_total: contarPaletes(g.qtd_caixas),
          tempo_total: tempoTotal,
          tempo_medio: tempoMedio,
        }
      })
      setResumoColaborador(resumoColArr)

      // Resumo por filial (agregar porColeta por id_filial)
      const porFilial = new Map<string, { cargas: number; peso: number; volume: number; paletes: number; tempo: number }>()
      porColeta.forEach((g, idColeta) => {
        const idF = g.id_filial ?? 'N/A'
        if (!porFilial.has(idF)) porFilial.set(idF, { cargas: 0, peso: 0, volume: 0, paletes: 0, tempo: 0 })
        const pf = porFilial.get(idF)!
        pf.cargas += 1
        pf.peso += g.peso
        pf.volume += g.volume
        pf.paletes += contarPaletes(g.qtd_caixas)
        pf.tempo += tempoPorColeta.get(idColeta) ?? 0
      })
      const resumoFilArr: ResumoFilialRow[] = Array.from(porFilial.entries()).map(([id_filial, g]) => ({
        id_filial,
        nome: filiais.find((f) => f.id === id_filial)?.nome ?? id_filial,
        total_cargas: g.cargas,
        total_pedidos: 0,
        peso_total: g.peso,
        volume_total: g.volume,
        paletes_total: g.paletes,
        tempo_total: g.tempo,
      }))
      setResumoFilial(resumoFilArr)

      // Resultados + Fechamento para R$ e gráficos (resultados não tem coluna ano)
      const mesAnoList = getMesAnoPorPeriodo(periodoSelecionado as PeriodoOption)
      const mesesList = mesAnoList.map(({ mes }) => mes)
      let qRes = supabase
        .from('resultados')
        .select('id_colaborador, id_filial, filial, mes, bonus_final, desconto, colaboradores(nome)')
      if (id_filial) qRes = qRes.eq('id_filial', id_filial)
      if (colaboradorIds.length > 0) qRes = qRes.in('id_colaborador', colaboradorIds)
      if (mesesList.length > 0) {
        const orResultados = mesesList.map((mes) => `mes.eq."${mes}"`).join(',')
        qRes = qRes.or(orResultados)
      }
      const { data: resultados } = await qRes

      let qFech = supabase
        .from('fechamento')
        .select('id_colaborador, id_filial, mes, ano, peso_liquido_total, volume_total, paletes_total, colaboradores(nome), filiais(nome)')
      if (id_filial) qFech = qFech.eq('id_filial', id_filial)
      if (colaboradorIds.length > 0) qFech = qFech.in('id_colaborador', colaboradorIds)
      const orFech = mesAnoList.map(({ mes, ano }) => `and(mes.eq."${mes}",ano.eq.${ano})`).join(',')
      if (orFech) qFech = qFech.or(orFech)
      const { data: fechamentos } = await qFech

      const resList = (resultados ?? []) as Array<Record<string, unknown> & { id_colaborador?: string; id_filial?: string; filial?: string; mes?: string; bonus_final?: number; desconto?: number; colaboradores?: { nome?: string } | null }>
      const fechList = (fechamentos ?? []) as Array<Record<string, unknown> & { id_colaborador?: string; id_filial?: string; mes?: string; ano?: number; peso_liquido_total?: number; volume_total?: number; paletes_total?: number; colaboradores?: { nome?: string } | null; filiais?: { nome?: string } | null }>

      const resultadoPorChave = new Map<string, { bonus_final: number; desconto: number }>()
      resList.forEach((r) => {
        const key = `${r.id_colaborador}-${r.id_filial}-${r.mes}`
        resultadoPorChave.set(key, {
          bonus_final: Number(r.bonus_final ?? 0),
          desconto: Number(r.desconto ?? 0),
        })
      })

      const chartList: FechamentoChartRow[] = resList.map((r) => {
        const key = `${r.id_colaborador}-${r.id_filial}-${r.mes}`
        const res = resultadoPorChave.get(key) ?? { bonus_final: 0, desconto: 0 }
        const fech = fechList.find((f) => f.id_colaborador === r.id_colaborador && f.id_filial === r.id_filial && String(f.mes) === String(r.mes))
        return {
          id_colaborador: r.id_colaborador as string,
          id_filial: r.id_filial as string,
          colaborador_nome: (r.colaboradores as { nome?: string } | null)?.nome ?? '',
          filial_nome: (r.filial as string) ?? '',
          produtividade_final: res.bonus_final,
          peso_liquido_total: fech ? Number(fech.peso_liquido_total ?? 0) : 0,
          volume_total: fech ? Number(fech.volume_total ?? 0) : 0,
          paletes_total: fech ? Number(fech.paletes_total ?? 0) : 0,
          valor_descontos: res.desconto,
        }
      })
      setFechamentoList(chartList)

      const totalProdutividade = resList.reduce((s, r) => s + Number(r.bonus_final ?? 0), 0)
      const countResultados = resList.length
      const percentualAtingimento = countResultados > 0 && 250 > 0
        ? (totalProdutividade / (countResultados * 250)) * 100
        : 0

      setKpis({
        totalProdutividade,
        percentualAtingimento,
        totalCargas,
        totalPedidos: totalNotas,
        totalKg,
        totalVolume,
        totalPaletes,
        tempoMedio,
      })
    } catch (error) {
      console.error('Erro ao carregar KPIs:', error)
    } finally {
      setLoading(false)
    }
  }, [filtrosPrincipal, periodoSelecionado, colaboradorIds, filiais])

  useEffect(() => {
    carregarUsuarioLogado()
    carregarFiliais()
    carregarOpcoesFiltros()
  }, [carregarUsuarioLogado, carregarFiliais, carregarOpcoesFiltros])

  useEffect(() => {
    carregarColaboradores()
  }, [carregarColaboradores])

  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca), 400)
    return () => clearTimeout(t)
  }, [busca])

  useEffect(() => {
    carregarKPIs()
  }, [carregarKPIs])

  useEffect(() => {
    carregarCargasPorColaborador()
  }, [carregarCargasPorColaborador])

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor)
  }

  const formatarNumero = (valor: number, decimais: number = 0) => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: decimais,
      maximumFractionDigits: decimais
    }).format(valor)
  }

  const formatarNomeColaborador = (nomeCompleto: string) => {
    const partes = nomeCompleto.trim().split(' ')
    if (partes.length >= 2) {
      return `${partes[0]} ${partes[1]}`
    }
    return partes[0] || nomeCompleto
  }

  const isPeriodoMensalOuMaior = useMemo(
    () => ['mes_atual', 'mes_anterior', 'trimestre_atual', 'trimestre_anterior', 'semestre_atual', 'semestre_anterior', 'ano_atual', 'ano_anterior'].includes(periodoSelecionado),
    [periodoSelecionado]
  )
  const porColaboradorR$ = useMemo(() => fechamentoList.reduce((acc, f) => {
    const nome = f.colaborador_nome || 'Sem nome'
    if (!acc[nome]) acc[nome] = { nome, produtividade_final: 0, peso_liquido_total: 0, volume_total: 0, paletes_total: 0, valor_descontos: 0 }
    acc[nome].produtividade_final += f.produtividade_final
    acc[nome].peso_liquido_total += f.peso_liquido_total
    acc[nome].volume_total += f.volume_total
    acc[nome].paletes_total += f.paletes_total
    acc[nome].valor_descontos += f.valor_descontos
    return acc
  }, {} as Record<string, { nome: string; produtividade_final: number; peso_liquido_total: number; volume_total: number; paletes_total: number; valor_descontos: number }>), [fechamentoList])
  const porColaboradorArrTotais = useMemo(() => isPeriodoMensalOuMaior
    ? Object.values(porColaboradorR$).sort((a, b) => b.peso_liquido_total - a.peso_liquido_total)
    : resumoColaborador.map((r) => ({ nome: r.nome, produtividade_final: 0, peso_liquido_total: r.peso_total, volume_total: r.volume_total, paletes_total: r.paletes_total, valor_descontos: 0 })).sort((a, b) => b.peso_liquido_total - a.peso_liquido_total),
    [isPeriodoMensalOuMaior, porColaboradorR$, resumoColaborador])
  const porColaboradorArrR$ = useMemo(() => Object.values(porColaboradorR$).sort((a, b) => b.produtividade_final - a.produtividade_final).slice(0, 10), [porColaboradorR$])
  const porColaboradorArr = useMemo(() => porColaboradorArrTotais.slice(0, 10), [porColaboradorArrTotais])
  const descontosPorColaborador = useMemo(() => Object.values(porColaboradorR$)
    .sort((a, b) => b.valor_descontos - a.valor_descontos)
    .slice(0, 10), [porColaboradorR$])
  const top3Descontos = useMemo(() => {
    const porColab = fechamentoList.reduce((acc, f) => {
      const nome = f.colaborador_nome || 'Sem nome'
      if (!acc[nome]) acc[nome] = { nome, valor_descontos: 0 }
      acc[nome].valor_descontos += f.valor_descontos ?? 0
      return acc
    }, {} as Record<string, { nome: string; valor_descontos: number }>)
    return Object.values(porColab).filter((x) => x.valor_descontos > 0).sort((a, b) => b.valor_descontos - a.valor_descontos).slice(0, 3)
  }, [fechamentoList])
  const porFilialR$ = useMemo(() => fechamentoList.reduce((acc, f) => {
    const nome = f.filial_nome || 'Sem filial'
    if (!acc[nome]) acc[nome] = { nome, produtividade_final: 0, peso_liquido_total: 0, volume_total: 0, paletes_total: 0 }
    acc[nome].produtividade_final += f.produtividade_final
    acc[nome].peso_liquido_total += f.peso_liquido_total
    acc[nome].volume_total += f.volume_total
    acc[nome].paletes_total += f.paletes_total
    return acc
  }, {} as Record<string, { nome: string; produtividade_final: number; peso_liquido_total: number; volume_total: number; paletes_total: number }>), [fechamentoList])
  const porFilialArrTotais = useMemo(() => isPeriodoMensalOuMaior
    ? Object.values(porFilialR$).sort((a, b) => b.peso_liquido_total - a.peso_liquido_total)
    : resumoFilial.map((r) => ({ nome: r.nome, produtividade_final: 0, peso_liquido_total: r.peso_total, volume_total: r.volume_total, paletes_total: r.paletes_total })).sort((a, b) => b.peso_liquido_total - a.peso_liquido_total),
    [isPeriodoMensalOuMaior, porFilialR$, resumoFilial])
  const porFilialArrR$ = useMemo(() => Object.values(porFilialR$).sort((a, b) => b.produtividade_final - a.produtividade_final), [porFilialR$])
  const porFilialArr = porFilialArrTotais
  const evolucaoFormatada = useMemo(() => evolucaoDataInterna.map((r) => ({
    ...r,
    data_carga: format(new Date(r.data_carga + 'T12:00:00'), 'dd/MM', { locale: ptBR }),
  })), [evolucaoDataInterna])
  const pieDataDescontos = useMemo(() => {
    const porColab = fechamentoList.reduce((acc, f) => {
      const nome = f.colaborador_nome || 'Sem nome'
      if (!acc[nome]) acc[nome] = { nome, valor: 0 }
      acc[nome].valor += f.valor_descontos ?? 0
      return acc
    }, {} as Record<string, { nome: string; valor: number }>)
    const cores = ['#b91c1c', '#dc2626', '#ef4444', '#f87171', '#fca5a5', '#fecaca', '#991b1b', '#7f1d1d']
    return Object.values(porColab)
      .filter((d) => d.valor > 0)
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 12)
      .map((d, i) => ({ name: formatarNomeColaborador(d.nome), value: Math.round(d.valor * 100) / 100, fill: cores[i % cores.length] }))
  }, [fechamentoList])
  const top3Prod = useMemo(() => porColaboradorArrR$.slice(0, 3), [porColaboradorArrR$])
  const top3Kg = useMemo(() => [...porColaboradorArrTotais].sort((a, b) => b.peso_liquido_total - a.peso_liquido_total).slice(0, 3), [porColaboradorArrTotais])
  const top3Vol = useMemo(() => [...porColaboradorArrTotais].sort((a, b) => b.volume_total - a.volume_total).slice(0, 3), [porColaboradorArrTotais])
  const top3Plt = useMemo(() => [...porColaboradorArrTotais].sort((a, b) => b.paletes_total - a.paletes_total).slice(0, 3), [porColaboradorArrTotais])
  const top3Cargas = useMemo(() => [...resumoColaborador].sort((a, b) => b.total_cargas - a.total_cargas).slice(0, 3), [resumoColaborador])
  const top3Pedidos = useMemo(() => [...resumoColaborador].sort((a, b) => b.total_pedidos - a.total_pedidos).slice(0, 3), [resumoColaborador])
  const top3TempoMedio = useMemo(() => [...resumoColaborador].sort((a, b) => b.tempo_medio - a.tempo_medio).slice(0, 3), [resumoColaborador])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Visão geral da produtividade e desempenho
        </p>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>Altere os filtros para atualizar KPIs, gráficos e tabelas</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (usuarioLogado?.tipo !== 'colaborador') setFilialSelecionada('todas')
                setPeriodoSelecionado('ano_atual')
                setDataCargaInicio('')
                setDataCargaFim('')
                setBusca('')
                setColaboradorIds([])
                setFiltroFornecedor('__TODOS__')
              }}
            >
              Limpar filtros
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              {showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
              {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        {showFilters && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="filial">Filial</Label>
                <Select
                  value={filialSelecionada}
                  onValueChange={setFilialSelecionada}
                  disabled={usuarioLogado?.tipo === 'colaborador'}
                >
                  <SelectTrigger id="filial">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
{(usuarioLogado?.tipo === 'admin' || usuarioLogado?.tipo === 'gestor') && (
                    <SelectItem value="todas">Todas as Filiais</SelectItem>
                  )}
                    {filiais.map(filial => (
                      <SelectItem key={filial.id} value={filial.id}>
                        {filial.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {usuarioLogado?.tipo === 'colaborador' && (
                  <p className="text-xs text-muted-foreground">
                    Filial fixa conforme seu perfil
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="periodo">Período</Label>
                <Select value={periodoSelecionado} onValueChange={setPeriodoSelecionado}>
                  <SelectTrigger id="periodo">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIODO_OPCOES.map((op) => (
                      <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data Receb. (início)</Label>
                <Input
                  type="date"
                  value={dataCargaInicio}
                  onChange={(e) => setDataCargaInicio(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Receb. (fim)</Label>
                <Input
                  type="date"
                  value={dataCargaFim}
                  onChange={(e) => setDataCargaFim(e.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="busca">Busca Geral</Label>
                <Input
                  id="busca"
                  placeholder="Buscar por colaborador, fornecedor, coleta..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Colaborador</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between font-normal">
                      {colaboradorIds.length === 0 ? 'Todos' : `${colaboradorIds.length} selecionado(s)`}
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-60 overflow-auto">
                    {colaboradores.map((col) => (
                      <DropdownMenuCheckboxItem
                        key={col.id}
                        checked={colaboradorIds.includes(col.id)}
                        onCheckedChange={(checked) => {
                          setColaboradorIds((prev) =>
                            checked ? [...prev, col.id] : prev.filter((id) => id !== col.id)
                          )
                        }}
                      >
                        {col.nome}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="space-y-2">
                <Label>Fornecedor</Label>
                <Select value={filtroFornecedor} onValueChange={setFiltroFornecedor}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os fornecedores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__TODOS__">Todos</SelectItem>
                    {opcoesFornecedores.slice(0, 100).map((fornec) => (
                      <SelectItem key={fornec} value={fornec}>{fornec}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {loading && (
        <p className="text-sm text-muted-foreground">Carregando indicadores...</p>
      )}

      {/* KPI Cards - Linha 1 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total R$ Produtividade"
          value={formatarMoeda(kpis.totalProdutividade)}
          description="Soma total de bônus"
          icon={<DollarSign className="h-4 w-4 text-green-600" />}
        />
        <KPICard
          title="% Atingimento"
          value={`${formatarNumero(kpis.percentualAtingimento, 1)}%`}
          description="Meta total vs realizado"
          icon={<TrendingUp className="h-4 w-4 text-blue-600" />}
        />
        <KPICard
          title="Total de Cargas"
          value={formatarNumero(kpis.totalCargas)}
          description="Coletas recebidas"
          icon={<Package className="h-4 w-4 text-purple-600" />}
        />
        <KPICard
          title="Total de Notas"
          value={formatarNumero(kpis.totalPedidos)}
          description="Notas fiscais"
          icon={<FileText className="h-4 w-4 text-orange-600" />}
        />
      </div>

      {/* KPI Cards - Linha 2 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Recebido em KG"
          value={formatarNumero(kpis.totalKg / 1000, 2)}
          description={`${formatarNumero(kpis.totalKg)} kg`}
          icon={<Weight className="h-4 w-4 text-gray-600" />}
        />
        <KPICard
          title="Total em Volume (caixas)"
          value={formatarNumero(kpis.totalVolume)}
          description="Quantidade total"
          icon={<Box className="h-4 w-4 text-cyan-600" />}
        />
        <KPICard
          title="Total em Paletes"
          value={formatarNumero(kpis.totalPaletes, 1)}
          description="Regra por caixas"
          icon={<Boxes className="h-4 w-4 text-indigo-600" />}
        />
        <KPICard
          title="Tempo Médio Recebimento"
          value={`${formatarNumero(kpis.tempoMedio, 1)}h`}
          description="Por coleta"
          icon={<Clock className="h-4 w-4 text-red-600" />}
        />
      </div>

      {/* Gráfico de Evolução Temporal - 100% largura */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>1. Evolução Temporal</CardTitle>
            <CardDescription>Peso líquido, Volume e Paletes ao longo do tempo</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant={periodoEvolucao === 'ultimos_7' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriodoEvolucao('ultimos_7')}
            >
              7d
            </Button>
            <Button
              variant={periodoEvolucao === 'mes_atual' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriodoEvolucao('mes_atual')}
            >
              30d
            </Button>
            <Button
              variant={periodoEvolucao === 'trimestre_atual' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriodoEvolucao('trimestre_atual')}
            >
              90d
            </Button>
          </div>
        </CardHeader>
        <CardContent className="h-96">
          {evolucaoFormatada.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Sem dados no período</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%" minHeight={300}>
              <AreaChart data={evolucaoFormatada}>
                <defs>
                  <linearGradient id="colorKg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#166534" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#166534" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="colorPaletes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="data_carga" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number | undefined) => (v != null ? v.toLocaleString('pt-BR') : '')} />
                <Legend />
                <Area type="monotone" dataKey="total_kg" name="Peso (kg)" stroke="#166534" strokeWidth={2} fillOpacity={1} fill="url(#colorKg)" />
                <Area type="monotone" dataKey="total_volume" name="Volume" stroke="#16a34a" strokeWidth={2} fillOpacity={1} fill="url(#colorVolume)" />
                <Area type="monotone" dataKey="total_paletes" name="Paletes" stroke="#22c55e" strokeWidth={2} fillOpacity={1} fill="url(#colorPaletes)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Gráficos em Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>2. Performance por Colaborador (R$)</CardTitle>
            <CardDescription>Produtividade final</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            {!isPeriodoMensalOuMaior ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Selecione período mensal ou maior para ver R$ por colaborador</div>
            ) : porColaboradorArrR$.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Sem dados no período</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                <BarChart data={porColaboradorArrR$.map(c => ({ ...c, nome: formatarNomeColaborador(c.nome) }))} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nome" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number | undefined) => (v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '')} />
                  <Bar dataKey="produtividade_final" name="R$" fill="#166534" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="produtividade_final" position="top" formatter={(v: unknown) => formatarMoeda(Number(v ?? 0))} style={{ fontSize: 10 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>3. Totais por Colaborador</CardTitle>
            <CardDescription>Peso, Volume, Paletes (empilhado)</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            {porColaboradorArr.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                <BarChart data={porColaboradorArr.slice(0, 8).map(c => ({ ...c, nome: formatarNomeColaborador(c.nome) }))} margin={{ top: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nome" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="peso_liquido_total" stackId="a" name="Peso (kg)" fill="#166534">
                    <LabelList dataKey="peso_liquido_total" position="inside" formatter={(v: unknown) => Number(v ?? 0) > 1000 ? formatarNumero(Number(v ?? 0) / 1000, 1) + 't' : ''} style={{ fontSize: 9, fill: '#fff' }} />
                  </Bar>
                  <Bar dataKey="volume_total" stackId="a" name="Volume" fill="#16a34a">
                    <LabelList dataKey="volume_total" position="inside" formatter={(v: unknown) => Number(v ?? 0) > 50 ? formatarNumero(Number(v ?? 0), 0) : ''} style={{ fontSize: 9, fill: '#fff' }} />
                  </Bar>
                  <Bar dataKey="paletes_total" stackId="a" name="Paletes" fill="#22c55e">
                    <LabelList dataKey="paletes_total" position="inside" formatter={(v: unknown) => Number(v ?? 0) > 5 ? formatarNumero(Number(v ?? 0), 1) : ''} style={{ fontSize: 9, fill: '#fff' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>4. Performance por Filial (R$)</CardTitle>
            <CardDescription>Radar de produtividade por filial</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            {!isPeriodoMensalOuMaior ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Selecione período mensal ou maior para ver R$ por filial</div>
            ) : porFilialArrR$.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Sem dados no período</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                <RadarChart data={porFilialArrR$.map(f => ({ ...f, filial: f.nome, valor: f.produtividade_final }))}>
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="filial" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number | undefined) => (v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '')} />
                  <Radar name="Produtividade" dataKey="valor" stroke="#166534" fill="#16a34a" fillOpacity={0.6} dot={{ fill: '#166534', r: 4 }} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>5. Totais por Filial</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {porFilialArr.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                <BarChart data={porFilialArr}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nome" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="peso_liquido_total" name="Peso" fill="#166534" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="volume_total" name="Volume" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="paletes_total" name="Paletes" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>6. Top 5 Fornecedores por Peso</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {topFornecedoresData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                <AreaChart data={topFornecedoresData.map((r) => ({ ...r, nome: r.fornecedor.length > 20 ? r.fornecedor.slice(0, 20) + '…' : r.fornecedor }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nome" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number | undefined) => (v != null ? v.toLocaleString('pt-BR') : '')} />
                  <Area type="monotone" dataKey="total_peso" name="Peso (kg)" fill="#166534" stroke="#15803d" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>7. Descontos por Colaborador (R$)</CardTitle>
            <CardDescription>Total de descontos aplicados</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            {!isPeriodoMensalOuMaior ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Selecione período mensal ou maior para ver descontos</div>
            ) : descontosPorColaborador.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Nenhum desconto no período</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                <BarChart data={descontosPorColaborador.map(c => ({ ...c, nome: formatarNomeColaborador(c.nome) }))} layout="horizontal" margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nome" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number | undefined) => (v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '')} />
                  <Bar dataKey="valor_descontos" name="Descontos" fill="#dc2626" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="valor_descontos" position="top" formatter={(v: unknown) => formatarMoeda(Number(v ?? 0))} style={{ fontSize: 10 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>8. Descontos (R$) por Colaborador</CardTitle>
            <CardDescription>Valor de descontos aplicados por colaborador</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            {!isPeriodoMensalOuMaior ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Selecione período mensal ou maior</div>
            ) : pieDataDescontos.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Nenhum desconto no período</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                <PieChart>
                  <Pie
                    data={pieDataDescontos}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, value }) => `${name}: ${formatarMoeda(Number(value))}`}
                  >
                    {pieDataDescontos.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={pieDataDescontos[index].fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number | undefined) => (v != null ? formatarMoeda(Number(v)) : '')} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>9. Distribuição de Cargas por Colaborador</CardTitle>
              <CardDescription>Número de cargas separadas no mês selecionado</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="pie-mes" className="text-sm text-muted-foreground">Mês:</Label>
              <Input
                id="pie-mes"
                type="month"
                value={pieChartMesAno}
                onChange={(e) => setPieChartMesAno(e.target.value)}
                className="w-40"
              />
            </div>
          </CardHeader>
          <CardContent className="h-50">
            {cargasPorColaborador.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Sem dados no mês selecionado</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                <PieChart>
                  <Pie
                    data={cargasPorColaborador.map((c, i) => ({
                      name: formatarNomeColaborador(c.nome),
                      value: c.total,
                      fill: ['#166534', '#15803d', '#16a34a', '#22c55e', '#4ade80', '#86efac', '#bbf7d0', '#dcfce7', '#14532d', '#052e16'][i % 10]
                    }))}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, value, percent }) => `${name}: ${value} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                    labelLine={{ stroke: '#666', strokeWidth: 1 }}
                  >
                    {cargasPorColaborador.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={['#166534', '#15803d', '#16a34a', '#22c55e', '#4ade80', '#86efac', '#bbf7d0', '#dcfce7', '#14532d', '#052e16'][index % 10]}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number | undefined) => `${v ?? 0} cargas`} />
                  <Legend
                    verticalAlign="bottom"
                    height={8}
                    formatter={(value) => value}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabelas Top 3 – 4 seções, 2 tabelas lado a lado */}
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top 3 Nº de Cargas (Coletas) x Colaborador</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {top3Cargas.map((r, i) => (
                  <div key={r.id_colaborador ?? `${r.nome}-${i}`} className="flex justify-between items-center text-sm">
                    <span className="font-medium">#{i + 1} {r.nome}</span>
                    <span>{formatarNumero(r.total_cargas, 0)}</span>
                  </div>
                ))}
                {top3Cargas.length === 0 && <p className="text-muted-foreground text-sm">Sem dados</p>}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top 3 Nº de Notas x Colaborador</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {top3Pedidos.map((r, i) => (
                  <div key={r.id_colaborador ?? i} className="flex justify-between items-center text-sm">
                    <span className="font-medium">#{i + 1} {r.nome}</span>
                    <span>{formatarNumero(r.total_pedidos, 0)}</span>
                  </div>
                ))}
                {top3Pedidos.length === 0 && <p className="text-muted-foreground text-sm">Sem dados</p>}
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top 3 Produtividade (R$) x Colaborador</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {top3Prod.map((r, i) => (
                  <div key={r.nome} className="flex justify-between items-center text-sm">
                    <span className="font-medium">#{i + 1} {r.nome}</span>
                    <span className="text-green-600">{formatarMoeda(r.produtividade_final)}</span>
                  </div>
                ))}
                {top3Prod.length === 0 && <p className="text-muted-foreground text-sm">Sem dados</p>}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top 3 Tonelagem (KG) x Colaborador</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {top3Kg.map((r, i) => (
                  <div key={r.nome} className="flex justify-between items-center text-sm">
                    <span className="font-medium">#{i + 1} {r.nome}</span>
                    <span>{formatarNumero(r.peso_liquido_total, 0)} kg</span>
                  </div>
                ))}
                {top3Kg.length === 0 && <p className="text-muted-foreground text-sm">Sem dados</p>}
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top 3 Volumes x Colaborador</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {top3Vol.map((r, i) => (
                  <div key={r.nome} className="flex justify-between items-center text-sm">
                    <span className="font-medium">#{i + 1} {r.nome}</span>
                    <span>{formatarNumero(r.volume_total, 0)}</span>
                  </div>
                ))}
                {top3Vol.length === 0 && <p className="text-muted-foreground text-sm">Sem dados</p>}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top 3 Paletes x Colaborador</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {top3Plt.map((r, i) => (
                  <div key={r.nome} className="flex justify-between items-center text-sm">
                    <span className="font-medium">#{i + 1} {r.nome}</span>
                    <span>{formatarNumero(r.paletes_total, 1)}</span>
                  </div>
                ))}
                {top3Plt.length === 0 && <p className="text-muted-foreground text-sm">Sem dados</p>}
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top 3 Tempo Médio x Colaborador</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {top3TempoMedio.map((r, i) => (
                  <div key={r.id_colaborador} className="flex justify-between items-center text-sm">
                    <span className="font-medium">#{i + 1} {r.nome}</span>
                    <span>{formatarNumero(r.tempo_medio, 1)}h</span>
                  </div>
                ))}
                {top3TempoMedio.length === 0 && <p className="text-muted-foreground text-sm">Sem dados</p>}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-muted-foreground">Top 3 Descontos (R$) x Colaborador</CardTitle>
            </CardHeader>
            <CardContent>
              {top3Descontos.length === 0 ? (
                <p className="text-muted-foreground text-sm">Sem descontos no período</p>
              ) : (
                <div className="space-y-2">
                  {top3Descontos.map((r, i) => (
                    <div key={r.nome} className="flex justify-between items-center text-sm">
                      <span className="font-medium">#{i + 1} {formatarNomeColaborador(r.nome)}</span>
                      <span>{formatarMoeda(r.valor_descontos)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
