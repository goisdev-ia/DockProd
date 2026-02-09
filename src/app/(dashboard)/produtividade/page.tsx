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
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Edit, Trash2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChevronsUpDown, Columns3 } from 'lucide-react'
import { FilterToggle } from '@/components/FilterToggle'
import { registrarLog } from '@/lib/logs'

const COLUNAS_PADRAO: (keyof DadoCarga)[] = [
  'id_carga_cliente', 'carga', 'data_carga', 'filial', 'cliente', 'colaborador',
  'hora_inicial', 'hora_final', 'tempo', 'erro_separacao', 'erro_entregas', 'observacao',
  'peso_liquido_total', 'volume_total', 'paletes_total', 'kg_hs', 'vol_hs', 'plt_hs',
]

const COLUNAS_LABEL: Record<keyof DadoCarga, string> = {
  id_carga_cliente: 'ID Carga',
  carga: 'Carga',
  data_carga: 'Data',
  filial: 'Filial',
  cliente: 'Cliente',
  colaborador: 'Colaborador',
  hora_inicial: 'Hora Inicial',
  hora_final: 'Hora Final',
  tempo: 'Tempo',
  erro_separacao: 'Erros Sep.',
  erro_entregas: 'Erros Ent.',
  observacao: 'Observação',
  peso_liquido_total: 'Peso (kg)',
  volume_total: 'Volume',
  paletes_total: 'Paletes',
  kg_hs: 'Kg/Hs',
  vol_hs: 'Vol/Hs',
  plt_hs: 'Plt/Hs',
}

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
  
  const [colaboradores, setColaboradores] = useState<{ id: string; nome: string; matricula?: string; [key: string]: unknown }[]>([])
  const [filiais, setFiliais] = useState<{ id: string; nome: string; [key: string]: unknown }[]>([])
  const [usuarioLogado, setUsuarioLogado] = useState<{ tipo: string; id_filial: string | null } | null>(null)
  
  // Filtros
  const [filtroFilial, setFiltroFilial] = useState('todas')
  const [filtroColaborador, setFiltroColaborador] = useState('todos')
  const [filtroBusca, setFiltroBusca] = useState('')
  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroTempoMin, setFiltroTempoMin] = useState('')
  const [filtroTempoMax, setFiltroTempoMax] = useState('')
  const [filtroErrosSepMin, setFiltroErrosSepMin] = useState('')
  const [filtroErrosSepMax, setFiltroErrosSepMax] = useState('')
  const [filtroErrosEntMin, setFiltroErrosEntMin] = useState('')
  const [filtroErrosEntMax, setFiltroErrosEntMax] = useState('')
  const [filtroKgHsMin, setFiltroKgHsMin] = useState('')
  const [filtroKgHsMax, setFiltroKgHsMax] = useState('')
  const [filtroVolHsMin, setFiltroVolHsMin] = useState('')
  const [filtroVolHsMax, setFiltroVolHsMax] = useState('')
  const [filtroPltHsMin, setFiltroPltHsMin] = useState('')
  const [filtroPltHsMax, setFiltroPltHsMax] = useState('')
  const [filtroIdCarga, setFiltroIdCarga] = useState('')
  const [filtroMatricula, setFiltroMatricula] = useState('')
  const [buscaDebounced, setBuscaDebounced] = useState('')
  const [clienteDebounced, setClienteDebounced] = useState('')
  const [idCargaDebounced, setIdCargaDebounced] = useState('')
  const [matriculaDebounced, setMatriculaDebounced] = useState('')

  // Dialog de edição
  const [dialogAberto, setDialogAberto] = useState(false)
  const [dadoEditando, setDadoEditando] = useState<DadoCarga | null>(null)
  const [colaboradorSelecionado, setColaboradorSelecionado] = useState('')
  const [horaInicial, setHoraInicial] = useState('')
  const [horaFinal, setHoraFinal] = useState('')
  const [erroSeparacao, setErroSeparacao] = useState(0)
  const [erroEntregas, setErroEntregas] = useState(0)
  const [observacao, setObservacao] = useState('')
  const [confirmSalvarOpen, setConfirmSalvarOpen] = useState(false)
  const [confirmExcluirOpen, setConfirmExcluirOpen] = useState(false)
  const [idExcluir, setIdExcluir] = useState<string | null>(null)
  const [ordenacao, setOrdenacao] = useState<{ coluna: keyof DadoCarga | null; direcao: 'asc' | 'desc' }>({ coluna: null, direcao: 'asc' })
  const [colunasVisiveis, setColunasVisiveis] = useState<string[]>(COLUNAS_PADRAO as string[])
  const dadosRef = useRef<DadoCarga[]>([])
  dadosRef.current = dados

  const supabase = createClient()

  function calcularTempo(hi: string | null, hf: string | null): number | null {
    if (!hi || !hf) return null
    const [h1, m1] = hi.split(':').map(Number)
    const [h2, m2] = hf.split(':').map(Number)
    
    const minutosIniciais = h1 * 60 + m1
    let minutosFinais = h2 * 60 + m2

    // Se hora final é menor que inicial, houve virada de dia
    if (minutosFinais < minutosIniciais) {
      minutosFinais += 24 * 60 // Adiciona 24 horas em minutos
    }

    const diferencaMinutos = minutosFinais - minutosIniciais
    const horasDecimais = diferencaMinutos / 60
    
    return Math.round(horasDecimais * 100) / 100 // Arredonda para 2 casas decimais
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
    else {
      if (tempoCalc != null && tempo !== row.tempo)
        atualizarLinhaLocal(idCargaCliente, { tempo: tempoCalc, kg_hs: kgHs, vol_hs: volHs, plt_hs: pltHs })
      registrarLog(supabase, 'Editou produtividade (carga)')
    }
  }

  useEffect(() => {
    carregarUsuarioLogado()
    carregarDados()
    carregarColaboradores()
    carregarFiliais()
  }, [])

  useEffect(() => {
    const carregarPreferencias = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('usuario_preferencias')
        .select('colunas_produtividade')
        .eq('id_usuario', user.id)
        .single()
      if (data?.colunas_produtividade && Array.isArray(data.colunas_produtividade)) {
        setColunasVisiveis(data.colunas_produtividade as string[])
      }
    }
    carregarPreferencias()
  }, [])

  const salvarPreferenciasColunas = async (novasColunas: string[]) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase
      .from('usuario_preferencias')
      .upsert({ id_usuario: user.id, colunas_produtividade: novasColunas }, { onConflict: 'id_usuario' })
  }

  const toggleColunaVisivel = (coluna: string) => {
    const proximo = colunasVisiveis.includes(coluna)
      ? colunasVisiveis.filter((c) => c !== coluna)
      : [...colunasVisiveis, coluna]
    setColunasVisiveis(proximo)
    salvarPreferenciasColunas(proximo)
  }

  // Quando o usuário logado E as filiais estiverem carregados, fixar o filtro
  useEffect(() => {
    if (usuarioLogado?.tipo === 'colaborador' && usuarioLogado.id_filial && filiais.length > 0) {
      const filialObj = filiais.find((f) => f.id === usuarioLogado.id_filial)
      if (filialObj) {
        setFiltroFilial(filialObj.nome)
      }
    }
  }, [usuarioLogado, filiais])

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
      }
    }
  }

  // Debounce para inputs de texto
  useEffect(() => {
    const timer = setTimeout(() => setBuscaDebounced(filtroBusca), 300)
    return () => clearTimeout(timer)
  }, [filtroBusca])

  useEffect(() => {
    const timer = setTimeout(() => setClienteDebounced(filtroCliente), 300)
    return () => clearTimeout(timer)
  }, [filtroCliente])

  useEffect(() => {
    const timer = setTimeout(() => setIdCargaDebounced(filtroIdCarga), 300)
    return () => clearTimeout(timer)
  }, [filtroIdCarga])

  useEffect(() => {
    const timer = setTimeout(() => setMatriculaDebounced(filtroMatricula), 300)
    return () => clearTimeout(timer)
  }, [filtroMatricula])

  useEffect(() => {
    aplicarFiltros()
  }, [dados, filtroFilial, filtroColaborador, buscaDebounced, filtroDataInicio, filtroDataFim, clienteDebounced, filtroTempoMin, filtroTempoMax, filtroErrosSepMin, filtroErrosSepMax, filtroErrosEntMin, filtroErrosEntMax, filtroKgHsMin, filtroKgHsMax, filtroVolHsMin, filtroVolHsMax, filtroPltHsMin, filtroPltHsMax, idCargaDebounced, matriculaDebounced])

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

    if (buscaDebounced) {
      const busca = buscaDebounced.toLowerCase()
      filtrados = filtrados.filter(d =>
        d.carga.toLowerCase().includes(busca) ||
        d.cliente.toLowerCase().includes(busca) ||
        d.id_carga_cliente.toLowerCase().includes(busca)
      )
    }

    if (filtroDataInicio) {
      filtrados = filtrados.filter(d => d.data_carga >= filtroDataInicio)
    }

    if (filtroDataFim) {
      filtrados = filtrados.filter(d => d.data_carga <= filtroDataFim)
    }

    if (clienteDebounced) {
      const cliente = clienteDebounced.toLowerCase()
      filtrados = filtrados.filter(d => d.cliente.toLowerCase().includes(cliente))
    }

    if (filtroTempoMin !== '') {
      const min = Number(filtroTempoMin)
      filtrados = filtrados.filter(d => d.tempo !== null && d.tempo >= min)
    }

    if (filtroTempoMax !== '') {
      const max = Number(filtroTempoMax)
      filtrados = filtrados.filter(d => d.tempo !== null && d.tempo <= max)
    }

    if (filtroErrosSepMin !== '') {
      const min = Number(filtroErrosSepMin)
      filtrados = filtrados.filter(d => d.erro_separacao >= min)
    }

    if (filtroErrosSepMax !== '') {
      const max = Number(filtroErrosSepMax)
      filtrados = filtrados.filter(d => d.erro_separacao <= max)
    }

    if (filtroErrosEntMin !== '') {
      const min = Number(filtroErrosEntMin)
      filtrados = filtrados.filter(d => d.erro_entregas >= min)
    }

    if (filtroErrosEntMax !== '') {
      const max = Number(filtroErrosEntMax)
      filtrados = filtrados.filter(d => d.erro_entregas <= max)
    }

    if (filtroKgHsMin !== '') {
      const min = Number(filtroKgHsMin)
      filtrados = filtrados.filter(d => d.kg_hs !== null && d.kg_hs >= min)
    }

    if (filtroKgHsMax !== '') {
      const max = Number(filtroKgHsMax)
      filtrados = filtrados.filter(d => d.kg_hs !== null && d.kg_hs <= max)
    }

    if (filtroVolHsMin !== '') {
      const min = Number(filtroVolHsMin)
      filtrados = filtrados.filter(d => d.vol_hs !== null && d.vol_hs >= min)
    }

    if (filtroVolHsMax !== '') {
      const max = Number(filtroVolHsMax)
      filtrados = filtrados.filter(d => d.vol_hs !== null && d.vol_hs <= max)
    }

    if (filtroPltHsMin !== '') {
      const min = Number(filtroPltHsMin)
      filtrados = filtrados.filter(d => d.plt_hs !== null && d.plt_hs >= min)
    }

    if (filtroPltHsMax !== '') {
      const max = Number(filtroPltHsMax)
      filtrados = filtrados.filter(d => d.plt_hs !== null && d.plt_hs <= max)
    }

    if (idCargaDebounced) {
      const idCarga = idCargaDebounced.toLowerCase()
      filtrados = filtrados.filter(d => d.id_carga_cliente.toLowerCase().includes(idCarga))
    }

    if (matriculaDebounced) {
      const matricula = matriculaDebounced.toLowerCase()
      filtrados = filtrados.filter(d => {
        const colaboradorObj = colaboradores.find(c => c.nome === d.colaborador)
        return colaboradorObj?.matricula?.toLowerCase().includes(matricula)
      })
    }

    setDadosFiltrados(filtrados)
    setTotalPaginas(Math.ceil(filtrados.length / registrosPorPagina))
    setPaginaAtual(1)
  }

  const limparFiltros = () => {
    setFiltroFilial('todas')
    setFiltroColaborador('todos')
    setFiltroBusca('')
    setFiltroDataInicio('')
    setFiltroDataFim('')
    setFiltroCliente('')
    setFiltroTempoMin('')
    setFiltroTempoMax('')
    setFiltroErrosSepMin('')
    setFiltroErrosSepMax('')
    setFiltroErrosEntMin('')
    setFiltroErrosEntMax('')
    setFiltroKgHsMin('')
    setFiltroKgHsMax('')
    setFiltroVolHsMin('')
    setFiltroVolHsMax('')
    setFiltroPltHsMin('')
    setFiltroPltHsMax('')
    setFiltroIdCarga('')
    setFiltroMatricula('')
  }

  const contarFiltrosAtivos = () => {
    let count = 0
    if (filtroFilial !== 'todas') count++
    if (filtroColaborador !== 'todos') count++
    if (filtroBusca) count++
    if (filtroDataInicio) count++
    if (filtroDataFim) count++
    if (filtroCliente) count++
    if (filtroTempoMin) count++
    if (filtroTempoMax) count++
    if (filtroErrosSepMin) count++
    if (filtroErrosSepMax) count++
    if (filtroErrosEntMin) count++
    if (filtroErrosEntMax) count++
    if (filtroKgHsMin) count++
    if (filtroKgHsMax) count++
    if (filtroVolHsMin) count++
    if (filtroVolHsMax) count++
    if (filtroPltHsMin) count++
    if (filtroPltHsMax) count++
    if (filtroIdCarga) count++
    if (filtroMatricula) count++
    return count
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

          const minutosIniciais = h1 * 60 + m1
          let minutosFinais = h2 * 60 + m2

          // Se hora final é menor que inicial, houve virada de dia
          if (minutosFinais < minutosIniciais) {
            minutosFinais += 24 * 60 // Adiciona 24 horas em minutos
          }
          
          const diferencaMinutos = minutosFinais - minutosIniciais
          const horasDecimais = diferencaMinutos / 60
          
          return horasDecimais > 0 ? horasDecimais.toFixed(1) : '-'
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

        const minutosIniciais = h1 * 60 + m1
        let minutosFinais = h2 * 60 + m2

        // Se hora final é menor que inicial, houve virada de dia
        if (minutosFinais < minutosIniciais) {
          minutosFinais += 24 * 60 // Adiciona 24 horas em minutos
        }
        
        tempo = (minutosFinais - minutosIniciais) / 60
        tempo = Math.round(tempo * 100) / 100 // Arredonda para 2 casas decimais
        
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

  const abrirConfirmExcluir = (idCargaCliente: string) => {
    setIdExcluir(idCargaCliente)
    setConfirmExcluirOpen(true)
  }

  const executarExcluir = async () => {
    if (!idExcluir) return
    try {
      const { error } = await supabase
        .from('dados_produtividade')
        .delete()
        .eq('id_carga_cliente', idExcluir)

      if (error) throw error
      registrarLog(supabase, 'Deletou carga da produtividade')
      carregarDados()
      setIdExcluir(null)
    } catch (error) {
      console.error('Erro ao deletar:', error)
      alert('Erro ao excluir dados')
    }
  }

  const dadosOrdenados = (() => {
    if (!ordenacao.coluna) return [...dadosFiltrados]
    const sorted = [...dadosFiltrados]
    const col = ordenacao.coluna
    const dir = ordenacao.direcao === 'asc' ? 1 : -1
    sorted.sort((a, b) => {
      const va = a[col]
      const vb = b[col]
      if (va == null && vb == null) return 0
      if (va == null) return dir
      if (vb == null) return -dir
      if (typeof va === 'number' && typeof vb === 'number') return dir * (va - vb)
      if (typeof va === 'string' && typeof vb === 'string') return dir * va.localeCompare(vb)
      return dir * String(va).localeCompare(String(vb))
    })
    return sorted
  })()

  const dadosPaginados = dadosOrdenados.slice(
    (paginaAtual - 1) * registrosPorPagina,
    paginaAtual * registrosPorPagina
  )

  const toggleOrdenacao = (coluna: keyof DadoCarga) => {
    setOrdenacao(prev =>
      prev.coluna === coluna
        ? { coluna, direcao: prev.direcao === 'asc' ? 'desc' : 'asc' }
        : { coluna, direcao: 'asc' }
    )
    setPaginaAtual(1)
  }

  const SortableHead = ({ coluna, children, className }: { coluna: keyof DadoCarga; children: React.ReactNode; className?: string }) => (
    <TableHead
      className={className}
      onClick={() => toggleOrdenacao(coluna)}
    >
      <div className="flex items-center gap-1 cursor-pointer select-none hover:opacity-80">
        {children}
        {ordenacao.coluna === coluna ? (
          ordenacao.direcao === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        )}
      </div>
    </TableHead>
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
      <FilterToggle
        filtrosAtivos={contarFiltrosAtivos()}
        onLimparFiltros={limparFiltros}
      >
          <div className="space-y-4">
            {/* Linha 1 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                    {usuarioLogado?.tipo === 'admin' && (
                      <SelectItem value="todas">Todas</SelectItem>
                    )}
                    {filiais.map(f => (
                      <SelectItem key={f.id} value={f.nome}>{f.nome}</SelectItem>
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
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={filtroDataInicio}
                  onChange={(e) => setFiltroDataInicio(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={filtroDataFim}
                  onChange={(e) => setFiltroDataFim(e.target.value)}
                />
              </div>
            </div>

            {/* Linha 2 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Busca Geral</Label>
                <Input
                  placeholder="Buscar por carga, cliente..."
                  value={filtroBusca}
                  onChange={(e) => setFiltroBusca(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Input
                  placeholder="Filtrar por cliente..."
                  value={filtroCliente}
                  onChange={(e) => setFiltroCliente(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>ID Carga</Label>
                <Input
                  placeholder="Filtrar por ID..."
                  value={filtroIdCarga}
                  onChange={(e) => setFiltroIdCarga(e.target.value)}
                />
              </div>
            </div>

            {/* Linha 3 - Ranges */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Tempo (h)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filtroTempoMin}
                    onChange={(e) => setFiltroTempoMin(e.target.value)}
                    step="0.1"
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filtroTempoMax}
                    onChange={(e) => setFiltroTempoMax(e.target.value)}
                    step="0.1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Erros Sep.</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filtroErrosSepMin}
                    onChange={(e) => setFiltroErrosSepMin(e.target.value)}
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filtroErrosSepMax}
                    onChange={(e) => setFiltroErrosSepMax(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Erros Ent.</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filtroErrosEntMin}
                    onChange={(e) => setFiltroErrosEntMin(e.target.value)}
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filtroErrosEntMax}
                    onChange={(e) => setFiltroErrosEntMax(e.target.value)}
                  />
                </div>
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

            {/* Linha 4 - Métricas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Kg/Hs</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filtroKgHsMin}
                    onChange={(e) => setFiltroKgHsMin(e.target.value)}
                    step="0.1"
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filtroKgHsMax}
                    onChange={(e) => setFiltroKgHsMax(e.target.value)}
                    step="0.1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Vol/Hs</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filtroVolHsMin}
                    onChange={(e) => setFiltroVolHsMin(e.target.value)}
                    step="0.1"
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filtroVolHsMax}
                    onChange={(e) => setFiltroVolHsMax(e.target.value)}
                    step="0.1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Plt/Hs</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filtroPltHsMin}
                    onChange={(e) => setFiltroPltHsMin(e.target.value)}
                    step="0.1"
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filtroPltHsMax}
                    onChange={(e) => setFiltroPltHsMax(e.target.value)}
                    step="0.1"
                  />
                </div>
              </div>
            </div>
          </div>
      </FilterToggle>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Dados de Produtividade</CardTitle>
              <CardDescription>
                {dadosFiltrados.length} carga(s) encontrada(s)
              </CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Columns3 className="h-4 w-4" />
                  Colunas
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 max-h-80 overflow-y-auto">
                {COLUNAS_PADRAO.map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col}
                    checked={colunasVisiveis.includes(col)}
                    onCheckedChange={() => toggleColunaVisivel(col)}
                  >
                    {COLUNAS_LABEL[col]}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {colunasVisiveis.map((col) => {
                    const key = col as keyof DadoCarga
                    const label = COLUNAS_LABEL[key]
                    const isSortable = ['hora_inicial', 'hora_final', 'observacao'].includes(col)
                      ? false
                      : true
                    return isSortable ? (
                      <SortableHead key={col} coluna={key} className={['tempo', 'erro_separacao', 'erro_entregas', 'peso_liquido_total', 'volume_total', 'paletes_total', 'kg_hs', 'vol_hs', 'plt_hs'].includes(col) ? 'text-right' : undefined}>
                        {label}
                      </SortableHead>
                    ) : (
                      <TableHead key={col} className={col === 'observacao' ? 'max-w-[120px]' : undefined}>{label}</TableHead>
                    )
                  })}
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={colunasVisiveis.length + 1} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : dadosPaginados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={colunasVisiveis.length + 1} className="text-center py-8 text-muted-foreground">
                      Nenhum dado encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  dadosPaginados.map((dado) => (
                    <TableRow key={dado.id_carga_cliente}>
                      {colunasVisiveis.map((col) => {
                        const key = col as keyof DadoCarga
                        const val = dado[key]
                        if (key === 'colaborador') {
                          return (
                            <TableCell key={col}>
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
                          )
                        }
                        if (key === 'hora_inicial') {
                          return (
                            <TableCell key={col} className="p-1">
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
                          )
                        }
                        if (key === 'hora_final') {
                          return (
                            <TableCell key={col} className="p-1">
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
                          )
                        }
                        if (key === 'tempo') {
                          const t = calcularTempo(dado.hora_inicial, dado.hora_final)
                          return (
                            <TableCell key={col} className="text-right p-1">
                              <Input
                                readOnly
                                className="h-8 w-14 text-xs text-right bg-muted border-muted"
                                placeholder="-"
                                value={t != null ? t.toFixed(1) : ''}
                              />
                            </TableCell>
                          )
                        }
                        if (key === 'erro_separacao') {
                          return (
                            <TableCell key={col} className="p-1">
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
                          )
                        }
                        if (key === 'erro_entregas') {
                          return (
                            <TableCell key={col} className="p-1">
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
                          )
                        }
                        if (key === 'observacao') {
                          return (
                            <TableCell key={col} className="p-1 max-w-[140px]">
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
                          )
                        }
                        const isRight = ['peso_liquido_total', 'volume_total', 'paletes_total', 'kg_hs', 'vol_hs', 'plt_hs', 'tempo', 'erro_separacao', 'erro_entregas'].includes(col)
                        const cn = key === 'id_carga_cliente' ? 'font-mono text-xs' : key === 'carga' ? 'font-medium' : key === 'filial' || key === 'cliente' ? 'text-xs max-w-xs truncate' : isRight ? 'text-right' : ''
                        const display = key === 'data_carga' && val ? new Date(String(val)).toLocaleDateString('pt-BR') : typeof val === 'number' && val != null ? (key === 'peso_liquido_total' || key === 'paletes_total' ? Number(val).toFixed(2) : key === 'volume_total' ? Number(val).toFixed(0) : key === 'kg_hs' || key === 'vol_hs' || key === 'plt_hs' ? (Number(val).toFixed(2) || '-') : String(val)) : val != null ? String(val) : '-'
                        return (
                          <TableCell key={col} className={cn}>
                            {display}
                          </TableCell>
                        )
                      })}
                      <TableCell>
                        <div className="flex justify-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => abrirEdicao(dado)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => abrirConfirmExcluir(dado.id_carga_cliente)}>
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
        {dialogAberto && (
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
        title="Deseja realmente alterar?"
        message="As alterações serão aplicadas a este registro."
        onConfirm={salvarEdicao}
        confirmLabel="Sim"
        cancelLabel="Não"
      />
      <ConfirmDialog
        open={confirmExcluirOpen}
        onOpenChange={(open) => { setConfirmExcluirOpen(open); if (!open) setIdExcluir(null) }}
        title="Deseja realmente excluir?"
        message="Esta carga será removida."
        onConfirm={executarExcluir}
        confirmLabel="Sim"
        cancelLabel="Não"
      />
    </div>
  )
}
