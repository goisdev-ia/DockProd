'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Edit, Trash2, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { FilterToggle } from '@/components/FilterToggle'
import type { Desconto } from '@/types/database'

interface DescontoExtendido extends Desconto {
  colaborador_nome?: string
  filial_nome?: string
}

export default function DescontosPage() {
  const [descontos, setDescontos] = useState<DescontoExtendido[]>([])
  const [descontosFiltrados, setDescontosFiltrados] = useState<DescontoExtendido[]>([])
  const [colaboradores, setColaboradores] = useState<{ id: string; nome: string; matricula?: string; id_filial?: string }[]>([])
  const [filiais, setFiliais] = useState<{ id: string; nome: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [usuarioLogado, setUsuarioLogado] = useState<{ tipo: string; id_filial: string | null } | null>(null)

  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const registrosPorPagina = 50

  // Filtros
  const [filtroColaborador, setFiltroColaborador] = useState('todos')
  const [filtroFilial, setFiltroFilial] = useState('todas')
  const [filtroMes, setFiltroMes] = useState('todos')
  const [filtroBusca, setFiltroBusca] = useState('')
  const [filtroFaltasMin, setFiltroFaltasMin] = useState('')
  const [filtroFaltasMax, setFiltroFaltasMax] = useState('')
  const [filtroFeriasMin, setFiltroFeriasMin] = useState('')
  const [filtroFeriasMax, setFiltroFeriasMax] = useState('')
  const [filtroAdvertenciasMin, setFiltroAdvertenciasMin] = useState('')
  const [filtroAdvertenciasMax, setFiltroAdvertenciasMax] = useState('')
  const [filtroSuspensoesMin, setFiltroSuspensoesMin] = useState('')
  const [filtroSuspensoesMax, setFiltroSuspensoesMax] = useState('')
  const [filtroAtestadoMin, setFiltroAtestadoMin] = useState('')
  const [filtroAtestadoMax, setFiltroAtestadoMax] = useState('')
  const [filtroMatricula, setFiltroMatricula] = useState('')
  const [buscaDebounced, setBuscaDebounced] = useState('')
  const [matriculaDebounced, setMatriculaDebounced] = useState('')

  // Dialog
  const [dialogAberto, setDialogAberto] = useState(false)
  const [modoEdicao, setModoEdicao] = useState(false)
  const [descontoEditando, setDescontoEditando] = useState<DescontoExtendido | null>(null)

  // Form
  const [colaboradorSelecionado, setColaboradorSelecionado] = useState('selecione')
  const [mesSelecionado, setMesSelecionado] = useState('selecione')
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear())
  const [faltaInjustificada, setFaltaInjustificada] = useState(0)
  const [ferias, setFerias] = useState(false)
  const [advertencia, setAdvertencia] = useState(0)
  const [suspensao, setSuspensao] = useState(0)
  const [atestadoDias, setAtestadoDias] = useState(0)
  const [observacao, setObservacao] = useState('')
  const [confirmSalvarOpen, setConfirmSalvarOpen] = useState(false)
  const [confirmExcluirOpen, setConfirmExcluirOpen] = useState(false)
  const [idExcluir, setIdExcluir] = useState<string | null>(null)
  const [regrasDescontos, setRegrasDescontos] = useState<{
    falta_injustificada_percent?: number
    ferias_percent?: number
    advertencia_percent?: number
    suspensao_percent?: number
    atestado?: { percent?: number; ate_dias?: number; acima_dias?: number }[]
  } | null>(null)

  const supabase = createClient()

  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ]

  const carregarRegrasDescontos = async () => {
    const { data } = await supabase.from('configuracoes').select('valor').eq('chave', 'regras_descontos').single()
    if (data?.valor) {
      setRegrasDescontos(data.valor as {
        falta_injustificada_percent?: number
        ferias_percent?: number
        advertencia_percent?: number
        suspensao_percent?: number
        atestado?: { percent?: number; ate_dias?: number; acima_dias?: number }[]
      })
    }
  }

  useEffect(() => {
    carregarUsuarioLogado()
    carregarDados()
    carregarColaboradores()
    carregarFiliais()
    carregarRegrasDescontos()
  }, [])

  const carregarUsuarioLogado = async () => {
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
          setFiltroFilial(usuario.id_filial)
        }
      }
    }
  }

  // Debounce para inputs de texto
  useEffect(() => {
    const timer = setTimeout(() => setBuscaDebounced(filtroBusca), 300)
    return () => clearTimeout(timer)
  }, [filtroBusca])

  useEffect(() => {
    const timer = setTimeout(() => setMatriculaDebounced(filtroMatricula), 300)
    return () => clearTimeout(timer)
  }, [filtroMatricula])

  useEffect(() => {
    aplicarFiltros()
  }, [descontos, filtroColaborador, filtroFilial, filtroMes, buscaDebounced, filtroFaltasMin, filtroFaltasMax, filtroFeriasMin, filtroFeriasMax, filtroAdvertenciasMin, filtroAdvertenciasMax, filtroSuspensoesMin, filtroSuspensoesMax, filtroAtestadoMin, filtroAtestadoMax, matriculaDebounced])

  const carregarDados = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('descontos')
        .select(`
          *,
          colaboradores (nome, matricula),
          filiais (nome)
        `)
        .order('ano', { ascending: false })
        .order('mes', { ascending: false })

      if (data) {
        const descontosFormatados = data.map(d => ({
          ...d,
          colaborador_nome: d.colaboradores?.nome,
          filial_nome: d.filiais?.nome
        }))
        setDescontos(descontosFormatados)
      }
    } catch (error) {
      console.error('Erro ao carregar descontos:', error)
    } finally {
      setLoading(false)
    }
  }

  const carregarColaboradores = async () => {
    const { data } = await supabase
      .from('colaboradores')
      .select('*')
      .eq('ativo', true)
      .order('nome')

    if (data) setColaboradores(data)
  }

  const carregarFiliais = async () => {
    const { data } = await supabase
      .from('filiais')
      .select('*')
      .eq('ativo', true)

    if (data) setFiliais(data)
  }

  const aplicarFiltros = () => {
    let filtrados = [...descontos]

    if (filtroColaborador && filtroColaborador !== 'todos') {
      filtrados = filtrados.filter(d => d.id_colaborador === filtroColaborador)
    }

    if (filtroFilial && filtroFilial !== 'todas') {
      filtrados = filtrados.filter(d => d.id_filial === filtroFilial)
    }

    if (filtroMes && filtroMes !== 'todos') {
      filtrados = filtrados.filter(d => d.mes === filtroMes)
    }

    if (buscaDebounced) {
      const busca = buscaDebounced.toLowerCase()
      filtrados = filtrados.filter(d =>
        d.colaborador_nome?.toLowerCase().includes(busca) ||
        d.observacao?.toLowerCase().includes(busca)
      )
    }

    if (filtroFaltasMin !== '') {
      const min = Number(filtroFaltasMin)
      filtrados = filtrados.filter(d => d.falta_injustificada >= min)
    }

    if (filtroFaltasMax !== '') {
      const max = Number(filtroFaltasMax)
      filtrados = filtrados.filter(d => d.falta_injustificada <= max)
    }

    if (filtroFeriasMin !== '' || filtroFeriasMax !== '') {
      // Férias é booleano, mas permitir filtro numérico (0=não, 1=sim)
      filtrados = filtrados.filter(d => {
        const valor = d.ferias ? 1 : 0
        if (filtroFeriasMin !== '' && valor < Number(filtroFeriasMin)) return false
        if (filtroFeriasMax !== '' && valor > Number(filtroFeriasMax)) return false
        return true
      })
    }

    if (filtroAdvertenciasMin !== '') {
      const min = Number(filtroAdvertenciasMin)
      filtrados = filtrados.filter(d => d.advertencia >= min)
    }

    if (filtroAdvertenciasMax !== '') {
      const max = Number(filtroAdvertenciasMax)
      filtrados = filtrados.filter(d => d.advertencia <= max)
    }

    if (filtroSuspensoesMin !== '') {
      const min = Number(filtroSuspensoesMin)
      filtrados = filtrados.filter(d => d.suspensao >= min)
    }

    if (filtroSuspensoesMax !== '') {
      const max = Number(filtroSuspensoesMax)
      filtrados = filtrados.filter(d => d.suspensao <= max)
    }

    if (filtroAtestadoMin !== '') {
      const min = Number(filtroAtestadoMin)
      filtrados = filtrados.filter(d => d.atestado_dias >= min)
    }

    if (filtroAtestadoMax !== '') {
      const max = Number(filtroAtestadoMax)
      filtrados = filtrados.filter(d => d.atestado_dias <= max)
    }

    if (matriculaDebounced) {
      const matricula = matriculaDebounced.toLowerCase()
      filtrados = filtrados.filter(d => {
        const colaboradorObj = colaboradores.find(c => c.id === d.id_colaborador)
        return colaboradorObj?.matricula?.toLowerCase().includes(matricula)
      })
    }

    setDescontosFiltrados(filtrados)
    setTotalPaginas(Math.ceil(filtrados.length / registrosPorPagina))
    setPaginaAtual(1)
  }

  const limparFiltros = () => {
    setFiltroColaborador('todos')
    setFiltroFilial('todas')
    setFiltroMes('todos')
    setFiltroBusca('')
    setFiltroFaltasMin('')
    setFiltroFaltasMax('')
    setFiltroFeriasMin('')
    setFiltroFeriasMax('')
    setFiltroAdvertenciasMin('')
    setFiltroAdvertenciasMax('')
    setFiltroSuspensoesMin('')
    setFiltroSuspensoesMax('')
    setFiltroAtestadoMin('')
    setFiltroAtestadoMax('')
    setFiltroMatricula('')
  }

  const contarFiltrosAtivos = () => {
    let count = 0
    if (filtroColaborador !== 'todos') count++
    if (filtroFilial !== 'todas') count++
    if (filtroMes !== 'todos') count++
    if (filtroBusca) count++
    if (filtroFaltasMin) count++
    if (filtroFaltasMax) count++
    if (filtroFeriasMin) count++
    if (filtroFeriasMax) count++
    if (filtroAdvertenciasMin) count++
    if (filtroAdvertenciasMax) count++
    if (filtroSuspensoesMin) count++
    if (filtroSuspensoesMax) count++
    if (filtroAtestadoMin) count++
    if (filtroAtestadoMax) count++
    if (filtroMatricula) count++
    return count
  }

  const calcularPercentualTotal = () => {
    let percentual = 0
    const r = regrasDescontos
    const pctFalta = r?.falta_injustificada_percent != null ? r.falta_injustificada_percent * 100 : 100
    const pctFerias = r?.ferias_percent != null ? r.ferias_percent * 100 : 100
    const pctAdv = r?.advertencia_percent != null ? r.advertencia_percent * 100 : 50
    const pctSusp = r?.suspensao_percent != null ? r.suspensao_percent * 100 : 100

    if (faltaInjustificada > 0) percentual += faltaInjustificada * pctFalta
    if (ferias) percentual += pctFerias
    if (advertencia > 0) percentual += advertencia * pctAdv
    if (suspensao > 0) percentual += suspensao * pctSusp

    if (atestadoDias > 0 && Array.isArray(r?.atestado) && r.atestado.length > 0) {
      const tiers = [...r.atestado].sort((a, b) => (a.ate_dias ?? a.acima_dias ?? 999) - (b.ate_dias ?? b.acima_dias ?? 999))
      let tierPct = (tiers[tiers.length - 1]?.percent ?? 0) * 100
      for (const t of tiers) {
        const limite = t.ate_dias ?? t.acima_dias
        if (limite != null && atestadoDias <= limite) {
          tierPct = (t.percent ?? 0) * 100
          break
        }
      }
      percentual += tierPct
    } else if (atestadoDias > 0) {
      if (atestadoDias <= 2) percentual += 25
      else if (atestadoDias <= 5) percentual += 50
      else if (atestadoDias <= 7) percentual += 70
      else percentual += 100
    }

    return Math.min(percentual, 100)
  }

  const abrirNovo = () => {
    setModoEdicao(false)
    setDescontoEditando(null)
    resetarForm()
    setDialogAberto(true)
  }

  const abrirEdicao = (desconto: DescontoExtendido) => {
    setModoEdicao(true)
    setDescontoEditando(desconto)
    setColaboradorSelecionado(desconto.id_colaborador)
    setMesSelecionado(desconto.mes)
    setAnoSelecionado(desconto.ano)
    setFaltaInjustificada(desconto.falta_injustificada)
    setFerias(desconto.ferias)
    setAdvertencia(desconto.advertencia)
    setSuspensao(desconto.suspensao)
    setAtestadoDias(desconto.atestado_dias)
    setObservacao(desconto.observacao || '')
    setDialogAberto(true)
  }

  const resetarForm = () => {
    setColaboradorSelecionado('selecione')
    setMesSelecionado('selecione')
    setAnoSelecionado(new Date().getFullYear())
    setFaltaInjustificada(0)
    setFerias(false)
    setAdvertencia(0)
    setSuspensao(0)
    setAtestadoDias(0)
    setObservacao('')
  }

  const salvar = async () => {
    if (!colaboradorSelecionado || colaboradorSelecionado === 'selecione' || !mesSelecionado || mesSelecionado === 'selecione') {
      alert('Preencha todos os campos obrigatórios')
      return
    }

    try {
      const colaborador = colaboradores.find(c => c.id === colaboradorSelecionado)
      if (!colaborador) return

      const percentualTotal = calcularPercentualTotal()

      const dadosDesconto = {
        id_colaborador: colaboradorSelecionado,
        id_filial: colaborador.id_filial,
        mes: mesSelecionado,
        ano: anoSelecionado,
        falta_injustificada: faltaInjustificada,
        ferias,
        advertencia,
        suspensao,
        atestado_dias: atestadoDias,
        percentual_total: percentualTotal,
        observacao
      }

      if (modoEdicao && descontoEditando) {
        const { error } = await supabase
          .from('descontos')
          .update(dadosDesconto)
          .eq('id', descontoEditando.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('descontos')
          .insert(dadosDesconto)

        if (error) throw error
      }

      setDialogAberto(false)
      carregarDados()
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string }
      console.error('Erro ao salvar:', error)
      if (err?.code === '23505') {
        alert('Já existe um desconto para este colaborador neste mês/ano')
      } else if (err?.message) {
        alert(`Erro ao salvar desconto: ${err.message}`)
      } else {
        alert('Erro ao salvar desconto. Verifique se você tem permissão para esta filial.')
      }
    }
  }

  const abrirConfirmExcluir = (id: string) => {
    setIdExcluir(id)
    setConfirmExcluirOpen(true)
  }

  const executarExcluir = async () => {
    if (!idExcluir) return
    try {
      const { error } = await supabase
        .from('descontos')
        .delete()
        .eq('id', idExcluir)

      if (error) throw error
      carregarDados()
      setIdExcluir(null)
    } catch (error) {
      console.error('Erro ao deletar:', error)
      alert('Erro ao excluir desconto')
    }
  }

  const dadosPaginados = descontosFiltrados.slice(
    (paginaAtual - 1) * registrosPorPagina,
    paginaAtual * registrosPorPagina
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Descontos</h1>
          <p className="text-muted-foreground">
            Gerencie os descontos aplicados à produtividade
          </p>
        </div>
        <Button onClick={abrirNovo} className="bg-green-600 hover:bg-green-700">
          <Plus className="w-4 h-4 mr-2" />
          Novo Desconto
        </Button>
      </div>

      {/* Filtros */}
      <FilterToggle
        filtrosAtivos={contarFiltrosAtivos()}
        onLimparFiltros={limparFiltros}
      >
        <div className="space-y-4">
          {/* Linha 1 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Colaborador</Label>
              <Select value={filtroColaborador} onValueChange={setFiltroColaborador}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {colaboradores.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Filial</Label>
              <Select
                value={filtroFilial}
                onValueChange={setFiltroFilial}
                disabled={usuarioLogado?.tipo === 'colaborador'}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  {(usuarioLogado?.tipo === 'admin' || usuarioLogado?.tipo === 'gestor') && (
                    <SelectItem value="todas">Todas</SelectItem>
                  )}
                  {filiais.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {usuarioLogado?.tipo === 'colaborador' && (
                <p className="text-xs text-muted-foreground">
                  Fixado para sua filial
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Mês</Label>
              <Select value={filtroMes} onValueChange={setFiltroMes}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {meses.map(m => (
                    <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Matrícula</Label>
              <Input
                placeholder="Filtrar por matrícula..."
                value={filtroMatricula}
                onChange={(e) => setFiltroMatricula(e.target.value)}
              />
            </div>
          </div>

          {/* Linha 2 - Busca */}
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label>Busca</Label>
              <Input
                placeholder="Buscar por colaborador, observação..."
                value={filtroBusca}
                onChange={(e) => setFiltroBusca(e.target.value)}
              />
            </div>
          </div>

          {/* Linha 3 - Filtros Numéricos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Faltas</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={filtroFaltasMin}
                  onChange={(e) => setFiltroFaltasMin(e.target.value)}
                  min="0"
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={filtroFaltasMax}
                  onChange={(e) => setFiltroFaltasMax(e.target.value)}
                  min="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Advertências</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={filtroAdvertenciasMin}
                  onChange={(e) => setFiltroAdvertenciasMin(e.target.value)}
                  min="0"
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={filtroAdvertenciasMax}
                  onChange={(e) => setFiltroAdvertenciasMax(e.target.value)}
                  min="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Suspensões</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={filtroSuspensoesMin}
                  onChange={(e) => setFiltroSuspensoesMin(e.target.value)}
                  min="0"
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={filtroSuspensoesMax}
                  onChange={(e) => setFiltroSuspensoesMax(e.target.value)}
                  min="0"
                />
              </div>
            </div>
          </div>

          {/* Linha 4 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Atestado (dias)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={filtroAtestadoMin}
                  onChange={(e) => setFiltroAtestadoMin(e.target.value)}
                  min="0"
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={filtroAtestadoMax}
                  onChange={(e) => setFiltroAtestadoMax(e.target.value)}
                  min="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Férias (0=Não, 1=Sim)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={filtroFeriasMin}
                  onChange={(e) => setFiltroFeriasMin(e.target.value)}
                  min="0"
                  max="1"
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={filtroFeriasMax}
                  onChange={(e) => setFiltroFeriasMax(e.target.value)}
                  min="0"
                  max="1"
                />
              </div>
            </div>
          </div>
        </div>
      </FilterToggle>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Descontos</CardTitle>
          <CardDescription>
            {descontosFiltrados.length} desconto(s) encontrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Filial</TableHead>
                  <TableHead>Mês/Ano</TableHead>
                  <TableHead className="text-center">Faltas</TableHead>
                  <TableHead className="text-center">Férias</TableHead>
                  <TableHead className="text-center">Advertências</TableHead>
                  <TableHead className="text-center">Suspensões</TableHead>
                  <TableHead className="text-center">Atestado (dias)</TableHead>
                  <TableHead className="text-center">% Total</TableHead>
                  <TableHead>Observação</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : dadosPaginados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                      Nenhum desconto encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  dadosPaginados.map((desconto) => (
                    <TableRow key={desconto.id}>
                      <TableCell className="font-medium">{desconto.colaborador_nome}</TableCell>
                      <TableCell className="text-xs">{desconto.filial_nome}</TableCell>
                      <TableCell className="capitalize">
                        {desconto.mes}/{desconto.ano}
                      </TableCell>
                      <TableCell className="text-center">{desconto.falta_injustificada}</TableCell>
                      <TableCell className="text-center">
                        {desconto.ferias ? <Badge>Sim</Badge> : '-'}
                      </TableCell>
                      <TableCell className="text-center">{desconto.advertencia}</TableCell>
                      <TableCell className="text-center">{desconto.suspensao}</TableCell>
                      <TableCell className="text-center">{desconto.atestado_dias}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={desconto.percentual_total >= 50 ? 'destructive' : 'secondary'}>
                          {desconto.percentual_total}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs max-w-xs truncate">
                        {desconto.observacao || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => abrirEdicao(desconto)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => abrirConfirmExcluir(desconto.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Paginação */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Página {paginaAtual} de {totalPaginas}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
                  disabled={paginaAtual === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Anterior
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
                  disabled={paginaAtual === totalPaginas}
                >
                  Próxima
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        {dialogAberto && (
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{modoEdicao ? 'Editar' : 'Novo'} Desconto</DialogTitle>
              <DialogDescription>
                Preencha os dados do desconto que será aplicado na produtividade
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Colaborador *</Label>
                  <Select value={colaboradorSelecionado} onValueChange={setColaboradorSelecionado}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {colaboradores.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label>Mês *</Label>
                    <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
                      <SelectTrigger>
                        <SelectValue placeholder="Mês" />
                      </SelectTrigger>
                      <SelectContent>
                        {meses.map(m => (
                          <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Ano *</Label>
                    <Input
                      type="number"
                      value={anoSelecionado}
                      onChange={(e) => setAnoSelecionado(Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Faltas Injustificadas</Label>
                  <Input
                    type="number"
                    min="0"
                    value={faltaInjustificada}
                    onChange={(e) => setFaltaInjustificada(Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">100% de desconto</p>
                </div>
                <div className="space-y-2">
                  <Label>Advertências</Label>
                  <Input
                    type="number"
                    min="0"
                    value={advertencia}
                    onChange={(e) => setAdvertencia(Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">50% cada</p>
                </div>
                <div className="space-y-2">
                  <Label>Suspensões</Label>
                  <Input
                    type="number"
                    min="0"
                    value={suspensao}
                    onChange={(e) => setSuspensao(Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">100% cada</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Dias de Atestado</Label>
                  <Input
                    type="number"
                    min="0"
                    value={atestadoDias}
                    onChange={(e) => setAtestadoDias(Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Até 2d: 25%, 3-5d: 50%, 6-7d: 70%, +7d: 100%
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Checkbox checked={ferias} onCheckedChange={(checked) => setFerias(checked as boolean)} />
                    Férias
                  </Label>
                  <p className="text-xs text-muted-foreground">100% de desconto</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Observação</Label>
                <Input
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Adicione observações..."
                />
              </div>
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm font-medium">Desconto Total Calculado:</p>
                <p className="text-2xl font-bold text-amber-700">{calcularPercentualTotal()}%</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogAberto(false)}>
                Cancelar
              </Button>
              <Button onClick={() => setConfirmSalvarOpen(true)} className="bg-green-600 hover:bg-green-700">
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      <ConfirmDialog
        open={confirmSalvarOpen}
        onOpenChange={setConfirmSalvarOpen}
        title={modoEdicao ? 'Deseja realmente alterar?' : 'Deseja realmente salvar?'}
        message={modoEdicao ? 'As alterações serão aplicadas a este desconto.' : 'O novo desconto será cadastrado.'}
        onConfirm={salvar}
        confirmLabel="Sim"
        cancelLabel="Não"
      />
      <ConfirmDialog
        open={confirmExcluirOpen}
        onOpenChange={(open) => { setConfirmExcluirOpen(open); if (!open) setIdExcluir(null) }}
        title="Deseja realmente excluir?"
        message="Este desconto será removido."
        onConfirm={executarExcluir}
        confirmLabel="Sim"
        cancelLabel="Não"
      />
    </div>
  )
}
