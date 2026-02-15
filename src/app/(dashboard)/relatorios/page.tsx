'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { FileText, Download, FileSpreadsheet, MessageSquare, FileDown, Share2, Loader2, Copy } from 'lucide-react'
import { FilterToggle } from '@/components/FilterToggle'
import { toast } from 'sonner'
import {
  fetchReportData,
  fetchEvolucaoTemporal,
  fetchReportDescontos,
  fetchReportResultados,
  fetchReportDadosPorColeta,
  fetchAllDadosProdutividade,
  exportCSV,
  type FechamentoLinha,
  type FiltrosDadosGerais,
} from '@/lib/relatorios'
import { filterOutNaoInformado } from '@/lib/nao-informado'
import { gerarRelatorioPDF, gerarRelatorioPDFDadosGerais } from '@/lib/relatorios/pdfGenerator'
import { gerarRelatorioHTML } from '@/lib/relatorios/htmlGenerator'
import { gerarRelatorioXLSX, gerarRelatorioXLSXDadosGerais } from '@/lib/relatorios/xlsxGenerator'
import { gerarRelatorioWhatsApp, compartilharWhatsApp, copiarParaClipboard, type ResumoDescontoItem, type ErroSeparacaoItem, type ErroEntregaItem } from '@/lib/relatorios/whatsappGenerator'
import { createClient } from '@/lib/supabase/client'
import type { Desconto } from '@/types/database'
import { calcularValorAcuracidade, calcularValorChecklist, calcularValorPltHsPorFilial, calcularValorPerda } from '@/lib/calculos'

