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
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Edit, Trash2, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Desconto } from '@/types/database'

interface DescontoExtendido extends Desconto {
  colaborador_nome?: string
  filial_nome?: string
}

export default function DescontosPage() {
  const [descontos, setDescontos] = useState<DescontoExtendido[]>([])
  const [descontosFiltrados, setDescontosFiltrados] = useState<DescontoExtendido[]>([])
  const [colaboradores, setColaboradores] = useState<any[]>([])
  const [filiais, setFiliais] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const registrosPorPagina = 100
  
  // Filtros
  const [filtroColaborador, setFiltroColaborador] = useState('todos')
  const [filtroFilial, setFiltroFilial] = useState('todas')
  const [filtroMes, setFiltroMes] = useState('todos')
  const [filtroBusca, setFiltroBusca] = useState('')
  
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

  const supabase = createClient()

  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ]

  useEffect(() => {
    carregarDados()
    carregarColaboradores()
    carregarFiliais()
  }, [])

  useEffect(() => {
    aplicarFiltros()
  }, [descontos, filtroColaborador, filtroFilial, filtroMes, filtroBusca])

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

    if (filtroBusca) {
      const busca = filtroBusca.toLowerCase()
      filtrados = filtrados.filter(d =>
        d.colaborador_nome?.toLowerCase().includes(busca) ||
        d.observacao?.toLowerCase().includes(busca)
      )
    }

    setDescontosFiltrados(filtrados)
    setTotalPaginas(Math.ceil(filtrados.length / registrosPorPagina))
    setPaginaAtual(1)
  }

  const calcularPercentualTotal = () => {
    let percentual = 0
    
    // Regras de descontos baseadas nas imagens
    if (faltaInjustificada > 0) percentual += 100
    if (ferias) percentual += 100
    if (advertencia > 0) percentual += advertencia * 50
    if (suspensao > 0) percentual += suspensao * 100
    
    // Atestado
    if (atestadoDias > 0) {
      if (atestadoDias <= 2) percentual += 25
      else if (atestadoDias <= 5) percentual += 50
      else if (atestadoDias <= 7) percentual += 70
      else percentual += 100
    }

    return Math.min(percentual, 100) // Máximo 100%
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
    } catch (error: any) {
      console.error('Erro ao salvar:', error)
      if (error.code === '23505') {
        alert('Já existe um desconto para este colaborador neste mês/ano')
      } else {
        alert('Erro ao salvar desconto')
      }
    }
  }

  const deletar = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este desconto?')) return

    try {
      const { error } = await supabase
        .from('descontos')
        .delete()
        .eq('id', id)

      if (error) throw error
      carregarDados()
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
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
              <Select value={filtroFilial} onValueChange={setFiltroFilial}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {filiais.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <div className="space-y-2 md:col-span-2">
              <Label>Busca</Label>
              <Input
                placeholder="Buscar por colaborador, observação..."
                value={filtroBusca}
                onChange={(e) => setFiltroBusca(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

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
                            onClick={() => deletar(desconto.id)}
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
            <Button onClick={salvar} className="bg-green-600 hover:bg-green-700">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
