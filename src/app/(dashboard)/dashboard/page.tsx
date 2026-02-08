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
  getMesAnoPorPeriodo,
  type PeriodoOption,
} from '@/lib/dashboard-filters'
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
  LineChart,
  Line,
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

interface TopClienteRow {
  cliente: string
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
  const [filialSelecionada, setFilialSelecionada] = useState<string>('todas')
  const [periodoSelecionado, setPeriodoSelecionado] = useState<string>('mes_atual')
  const [busca, setBusca] = useState('')
  const [buscaDebounced, setBuscaDebounced] = useState('')
  const [dataCargaInicio, setDataCargaInicio] = useState<string>('')
  const [dataCargaFim, setDataCargaFim] = useState<string>('')
  const [colaboradorIds, setColaboradorIds] = useState<string[]>([])
  const [filtroCarga, setFiltroCarga] = useState('__TODOS__')
  const [filtroNotaFiscal, setFiltroNotaFiscal] = useState('__TODOS__')
  const [filtroCliente, setFiltroCliente] = useState('__TODOS__')
  const [filtroRede, setFiltroRede] = useState('__TODOS__')
  const [filtroCidadeCliente, setFiltroCidadeCliente] = useState('__TODOS__')
  const [filtroUf, setFiltroUf] = useState('__TODOS__')
  const [filtroProduto, setFiltroProduto] = useState('__TODOS__')
  const [filtroFamilia, setFiltroFamilia] = useState('__TODOS__')
  const [filtroTempoMin, setFiltroTempoMin] = useState<string>('')
  const [filtroTempoMax, setFiltroTempoMax] = useState<string>('')
  const [filtroResultadoMin, setFiltroResultadoMin] = useState<string>('')
  const [filtroResultadoMax, setFiltroResultadoMax] = useState<string>('')
  const [periodoEvolucao, setPeriodoEvolucao] = useState<PeriodoOption>('mes_atual')
  const [filiais, setFiliais] = useState<{ id: string; nome: string }[]>([])
  const [colaboradores, setColaboradores] = useState<{ id: string; nome: string }[]>([])
  const [showFilters, setShowFilters] = useState(true)
  const [opcoesCargas, setOpcoesCargas] = useState<string[]>([])
  const [opcoesNotasFiscais, setOpcoesNotasFiscais] = useState<string[]>([])
  const [opcoesClientes, setOpcoesClientes] = useState<string[]>([])
  const [opcoesRedes, setOpcoesRedes] = useState<string[]>([])
  const [opcoesCidades, setOpcoesCidades] = useState<string[]>([])
  const [opcoesUfs, setOpcoesUfs] = useState<string[]>([])
  const [opcoesProdutos, setOpcoesProdutos] = useState<string[]>([])
  const [opcoesFamilias, setOpcoesFamilias] = useState<string[]>([])
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
  const [evolucaoData, setEvolucaoData] = useState<EvolucaoRow[]>([])
  const [topClientesData, setTopClientesData] = useState<TopClienteRow[]>([])
  const [fechamentoList, setFechamentoList] = useState<FechamentoChartRow[]>([])
  const [resumoColaborador, setResumoColaborador] = useState<ResumoColaboradorRow[]>([])
  const [resumoFilial, setResumoFilial] = useState<ResumoFilialRow[]>([])
  const [evolucaoDataInterna, setEvolucaoDataInterna] = useState<EvolucaoRow[]>([])

  const carregarFiliais = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('filiais')
      .select('id, nome')
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
    
    const [cargas, nfs, clientes, redes, cidades, ufs, produtos, familias] = await Promise.all([
      supabase.from('dados_produtividade').select('carga').order('carga'),
      supabase.from('dados_produtividade').select('nota_fiscal').order('nota_fiscal'),
      supabase.from('dados_produtividade').select('cliente').order('cliente'),
      supabase.from('dados_produtividade').select('rede').order('rede'),
      supabase.from('dados_produtividade').select('cidade_cliente').order('cidade_cliente'),
      supabase.from('dados_produtividade').select('uf').order('uf'),
      supabase.from('dados_produtividade').select('produto').order('produto'),
      supabase.from('dados_produtividade').select('familia').order('familia'),
    ])

