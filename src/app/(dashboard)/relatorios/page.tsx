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
  exportCSV,
  type FechamentoLinha,
} from '@/lib/relatorios'
import { gerarRelatorioPDF } from '@/lib/relatorios/pdfGenerator'
import { gerarRelatorioHTML } from '@/lib/relatorios/htmlGenerator'
import { gerarRelatorioXLSX } from '@/lib/relatorios/xlsxGenerator'
import { gerarRelatorioWhatsApp, compartilharWhatsApp, copiarParaClipboard, type ResumoDescontoItem, type ErroSeparacaoItem, type ErroEntregaItem } from '@/lib/relatorios/whatsappGenerator'
import { createClient } from '@/lib/supabase/client'
import type { Desconto } from '@/types/database'

export default function RelatoriosPage() {
  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  ]
  const [mesSelecionado, setMesSelecionado] = useState<string>(meses[new Date().getMonth()] ?? 'janeiro')
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear())
  const [tipoRelatorio, setTipoRelatorio] = useState('completo')
  const [loading, setLoading] = useState(false)
  const [loadingType, setLoadingType] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  
  // Filtros adicionais
  const [filtroColaborador, setFiltroColaborador] = useState('todos')
  const [filtroFilial, setFiltroFilial] = useState('todas')
  const [filtroMatricula, setFiltroMatricula] = useState('')
  const [filtroBusca, setFiltroBusca] = useState('')
  const [colaboradores, setColaboradores] = useState<{ id: string; nome: string; matricula?: string }[]>([])
  const [filiais, setFiliais] = useState<{ id: string; nome: string }[]>([])

  // WhatsApp dialog
  const [showWhatsAppDialog, setShowWhatsAppDialog] = useState(false)
  const [whatsAppData, setWhatsAppData] = useState<FechamentoLinha[]>([])
  const [whatsAppColabIdx, setWhatsAppColabIdx] = useState(0)
  /** Mapa id_colaborador|mes|ano -> Desconto para resumo na mensagem */
  const [whatsAppDescontosMap, setWhatsAppDescontosMap] = useState<Record<string, Desconto | null>>({})
  /** Mapa id_colaborador|mes|ano -> detalhe erros (separação e entregas + observação) */
  const [whatsAppErrosMap, setWhatsAppErrosMap] = useState<Record<string, { errosSeparacao: ErroSeparacaoItem[]; errosEntregas: ErroEntregaItem[] }>>({})

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
      
      const { data: filiaisData } = await supabase.from('filiais').select('id, nome').eq('ativo', true).order('nome')
      if (filiaisData) setFiliais(filiaisData)

      const { data: colabsData } = await supabase.from('colaboradores').select('id, nome, matricula').eq('ativo', true).order('nome')
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

    return data
  }, [mesSelecionado, anoSelecionado, filtroColaborador, filtroFilial, filtroMatricula, filtroBusca])

  const filialNomeSelecionada = filiais.find(f => f.id === filtroFilial)?.nome || 'Todas'

  // Primeiro e último dia do mês (mes = nome: janeiro, fevereiro, ...)
  function getIntervaloMes(mes: string, ano: number): { dataInicio: string; dataFim: string } {
    const idx = meses.indexOf(mes)
    const monthIndex = idx >= 0 ? idx : 0
    const primeiro = new Date(ano, monthIndex, 1)
    const ultimo = new Date(ano, monthIndex + 1, 0)
    return {
      dataInicio: primeiro.toISOString().slice(0, 10),
      dataFim: ultimo.toISOString().slice(0, 10),
    }
  }

  function formatarDataBR(iso: string): string {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  }

  // Buscar descontos e detalhe de erros ao abrir o dialog WhatsApp
  useEffect(() => {
    if (!showWhatsAppDialog || whatsAppData.length === 0) return
    const ids = [...new Set(whatsAppData.map(r => r.id_colaborador))]
    const mesesUnicos = [...new Set(whatsAppData.map(r => r.mes))]
    const anosUnicos = [...new Set(whatsAppData.map(r => r.ano))]
    const fetchDescontos = async () => {
      const map: Record<string, Desconto | null> = {}
      for (const ano of anosUnicos) {
        const { data } = await supabase
          .from('descontos')
          .select('*')
          .eq('ano', ano)
          .in('mes', mesesUnicos)
          .in('id_colaborador', ids)
        for (const d of data ?? []) {
          map[`${d.id_colaborador}|${d.mes}|${d.ano}`] = d as Desconto
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
        const { data: rows } = await supabase
          .from('dados_produtividade')
          .select('data_carga, erro_separacao, erro_entregas, observacao')
          .eq('id_colaborador', idColab)
          .gte('data_carga', dataInicio)
          .lte('data_carga', dataFim)
        const errosSeparacao: ErroSeparacaoItem[] = []
        const errosEntregas: ErroEntregaItem[] = []
        for (const row of rows ?? []) {
          const dataCarga = row.data_carga ? String(row.data_carga).slice(0, 10) : ''
          const dataBR = dataCarga ? formatarDataBR(dataCarga) : ''
          const sep = Number(row.erro_separacao ?? 0)
          const ent = Number(row.erro_entregas ?? 0)
          if (sep > 0) errosSeparacao.push({ data: dataBR, quantidade: sep })
          if (ent > 0) errosEntregas.push({ data: dataBR, quantidade: ent, observacao: row.observacao ?? undefined })
        }
        errosMap[key] = { errosSeparacao, errosEntregas }
      }
      setWhatsAppErrosMap(errosMap)
    }
    fetchDescontos()
    fetchErros()
  }, [showWhatsAppDialog, whatsAppData])

  function buildResumoDescontos(desconto: Desconto | null): { itens: ResumoDescontoItem[]; observacao?: string | null } {
    if (!desconto) return { itens: [] }
    const itens: ResumoDescontoItem[] = []
    if (desconto.falta_injustificada >= 1) itens.push({ tipo: 'Falta injustificada', percentual: 100 })
    if (desconto.ferias) itens.push({ tipo: 'Férias', percentual: 100 })
    if (desconto.advertencia > 0) itens.push({ tipo: 'Advertência', percentual: desconto.advertencia * 50 })
    if (desconto.suspensao > 0) itens.push({ tipo: 'Suspensão', percentual: Math.min(desconto.suspensao * 100, 100) })
    if (desconto.atestado_dias > 0) {
      let p = 25
      if (desconto.atestado_dias <= 2) p = 25
      else if (desconto.atestado_dias <= 5) p = 50
      else if (desconto.atestado_dias <= 7) p = 70
      else p = 100
      itens.push({ tipo: `Atestado (${desconto.atestado_dias} dias)`, percentual: p })
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
      const pdfBlob = await gerarRelatorioPDF(data, {
        mesNome: mesSelecionado,
        ano: anoSelecionado,
        filial: filialNomeSelecionada,
        usuario: usuarioLogado?.nome,
      })
      const url = URL.createObjectURL(pdfBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `relatorio-pickprod-${mesSelecionado}-${anoSelecionado}.pdf`
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
      const evolucaoTemporal = await fetchEvolucaoTemporal(mesSelecionado, anoSelecionado, idFilialParaEvolucao)
      const html = gerarRelatorioHTML(data, {
        mesNome: mesSelecionado,
        ano: anoSelecionado,
        filial: filialNomeSelecionada,
        usuario: usuarioLogado?.nome,
        baseUrl: typeof window !== 'undefined' ? window.location.origin : '',
      }, evolucaoTemporal)
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
      await gerarRelatorioXLSX(data, { mesNome: mesSelecionado, ano: anoSelecionado })
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
    const key = `${r.id_colaborador}|${r.mes}|${r.ano}`
    const desconto = whatsAppDescontosMap[key] ?? null
    const resumoDescontos = buildResumoDescontos(desconto)
    const matriculaReal = colaboradores.find((c) => c.id === r.id_colaborador)?.matricula ?? r.id_colaborador
    const detalheErros = whatsAppErrosMap[key]
    return gerarRelatorioWhatsApp({
      colaborador: r.colaborador_nome,
      matricula: matriculaReal,
      filial: r.filial_nome,
      mes: r.mes,
      pesoTotal: r.peso_liquido_total,
      volumeTotal: r.volume_total,
      paletesTotal: r.paletes_total,
      tempo: r.tempo_total,
      kgHs: r.kg_hs,
      volHs: r.vol_hs,
      pltHs: r.plt_hs,
      erros: r.erro_separacao_total + r.erro_entregas_total,
      vlrKgHs: r.valor_kg_hs,
      vlrVolHs: r.valor_vol_hs,
      vlrPltHs: r.valor_plt_hs,
      prodBruta: r.produtividade_bruta,
      percentualErros: r.percentual_erros,
      percentualDescontos: r.percentual_descontos,
      prodFinal: r.produtividade_final,
      meta: r.meta,
      percentualAtingimento: r.percentual_atingimento,
      detalheErros,
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
                {whatsAppData[whatsAppColabIdx] && (() => {
                  const r = whatsAppData[whatsAppColabIdx]
                  const key = `${r.id_colaborador}|${r.mes}|${r.ano}`
                  const desconto = whatsAppDescontosMap[key] ?? null
                  const resumoDescontos = buildResumoDescontos(desconto)
                  const matriculaReal = colaboradores.find((c) => c.id === r.id_colaborador)?.matricula ?? r.id_colaborador
                  const detalheErros = whatsAppErrosMap[key]
                  return gerarRelatorioWhatsApp({
                    colaborador: r.colaborador_nome,
                    matricula: matriculaReal,
                    filial: r.filial_nome,
                    mes: r.mes,
                    pesoTotal: r.peso_liquido_total,
                    volumeTotal: r.volume_total,
                    paletesTotal: r.paletes_total,
                    tempo: r.tempo_total,
                    kgHs: r.kg_hs,
                    volHs: r.vol_hs,
                    pltHs: r.plt_hs,
                    erros: r.erro_separacao_total + r.erro_entregas_total,
                    vlrKgHs: r.valor_kg_hs,
                    vlrVolHs: r.valor_vol_hs,
                    vlrPltHs: r.valor_plt_hs,
                    prodBruta: r.produtividade_bruta,
                    percentualErros: r.percentual_erros,
                    percentualDescontos: r.percentual_descontos,
                    prodFinal: r.produtividade_final,
                    meta: r.meta,
                    percentualAtingimento: r.percentual_atingimento,
                    detalheErros,
                    resumoDescontos: resumoDescontos.itens.length > 0 ? resumoDescontos : undefined,
                  })
                })()}
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
