'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Edit, Trash2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ChevronsUpDown, Columns3 } from 'lucide-react'
import { FilterToggle } from '@/components/FilterToggle'
import { registrarLog } from '@/lib/logs'
import { formatDateBR } from '@/lib/date-utils'
import { contarPaletes, intervalToHours } from '@/lib/calculos'
import { fetchAllRows } from '@/lib/supabase/fetch-all'

export interface DadoCargaDock {
  id_coleta_recebimento: string
  id_primeiro_recebimento: string
  id_filial: string | null
  id_tempo: string | null
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
  observacao: string | null
}

const COLUNAS_PADRAO: (keyof DadoCargaDock)[] = [
  'id_coleta_recebimento', 'filial', 'coleta', 'fornec', 'dta_receb', 'qtd_caixas', 'peso_liquido', 'qtd_paletes',
  'hora_inicial', 'hora_final', 'tempo_horas', 'kg_hs', 'vol_hs', 'plt_hs', 'observacao',
]

const COLUNAS_LABEL: Record<keyof DadoCargaDock, string> = {
  id_coleta_recebimento: 'Id',
  id_primeiro_recebimento: '',
  id_filial: '',
  id_tempo: '',
  filial: 'Filial',
  coleta: 'Coleta',
  fornec: 'Fornec',
  dta_receb: 'Dta Receb',
  qtd_caixas: 'Qtd Caixas',
  peso_liquido: 'Peso Líq.',
  qtd_paletes: 'Qtd Paletes',
  hora_inicial: 'Hora Inicial',
  hora_final: 'Hora Final',
  tempo_horas: 'Tempo (h)',
  kg_hs: 'Kg/Hs',
  vol_hs: 'Vol/Hs',
  plt_hs: 'Plt/Hs',
  observacao: 'Observação',
}

const REGISTROS_POR_PAGINA = 500

