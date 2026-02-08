'use client'

import { useEffect, useRef, useState } from 'react'
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
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Edit, Trash2, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'

interface DadoCarga {
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

export default function ProdutividadePage() {
  const [dados, setDados] = useState<DadoCarga[]>([])
  const [dadosFiltrados, setDadosFiltrados] = useState<DadoCarga[]>([])
  const [loading, setLoading] = useState(true)
  const [paginaAtual, setPaginaAtual] = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const registrosPorPagina = 50
  
  const [colaboradores, setColaboradores] = useState<any[]>([])
  const [filiais, setFiliais] = useState<any[]>([])
  
  // Filtros
  const [filtroFilial, setFiltroFilial] = useState('todas')
  const [filtroColaborador, setFiltroColaborador] = useState('todos')
  const [filtroBusca, setFiltroBusca] = useState('')

  // Dialog de edição
  const [dialogAberto, setDialogAberto] = useState(false)
  const [dadoEditando, setDadoEditando] = useState<DadoCarga | null>(null)
  const [colaboradorSelecionado, setColaboradorSelecionado] = useState('')
  const [horaInicial, setHoraInicial] = useState('')
  const [horaFinal, setHoraFinal] = useState('')
  const [erroSeparacao, setErroSeparacao] = useState(0)
  const [erroEntregas, setErroEntregas] = useState(0)
  const [observacao, setObservacao] = useState('')
  const dadosRef = useRef<DadoCarga[]>([])
  dadosRef.current = dados

  const supabase = createClient()

  function calcularTempo(hi: string | null, hf: string | null): number | null {
    if (!hi || !hf) return null
    const [h1, m1] = hi.split(':').map(Number)
    const [h2, m2] = hf.split(':').map(Number)
    const diff = (h2 * 60 + m2) - (h1 * 60 + m1)
    return diff > 0 ? diff / 60 : null
  }

  function atualizarLinhaLocal(idCargaCliente: string, updates: Partial<DadoCarga>) {
    setDados(prev =>
      prev.map(d =>
        d.id_carga_cliente === idCargaCliente ? { ...d, ...updates } : d
      )
    )
  }

  async function persistirLinha(idCargaCliente: string) {
    const row = dadosRef.current.find(d => d.id_carga_cliente === idCargaCliente)
    if (!row) return
    const tempoCalc = calcularTempo(row.hora_inicial, row.hora_final)
    const tempo = tempoCalc ?? row.tempo
    const kgHs =
      tempo != null && tempo > 0 ? row.peso_liquido_total / tempo : null
    const volHs =
      tempo != null && tempo > 0 ? row.volume_total / tempo : null
    const pltHs =
      tempo != null && tempo > 0 ? row.paletes_total / tempo : null
    const horaInicialDb = row.hora_inicial ? `${row.hora_inicial}:00`.slice(0, 8) : null
    const horaFinalDb = row.hora_final ? `${row.hora_final}:00`.slice(0, 8) : null
    const { error } = await supabase
      .from('dados_produtividade')
      .update({
        hora_inicial: horaInicialDb,
        hora_final: horaFinalDb,
        tempo,
        kg_hs: kgHs,
        vol_hs: volHs,
        plt_hs: pltHs,
        erro_separacao: row.erro_separacao,
        erro_entregas: row.erro_entregas,
        observacao: row.observacao ? row.observacao.toUpperCase() : null
      })
      .eq('id_carga_cliente', idCargaCliente)
    if (error) console.error('Erro ao salvar linha:', error)
    else if (tempoCalc != null && tempo !== row.tempo)
      atualizarLinhaLocal(idCargaCliente, { tempo: tempoCalc, kg_hs: kgHs, vol_hs: volHs, plt_hs: pltHs })
  }

  useEffect(() => {
    carregarDados()
    carregarColaboradores()
    carregarFiliais()
  }, [])

  useEffect(() => {
    aplicarFiltros()
  }, [dados, filtroFilial, filtroColaborador, filtroBusca])

  const carregarDados = async () => {
    setLoading(true)
    try {
      const { data: rows, error } = await supabase.rpc('get_produtividade_agrupado')

      if (error) {
        console.error('Erro ao carregar dados:', error)
        return
      }

      if (rows && rows.length > 0) {
        const mapRow = (r: Record<string, unknown>): DadoCarga => ({
          id_carga_cliente: String(r.id_carga_cliente ?? ''),
          carga: String(r.carga ?? ''),
          data_carga: r.data_carga != null ? String(r.data_carga).slice(0, 10) : '',
          filial: String(r.filial ?? ''),
          cliente: String(r.cliente ?? ''),
          colaborador: r.colaborador != null ? String(r.colaborador) : null,
          hora_inicial: r.hora_inicial != null ? String(r.hora_inicial).slice(0, 5) : null,
          hora_final: r.hora_final != null ? String(r.hora_final).slice(0, 5) : null,
          peso_liquido_total: Number(r.peso_liquido_total ?? 0),
          volume_total: Number(r.volume_total ?? 0),
          paletes_total: Number(r.paletes_total ?? 0),
          tempo: r.tempo != null ? Number(r.tempo) : null,
          kg_hs: r.kg_hs != null ? Number(r.kg_hs) : null,
          vol_hs: r.vol_hs != null ? Number(r.vol_hs) : null,
          plt_hs: r.plt_hs != null ? Number(r.plt_hs) : null,
          erro_separacao: Number(r.erro_separacao ?? 0),
          erro_entregas: Number(r.erro_entregas ?? 0),
          observacao: r.observacao != null ? String(r.observacao) : null
        })

        const ordenado = [...rows].sort(
          (a: Record<string, unknown>, b: Record<string, unknown>) =>
            String(b.carga).localeCompare(String(a.carga))
        )
        setDados(ordenado.map(mapRow))
      } else {
        setDados([])
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
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
    let filtrados = [...dados]

    if (filtroFilial && filtroFilial !== 'todas') {
      filtrados = filtrados.filter(d => d.filial.includes(filtroFilial))
    }

    if (filtroColaborador && filtroColaborador !== 'todos') {
      filtrados = filtrados.filter(d => d.colaborador === filtroColaborador)
    }

    if (filtroBusca) {
      const busca = filtroBusca.toLowerCase()
      filtrados = filtrados.filter(d =>
        d.carga.toLowerCase().includes(busca) ||
        d.cliente.toLowerCase().includes(busca) ||
        d.id_carga_cliente.toLowerCase().includes(busca)
      )
    }

    setDadosFiltrados(filtrados)
    setTotalPaginas(Math.ceil(filtrados.length / registrosPorPagina))
    setPaginaAtual(1)
  }

  const abrirEdicao = (dado: DadoCarga) => {
    setDadoEditando(dado)
    setColaboradorSelecionado(dado.colaborador || 'nenhum')
    setHoraInicial(dado.hora_inicial || '')
    setHoraFinal(dado.hora_final || '')
    setErroSeparacao(dado.erro_separacao)
    setErroEntregas(dado.erro_entregas)
    setObservacao((dado.observacao || '').toUpperCase())
    setDialogAberto(true)
  }

  const tempoCalculado =
    horaInicial && horaFinal
      ? (() => {
          const [h1, m1] = horaInicial.split(':').map(Number)
          const [h2, m2] = horaFinal.split(':').map(Number)
          const diff = (h2 * 60 + m2) - (h1 * 60 + m1)
          return diff > 0 ? (diff / 60).toFixed(1) : '-'
        })()
      : '-'

  const atribuirColaborador = async (dado: DadoCarga, nomeOuNull: string | null) => {
    const colaboradorObj = nomeOuNull ? colaboradores.find(c => c.nome === nomeOuNull) : null
    const { error } = await supabase
      .from('dados_produtividade')
      .update({
        colaborador: nomeOuNull,
        id_colaborador: colaboradorObj?.id ?? null
      })
      .eq('id_carga_cliente', dado.id_carga_cliente)
    if (error) {
      console.error('Erro ao atribuir colaborador:', error)
      return
    }
    setDados(prev =>
      prev.map(d =>
        d.id_carga_cliente === dado.id_carga_cliente
          ? { ...d, colaborador: nomeOuNull }
          : d
      )
    )
  }

  const salvarEdicao = async () => {
    if (!dadoEditando) return

    try {
      // Calcular tempo se houver hora inicial e final
      let tempo = dadoEditando.tempo
      let kgHs = dadoEditando.kg_hs
      let volHs = dadoEditando.vol_hs
      let pltHs = dadoEditando.plt_hs

      if (horaInicial && horaFinal) {
        const [h1, m1] = horaInicial.split(':').map(Number)
        const [h2, m2] = horaFinal.split(':').map(Number)
        tempo = ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60
        
        if (tempo > 0) {
          kgHs = dadoEditando.peso_liquido_total / tempo
          volHs = dadoEditando.volume_total / tempo
          pltHs = dadoEditando.paletes_total / tempo
        }
      }

      // Buscar colaborador para pegar o ID
      const nomeColaborador = colaboradorSelecionado === 'nenhum' ? null : colaboradorSelecionado
      const colaboradorObj = colaboradores.find(c => c.nome === nomeColaborador)

      const horaInicialDb = horaInicial ? `${horaInicial}:00`.slice(0, 8) : null
      const horaFinalDb = horaFinal ? `${horaFinal}:00`.slice(0, 8) : null

      const { error } = await supabase
        .from('dados_produtividade')
        .update({
          colaborador: nomeColaborador,
          id_colaborador: colaboradorObj?.id || null,
          hora_inicial: horaInicialDb,
          hora_final: horaFinalDb,
          tempo,
          kg_hs: kgHs,
          vol_hs: volHs,
          plt_hs: pltHs,
          erro_separacao: erroSeparacao,
          erro_entregas: erroEntregas,
          observacao: observacao.toUpperCase()
        })
        .eq('id_carga_cliente', dadoEditando.id_carga_cliente)

      if (error) throw error

      setDialogAberto(false)
      carregarDados()
    } catch (error) {
      console.error('Erro ao salvar:', error)
      alert('Erro ao salvar dados')
    }
  }

  const deletarDado = async (idCargaCliente: string) => {
    if (!confirm('Tem certeza que deseja excluir esta carga?')) return

    try {
      const { error } = await supabase
        .from('dados_produtividade')
        .delete()
        .eq('id_carga_cliente', idCargaCliente)

      if (error) throw error
      carregarDados()
    } catch (error) {
      console.error('Erro ao deletar:', error)
      alert('Erro ao excluir dados')
    }
  }

  const dadosPaginados = dadosFiltrados.slice(
    (paginaAtual - 1) * registrosPorPagina,
    paginaAtual * registrosPorPagina
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Produtividade</h1>
        <p className="text-muted-foreground">
          Visualize e gerencie os dados de produtividade por carga
        </p>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Filial</Label>
              <Select value={filtroFilial} onValueChange={setFiltroFilial}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {filiais.map(f => (
                    <SelectItem key={f.id} value={f.nome}>{f.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Colaborador</Label>
              <Select value={filtroColaborador} onValueChange={setFiltroColaborador}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {colaboradores.map(c => (
                    <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Busca</Label>
              <Input
                placeholder="Buscar por carga, cliente..."
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
          <CardTitle>Dados de Produtividade</CardTitle>
          <CardDescription>
            {dadosFiltrados.length} carga(s) encontrada(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID Carga</TableHead>
                  <TableHead>Carga</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Filial</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Hora Inicial</TableHead>
                  <TableHead>Hora Final</TableHead>
                  <TableHead className="text-right">Tempo</TableHead>
                  <TableHead className="text-right">Erros Sep.</TableHead>
                  <TableHead className="text-right">Erros Ent.</TableHead>
                  <TableHead className="max-w-[120px]">Observação</TableHead>
                  <TableHead className="text-right">Peso (kg)</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead className="text-right">Paletes</TableHead>
                  <TableHead className="text-right">Kg/Hs</TableHead>
                  <TableHead className="text-right">Vol/Hs</TableHead>
                  <TableHead className="text-right">Plt/Hs</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={19} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : dadosPaginados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={19} className="text-center py-8 text-muted-foreground">
                      Nenhum dado encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  dadosPaginados.map((dado) => (
                    <TableRow key={dado.id_carga_cliente}>
                      <TableCell className="font-mono text-xs">{dado.id_carga_cliente}</TableCell>
                      <TableCell className="font-medium">{dado.carga}</TableCell>
                      <TableCell>{new Date(dado.data_carga).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell className="text-xs">{dado.filial}</TableCell>
                      <TableCell className="text-xs max-w-xs truncate">{dado.cliente}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-1 min-w-[120px]">
                              {dado.colaborador || 'Não atribuído'}
                              <ChevronDown className="w-3 h-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem onClick={() => atribuirColaborador(dado, null)}>
                              Não atribuído
                            </DropdownMenuItem>
                            {colaboradores.map(c => (
                              <DropdownMenuItem
                                key={c.id}
                                onClick={() => atribuirColaborador(dado, c.nome)}
                              >
                                {c.nome}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          type="time"
                          className="h-8 w-[100px] text-xs"
                          value={dado.hora_inicial ?? ''}
                          onChange={(e) => {
                            const v = e.target.value || null
                            atualizarLinhaLocal(dado.id_carga_cliente, { hora_inicial: v })
                          }}
                          onBlur={() => persistirLinha(dado.id_carga_cliente)}
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          type="time"
                          className="h-8 w-[100px] text-xs"
                          value={dado.hora_final ?? ''}
                          onChange={(e) => {
                            const v = e.target.value || null
                            atualizarLinhaLocal(dado.id_carga_cliente, { hora_final: v })
                          }}
                          onBlur={() => persistirLinha(dado.id_carga_cliente)}
                        />
                      </TableCell>
                      <TableCell className="text-right p-1">
                        <Input
                          readOnly
                          className="h-8 w-14 text-xs text-right bg-muted border-muted"
                          placeholder="-"
                          value={
                            (() => {
                              const t = calcularTempo(dado.hora_inicial, dado.hora_final)
                              return t != null ? t.toFixed(1) : ''
                            })()
                          }
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          type="number"
                          min={0}
                          className="h-8 w-14 text-right text-xs"
                          value={dado.erro_separacao}
                          onChange={(e) =>
                            atualizarLinhaLocal(dado.id_carga_cliente, {
                              erro_separacao: Number(e.target.value) || 0
                            })
                          }
                          onBlur={() => persistirLinha(dado.id_carga_cliente)}
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          type="number"
                          min={0}
                          className="h-8 w-14 text-right text-xs"
                          value={dado.erro_entregas}
                          onChange={(e) =>
                            atualizarLinhaLocal(dado.id_carga_cliente, {
                              erro_entregas: Number(e.target.value) || 0
                            })
                          }
                          onBlur={() => persistirLinha(dado.id_carga_cliente)}
                        />
                      </TableCell>
                      <TableCell className="p-1 max-w-[140px]">
                        <Input
                          className="h-8 text-xs uppercase"
                          value={dado.observacao ?? ''}
                          onChange={(e) =>
                            atualizarLinhaLocal(dado.id_carga_cliente, {
                              observacao: e.target.value.toUpperCase() || null
                            })
                          }
                          onBlur={() => persistirLinha(dado.id_carga_cliente)}
                          placeholder="Observação"
                        />
                      </TableCell>
                      <TableCell className="text-right">{dado.peso_liquido_total.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{dado.volume_total.toFixed(0)}</TableCell>
                      <TableCell className="text-right">{dado.paletes_total.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{dado.kg_hs?.toFixed(2) || '-'}</TableCell>
                      <TableCell className="text-right">{dado.vol_hs?.toFixed(2) || '-'}</TableCell>
                      <TableCell className="text-right">{dado.plt_hs?.toFixed(2) || '-'}</TableCell>
                      <TableCell>
                        <div className="flex justify-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => abrirEdicao(dado)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deletarDado(dado.id_carga_cliente)}
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

      {/* Dialog de Edição */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Dados da Carga</DialogTitle>
            <DialogDescription>
              Carga: {dadoEditando?.carga} - {dadoEditando?.cliente}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Colaborador</Label>
                <Select value={colaboradorSelecionado} onValueChange={setColaboradorSelecionado}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Nenhum</SelectItem>
                    {colaboradores.map(c => (
                      <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hora Inicial</Label>
                <Input
                  type="time"
                  value={horaInicial}
                  onChange={(e) => setHoraInicial(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Hora Final</Label>
                <Input
                  type="time"
                  value={horaFinal}
                  onChange={(e) => setHoraFinal(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tempo (h)</Label>
              <Input readOnly value={tempoCalculado} className="bg-muted" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Erros de Separação</Label>
                <Input
                  type="number"
                  min="0"
                  value={erroSeparacao}
                  onChange={(e) => setErroSeparacao(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Erros de Entregas</Label>
                <Input
                  type="number"
                  min="0"
                  value={erroEntregas}
                  onChange={(e) => setErroEntregas(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observação</Label>
              <Input
                value={observacao}
                onChange={(e) => setObservacao(e.target.value.toUpperCase())}
                placeholder="Adicione observações (maiúsculas automático)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={salvarEdicao} className="bg-green-600 hover:bg-green-700">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