    if (cargas.data) {
      const uniqueCargas = Array.from(new Set(cargas.data.map(r => r.carga).filter(Boolean)))
      setOpcoesCargas(uniqueCargas)
    }
    if (nfs.data) {
      const uniqueNfs = Array.from(new Set(nfs.data.map(r => r.nota_fiscal).filter(Boolean)))
      setOpcoesNotasFiscais(uniqueNfs)
    }
    if (clientes.data) {
      const uniqueClientes = Array.from(new Set(clientes.data.map(r => r.cliente).filter(Boolean)))
      setOpcoesClientes(uniqueClientes)
    }
    if (redes.data) {
      const uniqueRedes = Array.from(new Set(redes.data.map(r => r.rede).filter(Boolean)))
      setOpcoesRedes(uniqueRedes)
    }
    if (cidades.data) {
      const uniqueCidades = Array.from(new Set(cidades.data.map(r => r.cidade_cliente).filter(Boolean)))
      setOpcoesCidades(uniqueCidades)
    }
    if (ufs.data) {
      const uniqueUfs = Array.from(new Set(ufs.data.map(r => r.uf).filter(Boolean)))
      setOpcoesUfs(uniqueUfs)
    }
    if (produtos.data) {
      const uniqueProdutos = Array.from(new Set(produtos.data.map(r => r.produto).filter(Boolean)))
      setOpcoesProdutos(uniqueProdutos)
    }
    if (familias.data) {
      const uniqueFamilias = Array.from(new Set(familias.data.map(r => r.familia).filter(Boolean)))
      setOpcoesFamilias(uniqueFamilias)
    }
  }, [])

  const idFilial = filialSelecionada === 'todas' ? null : filialSelecionada
  const datasPrincipal = useMemo(() => {
    if (dataCargaInicio && dataCargaFim) {
      return { data_inicio: new Date(dataCargaInicio), data_fim: new Date(dataCargaFim) }
    }
    return getDatasPorPeriodo(periodoSelecionado as PeriodoOption)
  }, [periodoSelecionado, dataCargaInicio, dataCargaFim])
  const datasEvolucao = useMemo(() => getDatasPorPeriodo(periodoEvolucao), [periodoEvolucao])

  const rpcParams = useMemo(() => {
    const p: Record<string, unknown> = {
      p_id_filial: idFilial,
      p_data_inicio: toISODate(datasPrincipal.data_inicio),
      p_data_fim: toISODate(datasPrincipal.data_fim),
      p_busca: buscaDebounced?.trim() || null,
      p_id_colaborador: colaboradorIds.length > 0 ? colaboradorIds : null,
      p_carga: (filtroCarga && filtroCarga !== '__TODOS__') ? filtroCarga.trim() : null,
      p_nota_fiscal: (filtroNotaFiscal && filtroNotaFiscal !== '__TODOS__') ? filtroNotaFiscal.trim() : null,
      p_cliente: (filtroCliente && filtroCliente !== '__TODOS__') ? filtroCliente.trim() : null,
      p_rede: (filtroRede && filtroRede !== '__TODOS__') ? filtroRede.trim() : null,
      p_cidade_cliente: (filtroCidadeCliente && filtroCidadeCliente !== '__TODOS__') ? filtroCidadeCliente.trim() : null,
      p_uf: (filtroUf && filtroUf !== '__TODOS__') ? filtroUf.trim() : null,
      p_produto: (filtroProduto && filtroProduto !== '__TODOS__') ? filtroProduto.trim() : null,
      p_familia: (filtroFamilia && filtroFamilia !== '__TODOS__') ? filtroFamilia.trim() : null,
      p_tempo_min: filtroTempoMin !== '' ? Number(filtroTempoMin) : null,
      p_tempo_max: filtroTempoMax !== '' ? Number(filtroTempoMax) : null,
    }
    return p
  }, [idFilial, datasPrincipal, buscaDebounced, colaboradorIds, filtroCarga, filtroNotaFiscal, filtroCliente, filtroRede, filtroCidadeCliente, filtroUf, filtroProduto, filtroFamilia, filtroTempoMin, filtroTempoMax])

  const carregarKPIs = useCallback(async () => {
    const supabase = createClient()
    setLoading(true)
    try {
      const { data: kpisDados, error: kpisError } = await supabase.rpc('get_dashboard_kpis', rpcParams)
      if (kpisError) {
        console.error('Erro ao carregar KPIs do dashboard:', kpisError)
        setLoading(false)
        return
      }
      const row = Array.isArray(kpisDados) && kpisDados.length > 0 ? kpisDados[0] : null
      const totalKg = row ? Number(row.total_kg ?? 0) : 0
      const totalVolume = row ? Number(row.total_volume ?? 0) : 0
      const totalPaletes = row ? Number(row.total_paletes ?? 0) : 0
      const totalCargas = row ? Number(row.total_cargas ?? 0) : 0
      const totalPedidos = row ? Number(row.total_pedidos ?? 0) : 0
      const somaTempo = row ? Number(row.soma_tempo ?? 0) : 0
      const tempoMedio = totalCargas > 0 ? somaTempo / totalCargas : 0

      const mesAnoList = getMesAnoPorPeriodo(periodoSelecionado as PeriodoOption)
      let queryFechamento = supabase
        .from('fechamento')
        .select(`
          id_colaborador,
          id_filial,
          produtividade_final,
          peso_liquido_total,
          volume_total,
          paletes_total,
          valor_descontos,
          percentual_atingimento,
          colaboradores (nome),
          filiais (nome)
        `)
      if (idFilial) queryFechamento = queryFechamento.eq('id_filial', idFilial)
      if (mesAnoList.length > 0) {
        const orClause = mesAnoList
          .map(({ mes, ano }) => `and(mes.eq."${mes}",ano.eq.${ano})`)
          .join(',')
        queryFechamento = queryFechamento.or(orClause)
      }
      const { data: fechamentos } = await queryFechamento
      
      console.log('Fechamentos retornados:', fechamentos?.length ?? 0, 'registros')
      console.log('Filtro de mês/ano:', mesAnoList)
      
      const totalProdutividade =
        fechamentos?.reduce((sum, f) => sum + (Number(f.produtividade_final) || 0), 0) ?? 0
      const somaPercentualAtingimento = 
        fechamentos?.reduce((sum, f) => sum + (Number(f.percentual_atingimento) || 0), 0) ?? 0
      const percentualAtingimento = (fechamentos?.length ?? 0) > 0 
        ? somaPercentualAtingimento / (fechamentos?.length ?? 1) 
        : 0
      
      console.log('Total Produtividade:', totalProdutividade)
      console.log('Percentual Atingimento:', percentualAtingimento)
      const chartList: FechamentoChartRow[] = (fechamentos ?? []).map((f: Record<string, unknown>) => ({
        id_colaborador: f.id_colaborador as string,
        id_filial: f.id_filial as string,
        colaborador_nome: (f.colaboradores as { nome?: string } | null)?.nome ?? '',
        filial_nome: (f.filiais as { nome?: string } | null)?.nome ?? '',
        produtividade_final: Number(f.produtividade_final ?? 0),
        peso_liquido_total: Number(f.peso_liquido_total ?? 0),
        volume_total: Number(f.volume_total ?? 0),
        paletes_total: Number(f.paletes_total ?? 0),
        valor_descontos: Number(f.valor_descontos ?? 0),
      }))
      setFechamentoList(chartList)

      const paramsEvolucao = {
        ...rpcParams,
        p_data_inicio: toISODate(datasEvolucao.data_inicio),
        p_data_fim: toISODate(datasEvolucao.data_fim),
      }
      const { data: evolucao } = await supabase.rpc('get_dashboard_evolucao', paramsEvolucao)
      setEvolucaoDataInterna(
        (evolucao ?? []).map((r: { data_carga: string; total_kg: number; total_volume: number; total_paletes: number }) => ({
          data_carga: r.data_carga,
          total_kg: Number(r.total_kg ?? 0),
          total_volume: Number(r.total_volume ?? 0),
          total_paletes: Number(r.total_paletes ?? 0),
        }))
      )

      const { data: topClientes } = await supabase.rpc('get_dashboard_top_clientes', {
        ...rpcParams,
        p_limit: 5,
      })
      setTopClientesData(
        (topClientes ?? []).map((r: { cliente: string; total_peso: number }) => ({
          cliente: r.cliente ?? '',
          total_peso: Number(r.total_peso ?? 0),
        }))
      )

      const { data: resumoCol } = await supabase.rpc('get_dashboard_resumo_colaborador', rpcParams)
      setResumoColaborador(
        (resumoCol ?? []).map((r: Record<string, unknown>) => ({
          id_colaborador: r.id_colaborador as string,
          nome: (r.nome as string) ?? '',
          total_cargas: Number(r.total_cargas ?? 0),
          total_pedidos: Number(r.total_pedidos ?? 0),
          peso_total: Number(r.peso_total ?? 0),
          volume_total: Number(r.volume_total ?? 0),
          paletes_total: Number(r.paletes_total ?? 0),
          tempo_total: Number(r.tempo_total ?? 0),
          tempo_medio: Number(r.tempo_medio ?? 0),
        }))
      )
      const { data: resumoFil } = await supabase.rpc('get_dashboard_resumo_filial', rpcParams)
      setResumoFilial(
        (resumoFil ?? []).map((r: Record<string, unknown>) => ({
          id_filial: r.id_filial as string,
          nome: (r.nome as string) ?? '',
          total_cargas: Number(r.total_cargas ?? 0),
          total_pedidos: Number(r.total_pedidos ?? 0),
          peso_total: Number(r.peso_total ?? 0),
          volume_total: Number(r.volume_total ?? 0),
          paletes_total: Number(r.paletes_total ?? 0),
          tempo_total: Number(r.tempo_total ?? 0),
        }))
      )

      setKpis({
        totalProdutividade,
        percentualAtingimento,
        totalCargas,
        totalPedidos,
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
  }, [rpcParams, datasEvolucao, periodoSelecionado, idFilial])

  useEffect(() => {
    carregarFiliais()
    carregarOpcoesFiltros()
  }, [carregarFiliais, carregarOpcoesFiltros])

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

  const isPeriodoMensalOuMaior = ['mes_atual', 'mes_anterior', 'trimestre_atual', 'trimestre_anterior', 'semestre_atual', 'semestre_anterior', 'ano_atual', 'ano_anterior'].includes(periodoSelecionado)
  const porColaboradorR$ = fechamentoList.reduce((acc, f) => {
    const nome = f.colaborador_nome || 'Sem nome'
    if (!acc[nome]) acc[nome] = { nome, produtividade_final: 0, peso_liquido_total: 0, volume_total: 0, paletes_total: 0, valor_descontos: 0 }
    acc[nome].produtividade_final += f.produtividade_final
    acc[nome].peso_liquido_total += f.peso_liquido_total
    acc[nome].volume_total += f.volume_total
    acc[nome].paletes_total += f.paletes_total
    acc[nome].valor_descontos += f.valor_descontos
    return acc
  }, {} as Record<string, { nome: string; produtividade_final: number; peso_liquido_total: number; volume_total: number; paletes_total: number; valor_descontos: number }>)
  const porColaboradorArrTotais = isPeriodoMensalOuMaior
    ? Object.values(porColaboradorR$).sort((a, b) => b.peso_liquido_total - a.peso_liquido_total)
    : resumoColaborador.map((r) => ({ nome: r.nome, produtividade_final: 0, peso_liquido_total: r.peso_total, volume_total: r.volume_total, paletes_total: r.paletes_total, valor_descontos: 0 })).sort((a, b) => b.peso_liquido_total - a.peso_liquido_total)
  const porColaboradorArrR$ = Object.values(porColaboradorR$).sort((a, b) => b.produtividade_final - a.produtividade_final).slice(0, 10)
  const porColaboradorArr = porColaboradorArrTotais.slice(0, 10)
  const descontosPorColaborador = Object.values(porColaboradorR$)
    .filter(c => c.valor_descontos > 0)
    .sort((a, b) => b.valor_descontos - a.valor_descontos)
    .slice(0, 10)
  const porFilialR$ = fechamentoList.reduce((acc, f) => {
    const nome = f.filial_nome || 'Sem filial'
    if (!acc[nome]) acc[nome] = { nome, produtividade_final: 0, peso_liquido_total: 0, volume_total: 0, paletes_total: 0 }
    acc[nome].produtividade_final += f.produtividade_final
    acc[nome].peso_liquido_total += f.peso_liquido_total
    acc[nome].volume_total += f.volume_total
    acc[nome].paletes_total += f.paletes_total
    return acc
  }, {} as Record<string, { nome: string; produtividade_final: number; peso_liquido_total: number; volume_total: number; paletes_total: number }>)
  const porFilialArrTotais = isPeriodoMensalOuMaior
    ? Object.values(porFilialR$).sort((a, b) => b.peso_liquido_total - a.peso_liquido_total)
    : resumoFilial.map((r) => ({ nome: r.nome, produtividade_final: 0, peso_liquido_total: r.peso_total, volume_total: r.volume_total, paletes_total: r.paletes_total })).sort((a, b) => b.peso_liquido_total - a.peso_liquido_total)
  const porFilialArrR$ = Object.values(porFilialR$).sort((a, b) => b.produtividade_final - a.produtividade_final)
  const porFilialArr = porFilialArrTotais
  const evolucaoFormatada = evolucaoDataInterna.map((r) => ({
    ...r,
    data_carga: format(new Date(r.data_carga + 'T12:00:00'), 'dd/MM', { locale: ptBR }),
  }))
  const pieData = porFilialArrR$.map((f, i) => ({ name: f.nome, value: f.produtividade_final, fill: ['#166534', '#15803d', '#16a34a', '#22c55e', '#4ade80'][i % 5] })).filter((d) => d.value > 0)
  const top3Prod = porColaboradorArrR$.slice(0, 3)
  const top3Kg = [...porColaboradorArrTotais].sort((a, b) => b.peso_liquido_total - a.peso_liquido_total).slice(0, 3)
  const top3Vol = [...porColaboradorArrTotais].sort((a, b) => b.volume_total - a.volume_total).slice(0, 3)
  const top3Plt = [...porColaboradorArrTotais].sort((a, b) => b.paletes_total - a.paletes_total).slice(0, 3)
  const top3Cargas = [...resumoColaborador].sort((a, b) => b.total_cargas - a.total_cargas).slice(0, 3)
  const top3Pedidos = [...resumoColaborador].sort((a, b) => b.total_pedidos - a.total_pedidos).slice(0, 3)
  const top3TempoMedio = [...resumoColaborador].sort((a, b) => b.tempo_medio - a.tempo_medio).slice(0, 3)

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
        </CardHeader>
        {showFilters && (
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="filial">Filial</Label>
              <Select value={filialSelecionada} onValueChange={setFilialSelecionada}>
                <SelectTrigger id="filial">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as Filiais</SelectItem>
                  {filiais.map(filial => (
                    <SelectItem key={filial.id} value={filial.id}>
                      {filial.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Label>Data de Carga (início)</Label>
              <Input
                type="date"
                value={dataCargaInicio}
                onChange={(e) => setDataCargaInicio(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Data de Carga (fim)</Label>
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
                placeholder="Buscar por colaborador, cliente, carga..."
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
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Carga</Label>
              <Select value={filtroCarga} onValueChange={setFiltroCarga}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as cargas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__TODOS__">Todas</SelectItem>
                  {opcoesCargas.map((carga) => (
                    <SelectItem key={carga} value={carga}>{carga}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nota Fiscal</Label>
              <Select value={filtroNotaFiscal} onValueChange={setFiltroNotaFiscal}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as NFs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__TODOS__">Todas</SelectItem>
                  {opcoesNotasFiscais.slice(0, 100).map((nf) => (
                    <SelectItem key={nf} value={nf}>{nf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={filtroCliente} onValueChange={setFiltroCliente}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os clientes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__TODOS__">Todos</SelectItem>
                  {opcoesClientes.slice(0, 100).map((cliente) => (
                    <SelectItem key={cliente} value={cliente}>{cliente}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Rede</Label>
              <Select value={filtroRede} onValueChange={setFiltroRede}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as redes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__TODOS__">Todas</SelectItem>
                  {opcoesRedes.map((rede) => (
                    <SelectItem key={rede} value={rede}>{rede}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cidade do Cliente</Label>
              <Select value={filtroCidadeCliente} onValueChange={setFiltroCidadeCliente}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as cidades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__TODOS__">Todas</SelectItem>
                  {opcoesCidades.slice(0, 100).map((cidade) => (
                    <SelectItem key={cidade} value={cidade}>{cidade}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>UF</Label>
              <Select value={filtroUf} onValueChange={setFiltroUf}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__TODOS__">Todos</SelectItem>
                  {opcoesUfs.map((uf) => (
                    <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Produto</Label>
              <Select value={filtroProduto} onValueChange={setFiltroProduto}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os produtos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__TODOS__">Todos</SelectItem>
                  {opcoesProdutos.slice(0, 100).map((produto) => (
                    <SelectItem key={produto} value={produto}>{produto}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Família</Label>
              <Select value={filtroFamilia} onValueChange={setFiltroFamilia}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as famílias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__TODOS__">Todas</SelectItem>
                  {opcoesFamilias.map((familia) => (
                    <SelectItem key={familia} value={familia}>{familia}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tempo mín. (h)</Label>
              <Input type="number" step="0.1" placeholder="0" value={filtroTempoMin} onChange={(e) => setFiltroTempoMin(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tempo máx. (h)</Label>
              <Input type="number" step="0.1" placeholder="—" value={filtroTempoMax} onChange={(e) => setFiltroTempoMax(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Resultado mín. (R$)</Label>
              <Input type="number" placeholder="—" value={filtroResultadoMin} onChange={(e) => setFiltroResultadoMin(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Resultado máx. (R$)</Label>
              <Input type="number" placeholder="—" value={filtroResultadoMax} onChange={(e) => setFiltroResultadoMax(e.target.value)} />
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
          description="Cargas separadas"
          icon={<Package className="h-4 w-4 text-purple-600" />}
        />
        <KPICard
          title="Total de Pedidos"
          value={formatarNumero(kpis.totalPedidos)}
          description="Notas fiscais"
          icon={<FileText className="h-4 w-4 text-orange-600" />}
        />
      </div>

      {/* KPI Cards - Linha 2 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Separado em KG"
          value={formatarNumero(kpis.totalKg / 1000, 2)}
          description={`${formatarNumero(kpis.totalKg)} kg`}
          icon={<Weight className="h-4 w-4 text-gray-600" />}
        />
        <KPICard
          title="Total Separado em Volume"
          value={formatarNumero(kpis.totalVolume)}
          description="Quantidade total"
          icon={<Box className="h-4 w-4 text-cyan-600" />}
        />
        <KPICard
          title="Total em Paletes"
          value={formatarNumero(kpis.totalPaletes, 1)}
          description="Peso líquido / 550"
          icon={<Boxes className="h-4 w-4 text-indigo-600" />}
        />
        <KPICard
          title="Tempo Médio Separação"
          value={`${formatarNumero(kpis.tempoMedio, 1)}h`}
          description="Por carga"
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
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={evolucaoFormatada}>
                <defs>
                  <linearGradient id="colorKg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#166534" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#166534" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="colorPaletes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0.1}/>
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
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porColaboradorArrR$.map(c => ({ ...c, nome: formatarNomeColaborador(c.nome) }))} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nome" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number | undefined) => (v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '')} />
                  <Bar dataKey="produtividade_final" name="R$" fill="#166534" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="produtividade_final" position="top" formatter={(v: any) => formatarMoeda(Number(v))} style={{ fontSize: 10 }} />
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
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porColaboradorArr.slice(0, 8).map(c => ({ ...c, nome: formatarNomeColaborador(c.nome) }))} margin={{ top: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nome" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="peso_liquido_total" stackId="a" name="Peso (kg)" fill="#166534">
                    <LabelList dataKey="peso_liquido_total" position="inside" formatter={(v: any) => Number(v) > 1000 ? formatarNumero(Number(v) / 1000, 1) + 't' : ''} style={{ fontSize: 9, fill: '#fff' }} />
                  </Bar>
                  <Bar dataKey="volume_total" stackId="a" name="Volume" fill="#16a34a">
                    <LabelList dataKey="volume_total" position="inside" formatter={(v: any) => Number(v) > 50 ? formatarNumero(Number(v), 0) : ''} style={{ fontSize: 9, fill: '#fff' }} />
                  </Bar>
                  <Bar dataKey="paletes_total" stackId="a" name="Paletes" fill="#22c55e">
                    <LabelList dataKey="paletes_total" position="inside" formatter={(v: any) => Number(v) > 5 ? formatarNumero(Number(v), 1) : ''} style={{ fontSize: 9, fill: '#fff' }} />
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
              <ResponsiveContainer width="100%" height="100%">
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
              <ResponsiveContainer width="100%" height="100%">
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
            <CardTitle>6. Top 5 Clientes por Peso</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {topClientesData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={topClientesData.map((r) => ({ ...r, nome: r.cliente.length > 20 ? r.cliente.slice(0, 20) + '…' : r.cliente }))}>
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
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={descontosPorColaborador.map(c => ({ ...c, nome: formatarNomeColaborador(c.nome) }))} layout="horizontal" margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nome" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number | undefined) => (v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '')} />
                  <Bar dataKey="valor_descontos" name="Descontos" fill="#dc2626" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="valor_descontos" position="top" formatter={(v: any) => formatarMoeda(Number(v))} style={{ fontSize: 10 }} />
                  </Bar>
                </BarChart>
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
              <CardTitle className="text-base">Top 3 Nº de Cargas Separadas x Colaborador</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {top3Cargas.map((r, i) => (
                  <div key={r.id_colaborador} className="flex justify-between items-center text-sm">
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
              <CardTitle className="text-base">Top 3 Nº de Pedidos Separados x Colaborador</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {top3Pedidos.map((r, i) => (
                  <div key={r.id_colaborador} className="flex justify-between items-center text-sm">
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
              <CardTitle className="text-base text-muted-foreground">Reservado</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">Reservado para futura métrica</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