export default function RelatoriosPage() {
  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  ]
  const [mesSelecionado, setMesSelecionado] = useState<string>(meses[new Date().getMonth()] ?? 'janeiro')
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear())
  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')
  const [tipoRelatorio, setTipoRelatorio] = useState('completo')
  const [loading, setLoading] = useState(false)
  const [loadingType, setLoadingType] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  
  // Filtros adicionais
  const [filtroColaborador, setFiltroColaborador] = useState('todos')
  const [filtroFilial, setFiltroFilial] = useState('todas')
  const [filtroMatricula, setFiltroMatricula] = useState('')
  const [filtroBusca, setFiltroBusca] = useState('')
  const [colaboradores, setColaboradores] = useState<{ id: string; nome: string; matricula?: string; funcao?: string | null }[]>([])
  const [filiais, setFiliais] = useState<{ id: string; nome: string; codigo?: string }[]>([])

  // WhatsApp dialog
  const [showWhatsAppDialog, setShowWhatsAppDialog] = useState(false)
  const [whatsAppData, setWhatsAppData] = useState<FechamentoLinha[]>([])
  const [whatsAppColabIdx, setWhatsAppColabIdx] = useState(0)
  /** Mapa id_colaborador|mes|ano -> Desconto para resumo na mensagem */
  const [whatsAppDescontosMap, setWhatsAppDescontosMap] = useState<Record<string, Desconto | null>>({})
  /** Mapa id_colaborador|mes|ano -> detalhe erros (separação e entregas + observação) */
  const [whatsAppErrosMap, setWhatsAppErrosMap] = useState<Record<string, { errosSeparacao: ErroSeparacaoItem[]; errosEntregas: ErroEntregaItem[] }>>({})
  /** Mapa id_colaborador|id_filial -> resultados DockProd (acuracidade, checklist, perda, vlr_*) */
  const [whatsAppResultadosMap, setWhatsAppResultadosMap] = useState<Record<string, { acuracidade: number | null; checklist: number | null; perda: number | null; vlr_acuracidade: number; vlr_checklist: number; vlr_plt_hs: number; vlr_perda: number }>>({})

  // User info
  const [usuarioLogado, setUsuarioLogado] = useState<{ nome: string; tipo: string; id_filial: string | null } | null>(null)

  const supabase = createClient()

  // Load user and dynamic filter data
  useEffect(() => {
    const carregar = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: userData } = await supabase
          .from('usuarios')
          .select('nome, tipo, id_filial')
          .eq('id', user.id)
          .single()
        if (userData) {
          setUsuarioLogado({
            nome: userData.nome || user.email || '',
            tipo: userData.tipo || 'colaborador',
            id_filial: userData.id_filial,
          })
        }
      }
      
      const { data: filiaisData } = await supabase.from('filiais').select('id, nome, codigo').eq('ativo', true).order('nome')
      if (filiaisData) setFiliais(filiaisData)

      const { data: colabsData } = await supabase.from('colaboradores').select('id, nome, matricula, funcao').eq('ativo', true).order('nome')
      if (colabsData) setColaboradores(colabsData)
    }
    carregar()
  }, [])

  // Se o usuário é colaborador, travar a filial automaticamente
  useEffect(() => {
    if (usuarioLogado && usuarioLogado.tipo === 'colaborador' && usuarioLogado.id_filial) {
      setFiltroFilial(usuarioLogado.id_filial)
    }
  }, [usuarioLogado])

  const buscarDadosFiltrados = useCallback(async (): Promise<FechamentoLinha[]> => {
    let data = await fetchReportData(mesSelecionado, anoSelecionado)

    // Apply client-side filters
    if (filtroColaborador !== 'todos') {
      data = data.filter(r => r.id_colaborador === filtroColaborador)
    }
    if (filtroFilial !== 'todas') {
      data = data.filter(r => r.id_filial === filtroFilial)
    }
    if (filtroMatricula.trim()) {
      // Filter data by matricula would require joining, so we filter by name match
      data = data.filter(r => r.colaborador_nome.toLowerCase().includes(filtroMatricula.toLowerCase()))
    }
    if (filtroBusca.trim()) {
      const busca = filtroBusca.toLowerCase()
      data = data.filter(r =>
        r.colaborador_nome.toLowerCase().includes(busca) ||
        r.filial_nome.toLowerCase().includes(busca)
      )
    }

    return filterOutNaoInformado(data, (r) => r.colaborador_nome)
  }, [mesSelecionado, anoSelecionado, filtroColaborador, filtroFilial, filtroMatricula, filtroBusca])

  const filialNomeSelecionada = filiais.find(f => f.id === filtroFilial)?.nome || 'Todas'

  useEffect(() => {
    if (filtroDataInicio && filtroDataFim && filtroDataInicio.length >= 10) {
      const [y, m] = filtroDataInicio.slice(0, 10).split('-').map(Number)
      if (!isNaN(y) && !isNaN(m) && m >= 1 && m <= 12) {
        setMesSelecionado(meses[m - 1] ?? meses[0])
        setAnoSelecionado(y)
      }
    }
  }, [filtroDataInicio, filtroDataFim])

  // Primeiro e último dia do mês em horário local (evita timezone: 01/01 local não vira 31/12 UTC)
  function toISODateLocal(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  function getIntervaloMes(mes: string, ano: number): { dataInicio: string; dataFim: string } {
    const idx = meses.indexOf(mes)
    const monthIndex = idx >= 0 ? idx : 0
    const primeiro = new Date(ano, monthIndex, 1)
    const ultimo = new Date(ano, monthIndex + 1, 0)
    return {
      dataInicio: toISODateLocal(primeiro),
      dataFim: toISODateLocal(ultimo),
    }
  }
  function getIntervaloEfetivo(): { dataInicio: string; dataFim: string } {
    if (filtroDataInicio && filtroDataFim) {
      return { dataInicio: filtroDataInicio.slice(0, 10), dataFim: filtroDataFim.slice(0, 10) }
    }
    return getIntervaloMes(mesSelecionado, anoSelecionado)
  }

  function formatarDataBR(iso: string): string {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  }

  // Buscar descontos, resultados DockProd e detalhe de erros ao abrir o dialog WhatsApp
  useEffect(() => {
    if (!showWhatsAppDialog || whatsAppData.length === 0) return
    const ids = [...new Set(whatsAppData.map(r => r.id_colaborador))]
    const mesesUnicos = [...new Set(whatsAppData.map(r => r.mes))]
    const anosUnicos = [...new Set(whatsAppData.map(r => r.ano))]
    const fetchResultados = async () => {
      const map: Record<string, { acuracidade: number | null; checklist: number | null; perda: number | null; vlr_acuracidade: number; vlr_checklist: number; vlr_plt_hs: number; vlr_perda: number }> = {}
      const { data: filiaisData } = await supabase.from('filiais').select('id, codigo')
      const codigoPorFilial = Object.fromEntries((filiaisData ?? []).map((f: { id: string; codigo?: string }) => [f.id, f.codigo ?? '']))
      for (const mes of mesesUnicos) {
        const { data } = await supabase
          .from('resultados')
          .select('id_colaborador, id_filial, mes, acuracidade, checklist, plt_hs, perda, colaboradores (funcao)')
          .eq('mes', mes)
          .in('id_colaborador', ids)
        for (const r of data ?? []) {
          const key = `${r.id_colaborador}|${r.id_filial}`
          const acu = r.acuracidade != null ? Number(r.acuracidade) : null
          const chk = r.checklist != null ? Number(r.checklist) : null
          const perd = r.perda != null ? Number(r.perda) : null
          const pltHs = Number(r.plt_hs ?? 0)
          const funcao = (r.colaboradores as { funcao?: string } | null)?.funcao ?? ''
          const codigo = codigoPorFilial[r.id_filial] ?? ''
          const setor = (funcao || '').toLowerCase().includes('estoque') ? 'estoque' : 'recebimento'
          map[key] = {
            acuracidade: acu,
            checklist: chk,
            perda: perd,
            vlr_acuracidade: calcularValorAcuracidade(acu ?? 0),
            vlr_checklist: calcularValorChecklist(chk ?? 0),
            vlr_plt_hs: calcularValorPltHsPorFilial(pltHs, codigo, setor),
            vlr_perda: setor === 'estoque' ? calcularValorPerda(perd ?? 0) : 0,
          }
        }
      }
      setWhatsAppResultadosMap(map)
    }

    const fetchDescontos = async () => {
      const map: Record<string, Desconto | null> = {}
      const paresMesAno = [...new Set(whatsAppData.map(r => `${r.mes}|${r.ano}`))].map(s => {
        const [m, a] = s.split('|')
        return { mes: m, ano: Number(a) }
      })
      for (const { mes, ano } of paresMesAno) {
        const { dataInicio, dataFim } = getIntervaloMes(mes, ano)
        const { data } = await supabase
          .from('descontos')
          .select('*')
          .gte('mes_desconto', dataInicio)
          .lte('mes_desconto', dataFim)
          .in('id_colaborador', ids)
        for (const d of data ?? []) {
          const key = `${d.id_colaborador}|${d.id_filial ?? ''}|${mes}|${ano}`
          map[key] = d as Desconto
        }
      }
      setWhatsAppDescontosMap(map)
    }
    const fetchErros = async () => {
      const errosMap: Record<string, { errosSeparacao: ErroSeparacaoItem[]; errosEntregas: ErroEntregaItem[] }> = {}
      const pares = [...new Set(whatsAppData.map(r => `${r.id_colaborador}|${r.mes}|${r.ano}`))]
      for (const key of pares) {
        const [idColab, mes, anoStr] = key.split('|')
        const ano = Number(anoStr)
        const { dataInicio, dataFim } = getIntervaloMes(mes, ano)
        const { data: colRow } = await supabase.from('colaboradores').select('nome').eq('id', idColab).single()
        const nomeCol = (colRow as { nome?: string } | null)?.nome
        const errosSeparacao: ErroSeparacaoItem[] = []
        const errosEntregas: ErroEntregaItem[] = []
        if (nomeCol) {
          const { data: rows } = await supabase
            .from('recebimentos')
            .select('dta_receb, observacao')
            .eq('usuario_recebto', nomeCol)
            .gte('dta_receb', dataInicio)
            .lte('dta_receb', dataFim)
          for (const row of rows ?? []) {
            const dataCarga = row.dta_receb ? String(row.dta_receb).slice(0, 10) : ''
            const dataBR = dataCarga ? formatarDataBR(dataCarga) : ''
            if (row.observacao) errosEntregas.push({ data: dataBR, quantidade: 0, observacao: row.observacao })
          }
        }
        errosMap[key] = { errosSeparacao, errosEntregas }
      }
      setWhatsAppErrosMap(errosMap)
    }
    fetchResultados()
    fetchDescontos()
    fetchErros()
  }, [showWhatsAppDialog, whatsAppData])

  function buildResumoDescontos(desconto: Desconto | null): { itens: ResumoDescontoItem[]; observacao?: string | null } {
    if (!desconto) return { itens: [] }
    const itens: ResumoDescontoItem[] = []
    if (desconto.falta_injustificada >= 1) itens.push({ tipo: 'Falta injustificada', percentual: 100 })
    if ((desconto.ferias ?? 0) > 0) itens.push({ tipo: 'Férias', percentual: 100 })
    if (desconto.advertencia > 0) itens.push({ tipo: 'Advertência', percentual: desconto.advertencia * 50 })
    if (desconto.suspensao > 0) itens.push({ tipo: 'Suspensão', percentual: Math.min(desconto.suspensao * 100, 100) })
    const atestadoDias = desconto.atestado ?? 0
    if (atestadoDias > 0) {
      let p = 25
      if (atestadoDias <= 2) p = 25
      else if (atestadoDias <= 5) p = 50
      else if (atestadoDias <= 7) p = 70
      else p = 100
      itens.push({ tipo: `Atestado (${atestadoDias} dias)`, percentual: p })
    }
    return { itens, observacao: desconto.observacao ?? undefined }
  }

  // --- Handlers ---
  const handleGerarPDF = async () => {
    setLoading(true)
    setLoadingType('pdf')
    setErro(null)
    try {
      const data = await buscarDadosFiltrados()
      if (data.length === 0) { setErro('Nenhum dado encontrado para o período selecionado.'); return }
      const idFilialParaEvolucao = filtroFilial === 'todas' ? null : filtroFilial
      const [descontosData, resultadosData, dadosPorColetaData] = await Promise.all([
        fetchReportDescontos(mesSelecionado, anoSelecionado, idFilialParaEvolucao),
        fetchReportResultados(mesSelecionado, anoSelecionado, idFilialParaEvolucao),
        fetchReportDadosPorColeta(mesSelecionado, anoSelecionado, idFilialParaEvolucao),
      ])
      const pdfBlob = await gerarRelatorioPDF(data, {
        mesNome: mesSelecionado,
        ano: anoSelecionado,
        filial: filialNomeSelecionada,
        usuario: usuarioLogado?.nome,
      }, descontosData, resultadosData, dadosPorColetaData)
      const url = URL.createObjectURL(pdfBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `relatorio-dockprod-${mesSelecionado}-${anoSelecionado}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('PDF gerado com sucesso!')
    } catch (e) {
      console.error(e)
      setErro(e instanceof Error ? e.message : 'Erro ao gerar PDF')
    } finally {
      setLoading(false)
      setLoadingType(null)
    }
  }

  const handleGerarHTML = async () => {
    setLoading(true)
    setLoadingType('html')
    setErro(null)
    try {
      const data = await buscarDadosFiltrados()
      if (data.length === 0) { setErro('Nenhum dado encontrado para o período selecionado.'); return }
      const idFilialParaEvolucao = filtroFilial === 'todas' ? null : filtroFilial
      const [evolucaoTemporal, descontosData, resultadosData, dadosPorColetaData] = await Promise.all([
        fetchEvolucaoTemporal(mesSelecionado, anoSelecionado, idFilialParaEvolucao),
        fetchReportDescontos(mesSelecionado, anoSelecionado, idFilialParaEvolucao),
        fetchReportResultados(mesSelecionado, anoSelecionado, idFilialParaEvolucao),
        fetchReportDadosPorColeta(mesSelecionado, anoSelecionado, idFilialParaEvolucao),
      ])
      const html = gerarRelatorioHTML(data, {
        mesNome: mesSelecionado,
        ano: anoSelecionado,
        filial: filialNomeSelecionada,
        usuario: usuarioLogado?.nome,
        baseUrl: typeof window !== 'undefined' ? window.location.origin : '',
      }, evolucaoTemporal, descontosData, resultadosData, dadosPorColetaData)
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 5000)
      toast.success('Relatório HTML aberto em nova aba!')
    } catch (e) {
      console.error(e)
      setErro(e instanceof Error ? e.message : 'Erro ao gerar HTML')
    } finally {
      setLoading(false)
      setLoadingType(null)
    }
  }

  const handleGerarXLSX = async () => {
    setLoading(true)
    setLoadingType('xlsx')
    setErro(null)
    try {
      const data = await buscarDadosFiltrados()
      if (data.length === 0) { setErro('Nenhum dado encontrado para o período selecionado.'); return }
      const idFilialParaEvolucao = filtroFilial === 'todas' ? null : filtroFilial
      const [descontosData, resultadosData, dadosPorColetaData] = await Promise.all([
        fetchReportDescontos(mesSelecionado, anoSelecionado, idFilialParaEvolucao),
        fetchReportResultados(mesSelecionado, anoSelecionado, idFilialParaEvolucao),
        fetchReportDadosPorColeta(mesSelecionado, anoSelecionado, idFilialParaEvolucao),
      ])
      await gerarRelatorioXLSX(data, {
        mesNome: mesSelecionado,
        ano: anoSelecionado,
        descontosData,
        resultadosData,
        dadosPorColetaData,
      })
      toast.success('Excel gerado com sucesso!')
    } catch (e) {
      console.error(e)
      setErro(e instanceof Error ? e.message : 'Erro ao gerar Excel')
    } finally {
      setLoading(false)
      setLoadingType(null)
    }
  }

  const handleGerarCSV = async () => {
    setLoading(true)
    setLoadingType('csv')
    setErro(null)
    try {
      const data = await buscarDadosFiltrados()
      if (data.length === 0) { setErro('Nenhum dado encontrado para o período selecionado.'); return }
      exportCSV(data, mesSelecionado, anoSelecionado)
      toast.success('CSV gerado com sucesso!')
    } catch (e) {
      console.error(e)
      setErro(e instanceof Error ? e.message : 'Erro ao gerar CSV')
    } finally {
      setLoading(false)
      setLoadingType(null)
    }
  }

  const getFiltrosDadosGerais = (): FiltrosDadosGerais | null => {
    const filtros: FiltrosDadosGerais = {}
    if (filtroDataInicio && filtroDataFim) {
      filtros.dataInicio = filtroDataInicio.slice(0, 10)
      filtros.dataFim = filtroDataFim.slice(0, 10)
    } else if (mesSelecionado && mesSelecionado !== 'todos') {
      const { dataInicio, dataFim } = getIntervaloMes(mesSelecionado, anoSelecionado)
      filtros.dataInicio = dataInicio
      filtros.dataFim = dataFim
    }
    if (filtroFilial && filtroFilial !== 'todas') filtros.id_filial = filtroFilial
    if (filtroColaborador && filtroColaborador !== 'todos') filtros.id_colaborador = filtroColaborador
    return Object.keys(filtros).length > 0 ? filtros : null
  }

  const handleGerarPDFDadosGerais = async () => {
    setLoading(true)
    setLoadingType('pdf-dados-gerais')
    setErro(null)
    try {
      const data = await fetchAllDadosProdutividade(getFiltrosDadosGerais())
      if (data.length === 0) { setErro('Nenhum registro em dados de produtividade.'); return }
      const pdfBlob = await gerarRelatorioPDFDadosGerais(data, { usuario: usuarioLogado?.nome })
      const url = URL.createObjectURL(pdfBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `relatorio-dados-gerais-dockprod-${new Date().toISOString().slice(0, 10)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('PDF Dados Gerais gerado com sucesso!')
    } catch (e) {
      console.error(e)
      setErro(e instanceof Error ? e.message : 'Erro ao gerar PDF Dados Gerais')
      toast.error('Erro ao gerar PDF Dados Gerais')
    } finally {
      setLoading(false)
      setLoadingType(null)
    }
  }

  const handleGerarXLSXDadosGerais = async () => {
    setLoading(true)
    setLoadingType('xlsx-dados-gerais')
    setErro(null)
    try {
      const data = await fetchAllDadosProdutividade(getFiltrosDadosGerais())
      if (data.length === 0) { setErro('Nenhum registro em dados de produtividade.'); return }
      await gerarRelatorioXLSXDadosGerais(data, {})
      toast.success('Excel Dados Gerais gerado com sucesso!')
    } catch (e) {
      console.error(e)
      setErro(e instanceof Error ? e.message : 'Erro ao gerar Excel Dados Gerais')
      toast.error('Erro ao gerar Excel Dados Gerais')
    } finally {
      setLoading(false)
      setLoadingType(null)
    }
  }

  const handleCompartilharWhatsApp = async () => {
    setLoading(true)
    setLoadingType('whatsapp')
    setErro(null)
    try {
      const data = await buscarDadosFiltrados()
      if (data.length === 0) { setErro('Nenhum dado encontrado para o período selecionado.'); return }
      setWhatsAppData(data)
      setWhatsAppColabIdx(0)
      setShowWhatsAppDialog(true)
    } catch (e) {
      console.error(e)
      setErro(e instanceof Error ? e.message : 'Erro ao carregar dados')
    } finally {
      setLoading(false)
      setLoadingType(null)
    }
  }

  const getTextoWhatsApp = () => {
    if (whatsAppData.length === 0) return ''
    const r = whatsAppData[whatsAppColabIdx]
    const keyDesconto = `${r.id_colaborador}|${r.id_filial ?? ''}|${r.mes}|${r.ano}`
    const keyResultado = `${r.id_colaborador}|${r.id_filial}`
    const desconto = whatsAppDescontosMap[keyDesconto] ?? null
    const resumoDescontos = buildResumoDescontos(desconto)
    const matriculaReal = colaboradores.find((c) => c.id === r.id_colaborador)?.matricula ?? r.id_colaborador
    const funcaoColab = colaboradores.find((c) => c.id === r.id_colaborador)?.funcao ?? ''
    const filialObj = filiais.find((f) => f.id === r.id_filial)
    const filialFormatada = filialObj?.codigo ? `${filialObj.codigo} - ${filialObj.nome}` : r.filial_nome
    const res = whatsAppResultadosMap[keyResultado]
    const prodBruta = res ? res.vlr_acuracidade + res.vlr_checklist + res.vlr_plt_hs + res.vlr_perda : r.produtividade_bruta
    const valorDescontos = r.valor_descontos ?? 0
    const percentualDescontos = prodBruta > 0 ? (valorDescontos / prodBruta) * 100 : 0
    return gerarRelatorioWhatsApp({
      colaborador: r.colaborador_nome,
      matricula: matriculaReal,
      funcao: funcaoColab ?? '',
      filial: filialFormatada,
      mes: r.mes,
      pesoTotal: r.peso_liquido_total,
      volumeTotal: r.volume_total,
      paletesTotal: r.paletes_total,
      tempo: r.tempo_total,
      kgHs: r.kg_hs,
      volHs: r.vol_hs,
      pltHs: r.plt_hs,
      acuracidade: res?.acuracidade ?? null,
      checklist: res?.checklist ?? null,
      perda: res?.perda ?? null,
      vlrAcuracidade: res?.vlr_acuracidade ?? 0,
      vlrChecklist: res?.vlr_checklist ?? 0,
      vlrPltHs: res?.vlr_plt_hs ?? 0,
      vlrPerda: res?.vlr_perda ?? 0,
      prodBruta,
      percentualDescontos,
      prodFinal: r.produtividade_final,
      meta: r.meta,
      percentualAtingimento: r.percentual_atingimento,
      resumoDescontos: resumoDescontos.itens.length > 0 ? resumoDescontos : undefined,
    })
  }

  const enviarWhatsApp = () => {
    if (whatsAppData.length === 0) return
    const texto = getTextoWhatsApp()
    compartilharWhatsApp(texto)
    toast.success('Abrindo WhatsApp...')
    setShowWhatsAppDialog(false)
  }

  const copiarTextoWhatsApp = async () => {
    if (whatsAppData.length === 0) return
    const texto = getTextoWhatsApp()
    const ok = await copiarParaClipboard(texto)
    if (ok) toast.success('Copiado! Agora cole no WhatsApp.')
    else toast.error('Erro ao copiar.')
  }

  const limparFiltros = () => {
    setFiltroColaborador('todos')
    setFiltroFilial('todas')
    setFiltroMatricula('')
    setFiltroBusca('')
  }

  const contarFiltrosAtivos = () => {
    let count = 0
    if (filtroColaborador !== 'todos') count++
    if (filtroFilial !== 'todas') count++
    if (filtroMatricula) count++
    if (filtroBusca) count++
    return count
  }

  const isLoadingType = (type: string) => loadingType === type

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
        <p className="text-muted-foreground">
          Gere relatórios em diferentes formatos
        </p>
      </div>

      {erro && (
        <div className="rounded-lg bg-destructive/10 text-destructive px-4 py-2 text-sm">
          {erro}
        </div>
      )}

      {/* Filtros */}
      <FilterToggle
        title="Configurações do Relatório"
        filtrosAtivos={contarFiltrosAtivos()}
        onLimparFiltros={limparFiltros}
      >
        <div className="space-y-4">
          {/* Linha 1 - Tipo e Período */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Relatório</Label>
              <Select value={tipoRelatorio} onValueChange={setTipoRelatorio}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completo">Relatório Completo</SelectItem>
                  <SelectItem value="produtividade">Apenas Produtividade</SelectItem>
                  <SelectItem value="descontos">Apenas Descontos</SelectItem>
                  <SelectItem value="resultado">Apenas Resultado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mês</Label>
              <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos" className="font-bold bg-green-50">Todos os Meses</SelectItem>
                  {meses.map(m => (
                    <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ano</Label>
              <Select value={String(anoSelecionado)} onValueChange={(v) => setAnoSelecionado(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2026">2026</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Entre datas (início)</Label>
              <Input type="date" value={filtroDataInicio} onChange={(e) => setFiltroDataInicio(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Entre datas (fim)</Label>
              <Input type="date" value={filtroDataFim} onChange={(e) => setFiltroDataFim(e.target.value)} />
            </div>
          </div>

          {/* Linha 2 - Colaborador e Filial */}
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
              <Select value={filtroFilial} onValueChange={setFiltroFilial} disabled={usuarioLogado?.tipo === 'colaborador'}>
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
              <Label>Matrícula</Label>
              <Input
                placeholder="Filtrar por matrícula..."
                value={filtroMatricula}
                onChange={(e) => setFiltroMatricula(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Busca Geral</Label>
              <Input
                placeholder="Buscar em múltiplos campos..."
                value={filtroBusca}
                onChange={(e) => setFiltroBusca(e.target.value)}
              />
            </div>
          </div>
        </div>
      </FilterToggle>

      {/* Botões de Geração */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Button
          onClick={handleGerarPDF}
          disabled={loading}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 h-auto py-4"
          size="lg"
        >
          {isLoadingType('pdf') ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
          <div className="text-left">
            <div className="font-semibold">Gerar PDF</div>
            <div className="text-xs opacity-80">Múltiplas tabelas</div>
          </div>
        </Button>

        <Button
          onClick={handleGerarHTML}
          disabled={loading}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 h-auto py-4"
          size="lg"
        >
          {isLoadingType('html') ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileDown className="w-5 h-5" />}
          <div className="text-left">
            <div className="font-semibold">Visualizar HTML</div>
            <div className="text-xs opacity-80">Cards + Gráficos + Tabelas</div>
          </div>
        </Button>

        <Button
          onClick={handleGerarXLSX}
          disabled={loading}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 h-auto py-4"
          size="lg"
        >
          {isLoadingType('xlsx') ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileSpreadsheet className="w-5 h-5" />}
          <div className="text-left">
            <div className="font-semibold">Exportar Excel</div>
            <div className="text-xs opacity-80">Dados unificados formatados</div>
          </div>
        </Button>

        <Button
          onClick={handleCompartilharWhatsApp}
          disabled={loading}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 h-auto py-4"
          size="lg"
        >
          {isLoadingType('whatsapp') ? <Loader2 className="w-5 h-5 animate-spin" /> : <Share2 className="w-5 h-5" />}
          <div className="text-left">
            <div className="font-semibold">WhatsApp</div>
            <div className="text-xs opacity-80">Por colaborador</div>
          </div>
        </Button>
      </div>

      {/* Card extra: CSV */}
      <Card>
        <CardHeader>
          <CardTitle>Exportação Adicional</CardTitle>
          <CardDescription>Formatos complementares de exportação</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleGerarCSV}
            variant="outline"
            disabled={loading}
            className="w-full md:w-auto"
          >
            {isLoadingType('csv') ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Exportar CSV
          </Button>
        </CardContent>
      </Card>

      {/* Card: Dados Gerais (todos os registros de dados_produtividade, sem fechamento) */}
      <Card>
        <CardHeader>
          <CardTitle>Relatórios Dados Gerais</CardTitle>
          <CardDescription>
            Exportar todos os registros de produtividade (não depende de fechamento, descontos ou resultados)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button
              onClick={handleGerarPDFDadosGerais}
              disabled={loading}
              variant="outline"
              className="flex items-center gap-2"
            >
              {isLoadingType('pdf-dados-gerais') ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              RELATÓRIO PDF – DADOS GERAIS
            </Button>
            <Button
              onClick={handleGerarXLSXDadosGerais}
              disabled={loading}
              variant="outline"
              className="flex items-center gap-2"
            >
              {isLoadingType('xlsx-dados-gerais') ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
              RELATÓRIO XLSX – DADOS GERAIS
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp Dialog */}
      <Dialog open={showWhatsAppDialog} onOpenChange={setShowWhatsAppDialog}>
        {showWhatsAppDialog && (
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Compartilhar via WhatsApp</DialogTitle>
            <DialogDescription>
              Selecione o colaborador para enviar o relatório individual
            </DialogDescription>
          </DialogHeader>
          {whatsAppData.length > 0 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Colaborador</Label>
                <Select
                  value={String(whatsAppColabIdx)}
                  onValueChange={(v) => setWhatsAppColabIdx(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {whatsAppData.map((r, idx) => (
                      <SelectItem key={idx} value={String(idx)}>
                        {r.colaborador_nome} - {r.filial_nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="bg-muted rounded-lg p-3 text-xs max-h-60 overflow-y-auto whitespace-pre-wrap font-mono">
                {getTextoWhatsApp()}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWhatsAppDialog(false)}>
              Cancelar
            </Button>
            <Button variant="outline" onClick={copiarTextoWhatsApp}>
              <Copy className="w-4 h-4 mr-2" />
              Copiar texto
            </Button>
            <Button onClick={enviarWhatsApp} className="bg-emerald-600 hover:bg-emerald-700">
              <MessageSquare className="w-4 h-4 mr-2" />
              Enviar WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
