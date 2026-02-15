'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Calculator, RefreshCw, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
import { FilterToggle } from '@/components/FilterToggle'
import { toast } from 'sonner'
import {
  obterCorProdutividade,
  calcularValorAcuracidade,
  calcularValorChecklist,
  calcularValorPltHsPorFilial,
  calcularValorPerda,
  calcularBonusBrutoDockProd,
  intervalToHours,
  contarPaletes,
} from '@/lib/calculos'
import { getDatasPorMesAno, toISODate } from '@/lib/dashboard-filters'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { registrarLog } from '@/lib/logs'
import type { Fechamento, Resultado as ResultadoType } from '@/types/database'

const META_BONUS = 250
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** Normaliza nome para match (trim, lowercase, remove acentos) */
function normalizeNome(s: string): string {
  return (s ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

interface FechamentoRow extends Fechamento {
  colaborador_nome?: string
  colaborador_matricula?: string
  colaborador_funcao?: string
  filial_nome?: string
  filial_codigo?: string
  colaboradores?: { nome?: string; matricula?: string; funcao?: string; filiais?: { codigo: string; nome: string } }
}

interface ResultadoRow extends ResultadoType {
  colaborador_nome?: string
  colaborador_matricula?: string
}

export default function ResultadoPage() {
  const [fechamentos, setFechamentos] = useState<FechamentoRow[]>([])
  const [resultados, setResultados] = useState<ResultadoRow[]>([])
  const [fechamentosFiltrados, setFechamentosFiltrados] = useState<FechamentoRow[]>([])
  const [resultadosFiltrados, setResultadosFiltrados] = useState<ResultadoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [calculando, setCalculando] = useState(false)
  const [mesSelecionado, setMesSelecionado] = useState('')
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear())
  const [paginaFechamento, setPaginaFechamento] = useState(1)
  const [paginaResultado, setPaginaResultado] = useState(1)
  const [filtroFilial, setFiltroFilial] = useState('todas')
  const [filtroColaborador, setFiltroColaborador] = useState('todos')
  const [filtroBusca, setFiltroBusca] = useState('')
  const [buscaDebounced, setBuscaDebounced] = useState('')
  const [colaboradores, setColaboradores] = useState<{ id: string; nome: string; matricula: string; id_filial: string | null; funcao: string | null; filiais?: { codigo: string; nome: string } }[]>([])
  const [filiais, setFiliais] = useState<{ id: string; nome: string; codigo: string }[]>([])
  const [usuarioLogado, setUsuarioLogado] = useState<{ tipo: string; id_filial: string | null } | null>(null)
  const [modalFechamentoAberto, setModalFechamentoAberto] = useState(false)
  const [acuracidadeModal, setAcuracidadeModal] = useState('')
  const [checklistModal, setChecklistModal] = useState('')
  const [perdaModal, setPerdaModal] = useState('')

  const supabase = createClient()
  const registrosPorPagina = 50
  const fechamentoPaginado = fechamentosFiltrados.slice((paginaFechamento - 1) * registrosPorPagina, paginaFechamento * registrosPorPagina)
  const resultadoPaginado = resultadosFiltrados.slice((paginaResultado - 1) * registrosPorPagina, paginaResultado * registrosPorPagina)
  const totalPaginasFechamento = Math.ceil(fechamentosFiltrados.length / registrosPorPagina)
  const totalPaginasResultado = Math.ceil(resultadosFiltrados.length / registrosPorPagina)

  useEffect(() => {
    setMesSelecionado(MESES[new Date().getMonth()])
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(filtroBusca), 300)
    return () => clearTimeout(t)
  }, [filtroBusca])

  const carregarUsuarioLogado = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: u } = await supabase.from('usuarios').select('tipo, id_filial').eq('id', user.id).single()
      if (u) {
        setUsuarioLogado(u)
        if (u.tipo === 'colaborador' && u.id_filial) setFiltroFilial(u.id_filial)
      }
    }
  }, [supabase])

  const carregarFechamentos = useCallback(async () => {
    if (!mesSelecionado) return
    setLoading(true)
    try {
      const { data } = await supabase
        .from('fechamento')
        .select(`
          *,
          colaboradores (nome, matricula, funcao, filiais (codigo, nome))
        `)
        .eq('mes', mesSelecionado)
        .eq('ano', anoSelecionado)
        .order('created_at', { ascending: false })
      const rows: FechamentoRow[] = (data ?? []).map((f: Record<string, unknown>) => ({
        ...f,
        colaborador_nome: (f.colaboradores as { nome?: string })?.nome,
        colaborador_matricula: (f.colaboradores as { matricula?: string })?.matricula,
        colaborador_funcao: (f.colaboradores as { funcao?: string })?.funcao,
        filial_nome: (f.colaboradores as { filiais?: { nome: string } })?.filiais?.nome ?? (f.colaboradores as { filiais?: { nome: string }[] })?.filiais?.[0]?.nome,
        filial_codigo: (f.colaboradores as { filiais?: { codigo: string } })?.filiais?.codigo ?? (f.colaboradores as { filiais?: { codigo: string }[] })?.filiais?.[0]?.codigo,
      })) as FechamentoRow[]
      setFechamentos(rows)
    } catch (e) {
      console.error('Erro ao carregar fechamentos:', e)
      setFechamentos([])
    } finally {
      setLoading(false)
    }
  }, [supabase, mesSelecionado, anoSelecionado])

  const carregarResultados = useCallback(async () => {
    if (!mesSelecionado) return
    try {
      const { data } = await supabase
        .from('resultados')
        .select(`
          *,
          colaboradores (nome, matricula)
        `)
        .eq('mes', mesSelecionado)
        .order('bonus_final', { ascending: false })
      const rows: ResultadoRow[] = (data ?? []).map((r: Record<string, unknown>) => ({
        ...r,
        colaborador_nome: (r.colaboradores as { nome?: string })?.nome,
        colaborador_matricula: (r.colaboradores as { matricula?: string })?.matricula,
      })) as ResultadoRow[]
      setResultados(rows)
    } catch (e) {
      console.error('Erro ao carregar resultados:', e)
      setResultados([])
    }
  }, [supabase, mesSelecionado, anoSelecionado])

  type ColaboradorComFilial = { id: string; nome: string; matricula: string; id_filial: string | null; funcao: string | null; filiais?: { codigo: string; nome: string } }
  const carregarColaboradores = useCallback(async () => {
    const { data } = await supabase.from('colaboradores').select('id, nome, matricula, id_filial, funcao, filiais(codigo, nome)').eq('ativo', true).order('nome')
    const raw = (data ?? []) as Array<{ id: string; nome: string; matricula: string; id_filial: string | null; funcao: string | null; filiais?: { codigo: string; nome: string } | { codigo: string; nome: string }[] }>
    const normalized: ColaboradorComFilial[] = raw.map((c) => ({
      ...c,
      filiais: Array.isArray(c.filiais) ? c.filiais[0] : c.filiais,
    }))
    setColaboradores(normalized)
  }, [supabase])

  const carregarFiliais = useCallback(async () => {
    const { data } = await supabase.from('filiais').select('id, nome, codigo').eq('ativo', true)
    setFiliais((data ?? []) as { id: string; nome: string; codigo: string }[])
  }, [supabase])

  useEffect(() => {
    carregarUsuarioLogado()
  }, [carregarUsuarioLogado])

  useEffect(() => {
    if (mesSelecionado) {
      carregarFechamentos()
      carregarResultados()
      carregarColaboradores()
      carregarFiliais()
    }
  }, [mesSelecionado, anoSelecionado, carregarFechamentos, carregarResultados, carregarColaboradores, carregarFiliais])

  const aplicarFiltros = useCallback(() => {
    let fFech = [...fechamentos]
    let fRes = [...resultados]
    if (filtroFilial !== 'todas') {
      fFech = fFech.filter((f) => f.id_filial === filtroFilial)
      fRes = fRes.filter((r) => r.id_filial === filtroFilial)
    }
    if (filtroColaborador !== 'todos') {
      fFech = fFech.filter((f) => f.id_colaborador === filtroColaborador)
      fRes = fRes.filter((r) => r.id_colaborador === filtroColaborador)
    }
    if (buscaDebounced) {
      const b = buscaDebounced.toLowerCase()
      fFech = fFech.filter((f) => f.colaborador_nome?.toLowerCase().includes(b) || f.filial_nome?.toLowerCase().includes(b))
      fRes = fRes.filter((r) => r.colaborador_nome?.toLowerCase().includes(b) || r.filial?.toLowerCase().includes(b))
    }
    setFechamentosFiltrados(fFech)
    setResultadosFiltrados(fRes)
    setPaginaFechamento(1)
    setPaginaResultado(1)
  }, [fechamentos, resultados, filtroFilial, filtroColaborador, buscaDebounced])

  useEffect(() => {
    aplicarFiltros()
  }, [aplicarFiltros])

  const calcularFechamento = async (
    acuracidadeModalVal?: number | null,
    checklistModalVal?: number | null,
    perdaModalVal?: number | null
  ) => {
    if (!mesSelecionado) return
    setCalculando(true)
    try {
      // ── 1. Buscar dados brutos ──────────────────────────────────────────
      const { dataInicio, dataFim } = getDatasPorMesAno(mesSelecionado, anoSelecionado)
      const dataInicioISO = toISODate(dataInicio)
      const dataFimISO = toISODate(dataFim)

      const recebimentos = await fetchAllRows(() =>
        supabase.from('recebimentos').select('*').gte('dta_receb', dataInicioISO).lte('dta_receb', dataFimISO)
      )
      const tempoList = await fetchAllRows(() => supabase.from('tempo').select('*'))
      const { data: colaboradoresList } = await supabase.from('colaboradores').select('*, filiais(codigo, nome)').eq('ativo', true)
      const { data: filiaisList } = await supabase.from('filiais').select('id, codigo, nome')

      // ── 2. Mapear tempo por id_coleta_recebimento ───────────────────────
      const tempoPorIdColeta = new Map<string, { tempo_recebimento: string | null }>()
      tempoList.forEach((t: { id_coleta_recebimento: string | null; tempo_recebimento: string | null }) => {
        if (t.id_coleta_recebimento) tempoPorIdColeta.set(t.id_coleta_recebimento, { tempo_recebimento: t.tempo_recebimento })
      })

      // ── 3. Agrupar recebimentos por coleta (mesma lógica da Produtividade) ──
      type RecebColeta = { id_filial: string | null; qtd_caixas: number[]; peso: number; volume: number }
      const recebPorColeta = new Map<string, RecebColeta>()
      recebimentos.forEach((r: { id: string; id_filial: string | null; filial: string | null; id_coleta_recebimento: string | null; usuario_recebto: string | null; qtd_caixas_recebidas: number | null; peso_liquido_recebido: number | null }) => {
        const key = r.id_coleta_recebimento || r.id
        if (!recebPorColeta.has(key)) {
          recebPorColeta.set(key, { id_filial: r.id_filial, qtd_caixas: [], peso: 0, volume: 0 })
        }
        const g = recebPorColeta.get(key)!
        g.qtd_caixas.push(Number(r.qtd_caixas_recebidas ?? 0))
        g.peso += Number(r.peso_liquido_recebido ?? 0)
        g.volume += Number(r.qtd_caixas_recebidas ?? 0)
      })

      // ── 4. Agregar totais por FILIAL ────────────────────────────────────
      console.log('Recebimentos encontrados:', recebimentos.length)
      const gruposPorFilial = new Map<string, { peso: number; volume: number; paletes: number; tempoHoras: number }>()
      recebPorColeta.forEach((g, idColeta) => {
        const tempo = tempoPorIdColeta.get(idColeta)
        const th = tempo?.tempo_recebimento != null ? intervalToHours(tempo.tempo_recebimento) : 0
        const paletes = contarPaletes(g.qtd_caixas)
        const idFilial = g.id_filial ?? ''
        if (!idFilial) return
        if (!gruposPorFilial.has(idFilial)) gruposPorFilial.set(idFilial, { peso: 0, volume: 0, paletes: 0, tempoHoras: 0 })
        const gr = gruposPorFilial.get(idFilial)!
        gr.peso += g.peso
        gr.volume += g.volume
        gr.paletes += paletes
        gr.tempoHoras += th ?? 0
      })
      console.log('Grupos por filial:', gruposPorFilial.size)

      // ── 5. Upsert na tabela totalizadores (1 registro por filial) ──────
      for (const [idFilial, gr] of gruposPorFilial.entries()) {
        const kgHs = gr.tempoHoras > 0 ? gr.peso / gr.tempoHoras : null
        const volHs = gr.tempoHoras > 0 ? gr.volume / gr.tempoHoras : null
        const pltHs = gr.tempoHoras > 0 ? gr.paletes / gr.tempoHoras : null

        const { data: totExistente } = await supabase
          .from('totalizadores')
          .select('id')
          .eq('id_filial', idFilial)
          .eq('mes', mesSelecionado)
          .eq('ano', anoSelecionado)
          .single()

        const totPayload = {
          id_filial: idFilial,
          mes: mesSelecionado,
          ano: anoSelecionado,
          peso_liquido_total: gr.peso,
          qtd_caixas_total: gr.volume,
          paletes_total: gr.paletes,
          tempo_total: gr.tempoHoras,
          kg_hs: kgHs,
          vol_hs: volHs,
          plt_hs: pltHs,
          updated_at: new Date().toISOString(),
        }
        if (totExistente) {
          await supabase.from('totalizadores').update(totPayload).eq('id', totExistente.id)
        } else {
          await supabase.from('totalizadores').insert(totPayload)
        }
      }

      // ── 6. Ler totalizadores de volta (fonte de verdade) ────────────────
      const { data: totalizadoresList } = await supabase
        .from('totalizadores')
        .select('*')
        .eq('mes', mesSelecionado)
        .eq('ano', anoSelecionado)

      const totPorFilial = new Map<string, { peso: number; volume: number; paletes: number; tempoHoras: number; kgHs: number | null; volHs: number | null; pltHs: number | null }>()

      // Popular com o que está em memória primeiro (fallback)
      gruposPorFilial.forEach((gr, idFilial) => {
        const kgHs = gr.tempoHoras > 0 ? gr.peso / gr.tempoHoras : null
        const volHs = gr.tempoHoras > 0 ? gr.volume / gr.tempoHoras : null
        const pltHs = gr.tempoHoras > 0 ? gr.paletes / gr.tempoHoras : null
        totPorFilial.set(idFilial, {
          peso: gr.peso, volume: gr.volume, paletes: gr.paletes, tempoHoras: gr.tempoHoras,
          kgHs, volHs, pltHs
        })
      })

        // Sobrescrever com o que veio do banco (se houver)
        ; (totalizadoresList ?? []).forEach((t: { id_filial: string; peso_liquido_total: number; qtd_caixas_total: number; paletes_total: number; tempo_total: number; kg_hs: number | null; vol_hs: number | null; plt_hs: number | null }) => {
          totPorFilial.set(t.id_filial, {
            peso: Number(t.peso_liquido_total ?? 0),
            volume: Number(t.qtd_caixas_total ?? 0),
            paletes: Number(t.paletes_total ?? 0),
            tempoHoras: Number(t.tempo_total ?? 0),
            kgHs: t.kg_hs != null ? Number(t.kg_hs) : null,
            volHs: t.vol_hs != null ? Number(t.vol_hs) : null,
            pltHs: t.plt_hs != null ? Number(t.plt_hs) : null,
          })
        })
      console.log('Totais mapeados:', totPorFilial.size)

      // ── 7. Criar/atualizar fechamento por colaborador ───────────────────
      const fromModal =
        acuracidadeModalVal !== undefined &&
        checklistModalVal !== undefined &&
        perdaModalVal !== undefined

      for (const col of colaboradoresList ?? []) {
        const idFilial = col.id_filial ?? ''
        const tot = totPorFilial.get(idFilial)

        const { data: existente } = await supabase
          .from('fechamento')
          .select('id')
          .eq('id_colaborador', col.id)
          .eq('mes', mesSelecionado)
          .eq('ano', anoSelecionado)
          .single()

        const payloadTotais = {
          id_colaborador: col.id,
          id_filial: idFilial || null,
          mes: mesSelecionado,
          ano: anoSelecionado,
          peso_liquido_total: tot?.peso ?? 0,
          volume_total: tot?.volume ?? 0,
          paletes_total: tot?.paletes ?? 0,
          tempo_total: tot?.tempoHoras ?? 0,
          kg_hs: tot?.kgHs ?? null,
          vol_hs: tot?.volHs ?? null,
          plt_hs: tot?.pltHs ?? null,
          ...(fromModal
            ? {
              acuracidade: acuracidadeModalVal ?? null,
              checklist: checklistModalVal ?? null,
              perda: perdaModalVal ?? null,
            }
            : {}),
        }
        if (existente) {
          await supabase.from('fechamento').update(payloadTotais).eq('id', existente.id)
        } else {
          await supabase.from('fechamento').insert({
            ...payloadTotais,
            acuracidade: fromModal ? (acuracidadeModalVal ?? null) : null,
            checklist: fromModal ? (checklistModalVal ?? null) : null,
            perda: fromModal ? (perdaModalVal ?? null) : null,
          })
        }
      }

      // ── 8. Descontos ────────────────────────────────────────────────────
      const { data: descontosList } = await supabase
        .from('descontos')
        .select('*')
        .not('mes_desconto', 'is', null)
      const descontosPorColaborador = new Map<string, { percentual_total: number }>()
        ; (descontosList ?? []).forEach((d: { id_colaborador: string; mes_desconto: string; percentual_total: number | null }) => {
          const mesStr = d.mes_desconto ? String(d.mes_desconto).slice(0, 7) : ''
          const anoMes = `${anoSelecionado}-${String(MESES.indexOf(mesSelecionado) + 1).padStart(2, '0')}`
          if (mesStr === anoMes || (d.mes_desconto && String(d.mes_desconto).startsWith(anoMes))) {
            descontosPorColaborador.set(d.id_colaborador, { percentual_total: Number(d.percentual_total ?? 0) })
          }
        })

      // ── 9. Calcular resultados ──────────────────────────────────────────
      await carregarFechamentos()
      const fechamentosAtualizados = await supabase.from('fechamento').select('*, colaboradores(nome, matricula, funcao, filiais(codigo, nome))').eq('mes', mesSelecionado).eq('ano', anoSelecionado)
      const fechList = fechamentosAtualizados.data ?? []

      const filialCodigo = new Map<string, string>()
        ; (filiaisList ?? []).forEach((f: { id: string; codigo: string }) => { filialCodigo.set(f.id, f.codigo) })

      for (const f of fechList) {
        const col = f.colaboradores as { nome?: string; matricula?: string; funcao?: string; filiais?: { codigo: string; nome: string } }
        const setor = (col?.funcao ?? '').toLowerCase().includes('estoque') ? 'estoque' : 'recebimento'
        const codigo = (col?.filiais as { codigo?: string })?.codigo ?? (Array.isArray(col?.filiais) ? (col.filiais as { codigo?: string }[])[0]?.codigo : '')
        const pltHsFilial = Number(f.plt_hs ?? 0)
        const acuracidade = Number(f.acuracidade ?? 0)
        const checklist = Number(f.checklist ?? 0)
        const perda = Number(f.perda ?? 0)
        const valorAcu = calcularValorAcuracidade(acuracidade)
        const valorChk = calcularValorChecklist(checklist)
        const valorPlt = calcularValorPltHsPorFilial(pltHsFilial, codigo ?? '', setor)
        const valorPerd = setor === 'estoque' ? calcularValorPerda(perda) : 0
        const bonusBruto = calcularBonusBrutoDockProd(valorAcu, valorChk, valorPlt, valorPerd, setor)
        const desconto = descontosPorColaborador.get(f.id_colaborador)
        const pctDesconto = Number(desconto?.percentual_total ?? 0)
        const valorDesconto = bonusBruto * (pctDesconto / 100)
        const bonusFinal = Math.max(0, bonusBruto - valorDesconto)

        const resPayload = {
          id_colaborador: f.id_colaborador,
          id_filial: f.id_filial,
          filial: (col?.filiais as { nome?: string })?.nome ?? (Array.isArray(col?.filiais) ? (col.filiais as { nome?: string }[])[0]?.nome : ''),
          mes: mesSelecionado,
          funcao: col?.funcao ?? null,
          acuracidade,
          checklist,
          plt_hs: pltHsFilial,
          perda,
          bonus: bonusBruto,
          falta_inj: 0,
          advert: 0,
          suspensao_ferias: 0,
          atestado: 0,
          desconto: valorDesconto,
          filtro: valorDesconto,
          bonus_final: bonusFinal,
        }
        const { data: resExistente } = await supabase.from('resultados').select('id').eq('id_colaborador', f.id_colaborador).eq('mes', mesSelecionado).single()
        if (resExistente) {
          await supabase.from('resultados').update(resPayload).eq('id', resExistente.id)
        } else {
          await supabase.from('resultados').insert(resPayload)
        }
      }

      registrarLog(supabase, 'Calculou fechamento e resultados (DockProd)')
      toast.success('Fechamento e resultados calculados.')
      carregarFechamentos()
      carregarResultados()
    } catch (e) {
      console.error('Erro ao calcular fechamento:', e)
      toast.error('Erro ao calcular. Tente novamente.')
    } finally {
      setCalculando(false)
    }
  }

  const formatarMoeda = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
  const formatarNum = (v: number, dec = 2) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v)

  const limparFiltros = () => {
    setFiltroFilial(usuarioLogado?.tipo === 'colaborador' ? usuarioLogado.id_filial ?? 'todas' : 'todas')
    setFiltroColaborador('todos')
    setFiltroBusca('')
    setPaginaFechamento(1)
    setPaginaResultado(1)
  }
  const contarFiltrosAtivos = () => {
    let c = 0
    if (filtroFilial !== 'todas') c++
    if (filtroColaborador !== 'todos') c++
    if (filtroBusca) c++
    return c
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Resultado e Fechamento</h1>
          <p className="text-muted-foreground">Visualize e calcule o fechamento mensal (DockProd – por filial, plt/hs)</p>
        </div>
        <Button
          onClick={() => setModalFechamentoAberto(true)}
          disabled={calculando}
          className="bg-green-600 hover:bg-green-700"
        >
          {calculando ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Calculator className="w-4 h-4 mr-2" />}
          {calculando ? 'Calculando...' : 'Calcular Fechamento'}
        </Button>
      </div>

      <Dialog open={modalFechamentoAberto} onOpenChange={setModalFechamentoAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Acuracidade, Checklist e Perda</DialogTitle>
            <DialogDescription>
              Preencha os valores que serão aplicados a todos os colaboradores no fechamento de {mesSelecionado}/{anoSelecionado}. Em seguida o sistema calculará o fechamento e o resultado da produtividade.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="modal-acuracidade">Acuracidade (%)</Label>
              <Input
                id="modal-acuracidade"
                type="number"
                step={0.01}
                min={0}
                max={100}
                placeholder="Ex.: 95"
                value={acuracidadeModal}
                onChange={(e) => setAcuracidadeModal(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="modal-checklist">Checklist (%)</Label>
              <Input
                id="modal-checklist"
                type="number"
                step={0.01}
                min={0}
                max={100}
                placeholder="Ex.: 90"
                value={checklistModal}
                onChange={(e) => setChecklistModal(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="modal-perda">Perda (%)</Label>
              <Input
                id="modal-perda"
                type="number"
                step={0.01}
                min={0}
                placeholder="Ex.: 1,5"
                value={perdaModal}
                onChange={(e) => setPerdaModal(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setModalFechamentoAberto(false)}
            >
              Cancelar
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={async () => {
                const acu = acuracidadeModal.trim() === '' ? null : Number(acuracidadeModal)
                const chk = checklistModal.trim() === '' ? null : Number(checklistModal)
                const perd = perdaModal.trim() === '' ? null : Number(perdaModal)
                if ((acu !== null && (Number.isNaN(acu) || acu < 0 || acu > 100)) ||
                  (chk !== null && (Number.isNaN(chk) || chk < 0 || chk > 100)) ||
                  (perd !== null && (Number.isNaN(perd) || perd < 0))) {
                  toast.error('Valores inválidos. Acuracidade e Checklist entre 0 e 100; Perda >= 0.')
                  return
                }
                setModalFechamentoAberto(false)
                await calcularFechamento(acu ?? undefined, chk ?? undefined, perd ?? undefined)
              }}
            >
              Salvar e Calcular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FilterToggle filtrosAtivos={contarFiltrosAtivos()} onLimparFiltros={limparFiltros}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Mês</Label>
            <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MESES.map((m) => (
                  <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Ano</Label>
            <Select value={String(anoSelecionado)} onValueChange={(v) => setAnoSelecionado(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026].map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Filial</Label>
            <Select value={filtroFilial} onValueChange={setFiltroFilial} disabled={usuarioLogado?.tipo === 'colaborador'}>
              <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                {(usuarioLogado?.tipo === 'admin' || usuarioLogado?.tipo === 'gestor') && <SelectItem value="todas">Todas</SelectItem>}
                {filiais.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Colaborador</Label>
            <Select value={filtroColaborador} onValueChange={setFiltroColaborador}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {colaboradores.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Busca</Label>
            <Input placeholder="Buscar colaborador, filial..." value={filtroBusca} onChange={(e) => setFiltroBusca(e.target.value)} />
          </div>
        </div>
      </FilterToggle>

      <Card>
        <CardHeader>
          <CardTitle>Dados de Fechamento</CardTitle>
          <CardDescription>Totalizadores por colaborador para {mesSelecionado}/{anoSelecionado}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-auto max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mes/Ano</TableHead>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Filial</TableHead>
                  <TableHead className="text-right">Peso Líq.</TableHead>
                  <TableHead className="text-right">Qtd Caixas</TableHead>
                  <TableHead className="text-right">Paletes</TableHead>
                  <TableHead className="text-right">Tempo (h)</TableHead>
                  <TableHead className="text-right">Kg/Hs</TableHead>
                  <TableHead className="text-right">Vol/Hs</TableHead>
                  <TableHead className="text-right">Plt/Hs</TableHead>
                  <TableHead className="text-right">Acuracidade</TableHead>
                  <TableHead className="text-right">Checklist</TableHead>
                  <TableHead className="text-right">Perda</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={15} className="text-center py-8">Carregando...</TableCell></TableRow>
                ) : fechamentoPaginado.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={15} className="text-center py-8 text-muted-foreground">
                      <AlertTriangle className="w-8 h-8 mx-auto text-amber-500 mb-2" />
                      Nenhum fechamento para este período. Clique em &quot;Calcular Fechamento&quot;.
                    </TableCell>
                  </TableRow>
                ) : (
                  fechamentoPaginado.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="text-xs whitespace-nowrap">{mesSelecionado}/{anoSelecionado}</TableCell>
                      <TableCell className="font-medium">{f.colaborador_nome}</TableCell>
                      <TableCell>{f.colaborador_matricula}</TableCell>
                      <TableCell className="text-xs">{f.colaborador_funcao ?? '—'}</TableCell>
                      <TableCell className="text-xs">{f.filial_nome}</TableCell>
                      <TableCell className="text-right">{formatarNum(Number(f.peso_liquido_total ?? 0))}</TableCell>
                      <TableCell className="text-right">{formatarNum(Number(f.volume_total ?? 0), 0)}</TableCell>
                      <TableCell className="text-right">{formatarNum(Number(f.paletes_total ?? 0))}</TableCell>
                      <TableCell className="text-right">{formatarNum(Number(f.tempo_total ?? 0))}</TableCell>
                      <TableCell className="text-right">{f.kg_hs != null ? formatarNum(Number(f.kg_hs)) : '—'}</TableCell>
                      <TableCell className="text-right">{f.vol_hs != null ? formatarNum(Number(f.vol_hs)) : '—'}</TableCell>
                      <TableCell className="text-right">{f.plt_hs != null ? formatarNum(Number(f.plt_hs)) : '—'}</TableCell>
                      <TableCell className="text-right">{f.acuracidade != null ? formatarNum(Number(f.acuracidade)) : '—'}</TableCell>
                      <TableCell className="text-right">{f.checklist != null ? formatarNum(Number(f.checklist)) : '—'}</TableCell>
                      <TableCell className="text-right">{f.perda != null ? formatarNum(Number(f.perda)) : '—'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {totalPaginasFechamento > 1 && (
            <div className="flex justify-between mt-2">
              <p className="text-sm text-muted-foreground">Página {paginaFechamento} de {totalPaginasFechamento}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setPaginaFechamento((p) => Math.max(1, p - 1))} disabled={paginaFechamento === 1}><ChevronLeft className="w-4 h-4" /> Anterior</Button>
                <Button size="sm" variant="outline" onClick={() => setPaginaFechamento((p) => Math.min(totalPaginasFechamento, p + 1))} disabled={paginaFechamento === totalPaginasFechamento}>Próxima <ChevronRight className="w-4 h-4" /></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resultado Final</CardTitle>
          <CardDescription>Bônus por produtividade (meta R$ {META_BONUS}) e descontos</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-auto max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Filial</TableHead>
                  <TableHead>Mes/Ano</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Colaborador</TableHead>
                  <TableHead className="text-right">Vlr Acuracidade</TableHead>
                  <TableHead className="text-right">Vlr Checklist</TableHead>
                  <TableHead className="text-right">Vlr Plt/Hs</TableHead>
                  <TableHead className="text-right">Vlr Perda</TableHead>
                  <TableHead className="text-right">Desconto</TableHead>
                  <TableHead className="text-right">Prod. Final R$</TableHead>
                  <TableHead>Meta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={12} className="text-center py-8">Carregando...</TableCell></TableRow>
                ) : resultadoPaginado.length === 0 ? (
                  <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">Nenhum resultado. Calcule o fechamento.</TableCell></TableRow>
                ) : (
                  resultadoPaginado.map((r) => {
                    const bonusFinal = Number(r.bonus_final ?? 0)
                    const cor = obterCorProdutividade(bonusFinal, META_BONUS)
                    const pctMeta = META_BONUS > 0 ? Math.min((bonusFinal / META_BONUS) * 100, 100) : 0
                    const codigo = filiais.find((f) => f.id === r.id_filial)?.codigo ?? ''
                    const setor = (r.funcao ?? '').toLowerCase().includes('estoque') ? 'estoque' : 'recebimento'
                    const vlrAcu = calcularValorAcuracidade(Number(r.acuracidade ?? 0))
                    const vlrChk = calcularValorChecklist(Number(r.checklist ?? 0))
                    const vlrPlt = calcularValorPltHsPorFilial(Number(r.plt_hs ?? 0), codigo, setor)
                    const vlrPerd = setor === 'estoque' ? calcularValorPerda(Number(r.perda ?? 0)) : 0
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs">{r.filial}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{mesSelecionado}/{anoSelecionado}</TableCell>
                        <TableCell className="text-xs">{r.funcao ?? '—'}</TableCell>
                        <TableCell>{r.colaborador_matricula}</TableCell>
                        <TableCell className="font-medium">{r.colaborador_nome}</TableCell>
                        <TableCell className="text-right">{formatarMoeda(vlrAcu)}</TableCell>
                        <TableCell className="text-right">{formatarMoeda(vlrChk)}</TableCell>
                        <TableCell className="text-right">{formatarMoeda(vlrPlt)}</TableCell>
                        <TableCell className="text-right">{formatarMoeda(vlrPerd)}</TableCell>
                        <TableCell className="text-right">{formatarMoeda(Number(r.desconto ?? 0))}</TableCell>
                        <TableCell className="text-right">
                          <span className="inline-block px-2 py-1 rounded font-bold text-white" style={{ backgroundColor: cor }}>{formatarMoeda(bonusFinal)}</span>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 min-w-[100px]">
                            <div className="flex justify-between text-xs">
                              <span>Meta {formatarMoeda(META_BONUS)}</span>
                              <span className="font-medium">{formatarNum(pctMeta, 0)}%</span>
                            </div>
                            <Progress value={pctMeta} className="h-2" />
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
          {totalPaginasResultado > 1 && (
            <div className="flex justify-between mt-2">
              <p className="text-sm text-muted-foreground">Página {paginaResultado} de {totalPaginasResultado}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setPaginaResultado((p) => Math.max(1, p - 1))} disabled={paginaResultado === 1}><ChevronLeft className="w-4 h-4" /> Anterior</Button>
                <Button size="sm" variant="outline" onClick={() => setPaginaResultado((p) => Math.min(totalPaginasResultado, p + 1))} disabled={paginaResultado === totalPaginasResultado}>Próxima <ChevronRight className="w-4 h-4" /></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