export default function ProdutividadePage() {
  const [dados, setDados] = useState<DadoCargaDock[]>([])
  const [dadosFiltrados, setDadosFiltrados] = useState<DadoCargaDock[]>([])
  const [loading, setLoading] = useState(true)
  const [paginaAtual, setPaginaAtual] = useState(1)
  const [filiais, setFiliais] = useState<{ id: string; nome: string }[]>([])
  const [usuarioLogado, setUsuarioLogado] = useState<{ tipo: string; id_filial: string | null } | null>(null)
  const [filtroFilial, setFiltroFilial] = useState('todas')
  const [filtroBusca, setFiltroBusca] = useState('')
  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')
  const [filtroPltHsMin, setFiltroPltHsMin] = useState('')
  const [filtroPltHsMax, setFiltroPltHsMax] = useState('')
  const [buscaDebounced, setBuscaDebounced] = useState('')
  const [ordenacao, setOrdenacao] = useState<{ coluna: keyof DadoCargaDock | null; direcao: 'asc' | 'desc' }>({ coluna: 'dta_receb', direcao: 'desc' })
  const [colunasVisiveis, setColunasVisiveis] = useState<string[]>(COLUNAS_PADRAO.filter((c) => !['id_primeiro_recebimento', 'id_tempo', 'id_filial'].includes(c)) as string[])
  const [dialogAberto, setDialogAberto] = useState(false)
  const [dadoEditando, setDadoEditando] = useState<DadoCargaDock | null>(null)
  const [observacaoEdit, setObservacaoEdit] = useState('')
  const [horaInicialEdit, setHoraInicialEdit] = useState('')
  const [horaFinalEdit, setHoraFinalEdit] = useState('')
  const [confirmExcluirOpen, setConfirmExcluirOpen] = useState(false)
  const [idExcluir, setIdExcluir] = useState<string | null>(null)

  const totalPaginas = Math.ceil(dadosFiltrados.length / REGISTROS_POR_PAGINA)
  const dadosOrdenados = (() => {
    const list = [...dadosFiltrados]
    const col = ordenacao.coluna
    if (!col || col === 'id_primeiro_recebimento' || col === 'id_tempo') return list
    const dir = ordenacao.direcao === 'asc' ? 1 : -1
    list.sort((a, b) => {
      const va = a[col]
      const vb = b[col]
      if (va == null && vb == null) return 0
      if (va == null) return dir
      if (vb == null) return -dir
      if (typeof va === 'number' && typeof vb === 'number') return dir * (va - vb)
      return dir * String(va).localeCompare(String(vb))
    })
    return list
  })()
  const dadosPaginados = dadosOrdenados.slice((paginaAtual - 1) * REGISTROS_POR_PAGINA, paginaAtual * REGISTROS_POR_PAGINA)

  const supabase = createClient()

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

  const carregarDados = useCallback(async () => {
    setLoading(true)
    try {
      const recebimentos = await fetchAllRows(() => supabase.from('recebimentos').select('*').order('dta_receb', { ascending: false }))
      const tempoList = await fetchAllRows(() => supabase.from('tempo').select('*'))

      // Associação por ordem de coleta: tempo tem id_coleta_recebimento = recebimentos.coleta (PROCV no upload). Hora Inicial, Hora Final e Tempo (h) vêm da linha de tempo com a mesma ordem.
      const tempoPorColeta = new Map<string, { id: string; inicio: string | null; final: string | null; tempo_recebimento: string | null }>()
      ;(tempoList ?? []).forEach((t: { id: string; id_coleta_recebimento: string | null; inicio_recebimento: string | null; final_recebimento: string | null; tempo_recebimento: string | null }) => {
        const key = t.id_coleta_recebimento ?? ''
        if (key && !tempoPorColeta.has(key)) {
          tempoPorColeta.set(key, {
            id: t.id,
            inicio: t.inicio_recebimento ? (typeof t.inicio_recebimento === 'string' ? t.inicio_recebimento : null) : null,
            final: t.final_recebimento ? (typeof t.final_recebimento === 'string' ? t.final_recebimento : null) : null,
            tempo_recebimento: t.tempo_recebimento ? String(t.tempo_recebimento) : null,
          })
        }
      })

      const grupos = new Map<string, { ids: string[]; id_filial: string | null; filial: string; coleta: string; fornec: string; dta_receb: string; qtd_caixas: number; peso_liquido: number; qtd_caixas_arr: number[]; observacao: string | null }>()
      ;(recebimentos ?? []).forEach((r: { id: string; id_filial: string | null; id_coleta_recebimento: string | null; filial: string | null; coleta: string | null; fornecedor: string | null; dta_receb: string | null; qtd_caixas_recebidas: number | null; peso_liquido_recebido: number | null; observacao: string | null }) => {
        const key = r.id_coleta_recebimento ?? r.id
        if (!grupos.has(key)) {
          grupos.set(key, {
            ids: [],
            id_filial: r.id_filial ?? null,
            filial: r.filial ?? '',
            coleta: r.coleta ?? '',
            fornec: r.fornecedor ?? '',
            dta_receb: r.dta_receb ? String(r.dta_receb).slice(0, 10) : '',
            qtd_caixas: 0,
            peso_liquido: 0,
            qtd_caixas_arr: [],
            observacao: r.observacao ?? null,
          })
        }
        const g = grupos.get(key)!
        g.ids.push(r.id)
        g.qtd_caixas += Number(r.qtd_caixas_recebidas ?? 0)
        g.peso_liquido += Number(r.peso_liquido_recebido ?? 0)
        g.qtd_caixas_arr.push(Number(r.qtd_caixas_recebidas ?? 0))
        if (r.observacao) g.observacao = r.observacao
      })

      const rows: DadoCargaDock[] = []
      grupos.forEach((g, idColeta) => {
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
          id_coleta_recebimento: idColeta,
          id_primeiro_recebimento: g.ids[0],
          id_filial: g.id_filial,
          id_tempo: tempo?.id ?? null,
          filial: g.filial,
          coleta: g.coleta,
          fornec: g.fornec,
          dta_receb: g.dta_receb,
          qtd_caixas: g.qtd_caixas,
          peso_liquido: g.peso_liquido,
          qtd_paletes: paletes,
          hora_inicial: horaInicial,
          hora_final: horaFinal,
          tempo_horas: tempoHoras,
          kg_hs: kgHs,
          vol_hs: volHs,
          plt_hs: pltHs,
          observacao: g.observacao,
        })
      })

      rows.sort((a, b) => b.dta_receb.localeCompare(a.dta_receb))
      setDados(rows)

      // Persistir totais por coleta na tabela tempo (em segundo plano)
      const updates = rows
        .filter((r) => r.id_tempo != null)
        .map((r) =>
          supabase
            .from('tempo')
            .update({
              peso_total: r.peso_liquido,
              qtd_caixas_total: r.qtd_caixas,
              qtd_paletes: r.qtd_paletes,
              tempo_horas: r.tempo_horas ?? null,
              kg_hs: r.kg_hs ?? null,
              vol_hs: r.vol_hs ?? null,
              plt_hs: r.plt_hs ?? null,
            })
            .eq('id', r.id_tempo!)
        )
      if (updates.length) void Promise.all(updates)
    } catch (e) {
      console.error('Erro ao carregar dados:', e)
      setDados([])
    } finally {
      setLoading(false)
    }
  }, [supabase])

  const carregarFiliais = useCallback(async () => {
    const { data } = await supabase.from('filiais').select('id, nome').eq('ativo', true)
    if (data) setFiliais(data)
  }, [supabase])

  useEffect(() => {
    carregarUsuarioLogado()
    carregarFiliais()
    carregarDados()
  }, [carregarUsuarioLogado, carregarFiliais, carregarDados])

  const aplicarFiltros = useCallback(() => {
    let f = [...dados]
    if (filtroFilial && filtroFilial !== 'todas') {
      const isUuid = filtroFilial.length === 36 && filtroFilial.includes('-')
      f = f.filter((d) => (isUuid && d.id_filial === filtroFilial) || (!isUuid && d.filial && d.filial.includes(filtroFilial)))
    }
    if (filtroDataInicio) f = f.filter((d) => d.dta_receb >= filtroDataInicio)
    if (filtroDataFim) f = f.filter((d) => d.dta_receb <= filtroDataFim)
    if (buscaDebounced) {
      const b = buscaDebounced.toLowerCase()
      f = f.filter((d) => d.coleta.toLowerCase().includes(b) || d.fornec.toLowerCase().includes(b) || d.id_coleta_recebimento.toLowerCase().includes(b) || d.filial.toLowerCase().includes(b))
    }
    if (filtroPltHsMin !== '') {
      const min = Number(filtroPltHsMin)
      f = f.filter((d) => d.plt_hs != null && d.plt_hs >= min)
    }
    if (filtroPltHsMax !== '') {
      const max = Number(filtroPltHsMax)
      f = f.filter((d) => d.plt_hs != null && d.plt_hs <= max)
    }
    setDadosFiltrados(f)
    setPaginaAtual(1)
  }, [dados, filtroFilial, filtroDataInicio, filtroDataFim, buscaDebounced, filtroPltHsMin, filtroPltHsMax, filiais])

  useEffect(() => {
    aplicarFiltros()
  }, [aplicarFiltros])

  const limparFiltros = () => {
    setFiltroFilial(usuarioLogado?.tipo === 'colaborador' && usuarioLogado?.id_filial ? usuarioLogado.id_filial : 'todas')
    setFiltroBusca('')
    setFiltroDataInicio('')
    setFiltroDataFim('')
    setFiltroPltHsMin('')
    setFiltroPltHsMax('')
    setPaginaAtual(1)
  }

  const contarFiltrosAtivos = () => {
    let c = 0
    if (filtroFilial !== 'todas') c++
    if (filtroBusca) c++
    if (filtroDataInicio) c++
    if (filtroDataFim) c++
    if (filtroPltHsMin !== '') c++
    if (filtroPltHsMax !== '') c++
    return c
  }

  const toggleColunaVisivel = (col: string) => {
    setColunasVisiveis((prev) => (prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]))
  }

  const abrirEdicao = (dado: DadoCargaDock) => {
    setDadoEditando(dado)
    setObservacaoEdit(dado.observacao ?? '')
    setHoraInicialEdit(dado.hora_inicial ?? '')
    setHoraFinalEdit(dado.hora_final ?? '')
    setDialogAberto(true)
  }

  const salvarEdicao = async () => {
    if (!dadoEditando) return
    try {
      await supabase.from('recebimentos').update({ observacao: observacaoEdit.trim() || null }).eq('id', dadoEditando.id_primeiro_recebimento)
      if (dadoEditando.id_tempo && (horaInicialEdit || horaFinalEdit)) {
        const hi = horaInicialEdit ? `${horaInicialEdit.padEnd(5, ':00').slice(0, 5)}:00` : null
        const hf = horaFinalEdit ? `${horaFinalEdit.padEnd(5, ':00').slice(0, 5)}:00` : null
        const updates: { inicio_recebimento?: string; final_recebimento?: string } = {}
        if (hi) updates.inicio_recebimento = new Date(`1970-01-01T${hi}`).toISOString()
        if (hf) updates.final_recebimento = new Date(`1970-01-01T${hf}`).toISOString()
        if (Object.keys(updates).length) await supabase.from('tempo').update(updates).eq('id', dadoEditando.id_tempo)
      }
      registrarLog(supabase, 'Editou produtividade (detalhamento)', dadoEditando.id_coleta_recebimento)
      setDialogAberto(false)
      carregarDados()
    } catch (e) {
      console.error(e)
      alert('Erro ao salvar')
    }
  }

  const abrirConfirmExcluir = (idColeta: string) => {
    setIdExcluir(idColeta)
    setConfirmExcluirOpen(true)
  }

  const executarExcluir = async () => {
    if (!idExcluir) return
    try {
      const row = dados.find((d) => d.id_coleta_recebimento === idExcluir)
      if (row?.id_tempo) await supabase.from('tempo').delete().eq('id_coleta_recebimento', idExcluir)
      await supabase.from('recebimentos').delete().eq('id_coleta_recebimento', idExcluir)
      registrarLog(supabase, 'Excluiu coleta do detalhamento', idExcluir)
      carregarDados()
      setIdExcluir(null)
    } catch (e) {
      console.error(e)
      alert('Erro ao excluir')
    }
  }

  const toggleOrdenacao = (coluna: keyof DadoCargaDock) => {
    if (coluna === 'id_primeiro_recebimento' || coluna === 'id_tempo') return
    setOrdenacao((prev) => (prev.coluna === coluna ? { coluna, direcao: prev.direcao === 'asc' ? 'desc' : 'asc' } : { coluna, direcao: 'asc' }))
    setPaginaAtual(1)
  }

  const colunasExibir = colunasVisiveis.filter((c) => !['id_primeiro_recebimento', 'id_tempo', 'id_filial'].includes(c))

  const resumoCards = useMemo(() => {
    const qtdCargas = dadosFiltrados.length
    const totalPaletes = dadosFiltrados.reduce((s, d) => s + (d.qtd_paletes ?? 0), 0)
    const tempoTotal = dadosFiltrados.reduce((s, d) => s + (d.tempo_horas ?? 0), 0)
    const mediaPltHs = tempoTotal > 0 ? totalPaletes / tempoTotal : null
    return { qtdCargas, totalPaletes, tempoTotal, mediaPltHs }
  }, [dadosFiltrados])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Detalhamento e Revisão</h1>
        <p className="text-muted-foreground">Dados de recebimentos e tempo por coleta</p>
      </div>

      <FilterToggle filtrosAtivos={contarFiltrosAtivos()} onLimparFiltros={limparFiltros}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Filial</Label>
            <Select value={filtroFilial} onValueChange={setFiltroFilial} disabled={usuarioLogado?.tipo === 'colaborador'}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                {(usuarioLogado?.tipo === 'admin' || usuarioLogado?.tipo === 'gestor') && <SelectItem value="todas">Todas</SelectItem>}
                {filiais.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Data Início</Label>
            <Input type="date" value={filtroDataInicio} onChange={(e) => setFiltroDataInicio(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Data Fim</Label>
            <Input type="date" value={filtroDataFim} onChange={(e) => setFiltroDataFim(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Busca</Label>
            <Input placeholder="Coleta, fornecedor, id..." value={filtroBusca} onChange={(e) => setFiltroBusca(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Plt/Hs (min–max)</Label>
            <div className="flex gap-2">
              <Input type="number" placeholder="Min" value={filtroPltHsMin} onChange={(e) => setFiltroPltHsMin(e.target.value)} step="0.1" />
              <Input type="number" placeholder="Max" value={filtroPltHsMax} onChange={(e) => setFiltroPltHsMax(e.target.value)} step="0.1" />
            </div>
          </div>
        </div>
      </FilterToggle>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Qtd de Cargas Recebidas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{resumoCards.qtdCargas}</p>
            <p className="text-xs text-muted-foreground">Coletas no período filtrado</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total paletes recebidos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{resumoCards.totalPaletes.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Soma da coluna Paletes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tempo total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{resumoCards.tempoTotal.toFixed(2)}h</p>
            <p className="text-xs text-muted-foreground">Soma da coluna Tempo (h)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Média Plt/Hs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{resumoCards.mediaPltHs != null ? resumoCards.mediaPltHs.toFixed(2) : '—'}</p>
            <p className="text-xs text-muted-foreground">Total paletes ÷ tempo total</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Dados por Coleta</CardTitle>
              <CardDescription>
                {dadosFiltrados.length} coleta(s) · Ordenado por data (mais recente primeiro) · Até {REGISTROS_POR_PAGINA} por página
              </CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Columns3 className="h-4 w-4" /> Colunas
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 max-h-80 overflow-y-auto">
                {COLUNAS_PADRAO.filter((c) => !['id_primeiro_recebimento', 'id_tempo', 'id_filial'].includes(c)).map((col) => (
                  <DropdownMenuCheckboxItem key={col} checked={colunasVisiveis.includes(col)} onCheckedChange={() => toggleColunaVisivel(col)}>
                    {COLUNAS_LABEL[col as keyof DadoCargaDock]}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-auto max-h-[70vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  {colunasExibir.map((col) => {
                    const key = col as keyof DadoCargaDock
                    const label = COLUNAS_LABEL[key]
                    const isSortable = !['observacao', 'hora_inicial', 'hora_final'].includes(col)
                    return isSortable ? (
                      <TableHead
                        key={col}
                        className="cursor-pointer select-none hover:opacity-80 text-right"
                        onClick={() => toggleOrdenacao(key)}
                      >
                        <div className="flex items-center gap-1 justify-end">
                          {label}
                          {ordenacao.coluna === key ? (ordenacao.direcao === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : <ChevronsUpDown className="h-4 w-4 opacity-50" />}
                        </div>
                      </TableHead>
                    ) : (
                      <TableHead key={col} className={col === 'observacao' ? 'max-w-[140px]' : ''}>{label}</TableHead>
                    )
                  })}
                  <TableHead className="text-center w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={colunasExibir.length + 1} className="text-center py-8">Carregando...</TableCell>
                  </TableRow>
                ) : dadosPaginados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={colunasExibir.length + 1} className="text-center py-8 text-muted-foreground">Nenhum dado encontrado</TableCell>
                  </TableRow>
                ) : (
                  dadosPaginados.map((dado) => (
                    <TableRow key={dado.id_coleta_recebimento}>
                      {colunasExibir.map((col) => {
                        const key = col as keyof DadoCargaDock
                        const val = dado[key]
                        const isNum = ['qtd_caixas', 'peso_liquido', 'qtd_paletes', 'tempo_horas', 'kg_hs', 'vol_hs', 'plt_hs'].includes(col)
                        const display = key === 'dta_receb' && val ? formatDateBR(String(val)) : isNum && typeof val === 'number' ? (key === 'peso_liquido' || key === 'qtd_paletes' || key === 'kg_hs' || key === 'vol_hs' || key === 'plt_hs' ? Number(val).toFixed(2) : key === 'tempo_horas' ? Number(val).toFixed(2) : Number(val).toFixed(0)) : val != null ? String(val) : '—'
                        return (
                          <TableCell
                            key={col}
                            className={
                              key === 'id_coleta_recebimento' ? 'font-mono text-xs' :
                              key === 'filial' || key === 'fornec' ? 'text-xs max-w-[120px] truncate' :
                              isNum ? 'text-right' : ''
                            }
                          >
                            {display}
                          </TableCell>
                        )
                      })}
                      <TableCell>
                        <div className="flex justify-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => abrirEdicao(dado)}><Edit className="w-4 h-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => abrirConfirmExcluir(dado.id_coleta_recebimento)}><Trash2 className="w-4 h-4 text-red-600" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Página {paginaAtual} de {totalPaginas} · {dadosFiltrados.length} registro(s)
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))} disabled={paginaAtual === 1}>
                  <ChevronLeft className="w-4 h-4" /> Anterior
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))} disabled={paginaAtual === totalPaginas}>
                  Próxima <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        {dialogAberto && dadoEditando && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Editar Coleta</DialogTitle>
              <DialogDescription>Coleta: {dadoEditando.coleta} · {dadoEditando.fornec}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Observação</Label>
                <Input value={observacaoEdit} onChange={(e) => setObservacaoEdit(e.target.value)} placeholder="Observação" />
              </div>
              {dadoEditando.id_tempo && (
                <>
                  <div className="space-y-2">
                    <Label>Hora Inicial</Label>
                    <Input type="time" value={horaInicialEdit} onChange={(e) => setHoraInicialEdit(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Hora Final</Label>
                    <Input type="time" value={horaFinalEdit} onChange={(e) => setHoraFinalEdit(e.target.value)} />
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogAberto(false)}>Cancelar</Button>
              <Button onClick={salvarEdicao} className="bg-green-600 hover:bg-green-700">Salvar</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      <ConfirmDialog open={confirmExcluirOpen} onOpenChange={(o) => { setConfirmExcluirOpen(o); if (!o) setIdExcluir(null) }} title="Excluir coleta?" message="Todos os recebimentos e o registro de tempo desta coleta serão removidos." onConfirm={executarExcluir} confirmLabel="Sim" cancelLabel="Não" />
    </div>
  )
}
