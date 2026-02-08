'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FileText, Download, FileSpreadsheet, MessageSquare, FileDown } from 'lucide-react'
import {
  fetchReportData,
  exportXLSX,
  exportCSV,
  exportHTML,
  getWhatsAppSummaryLink,
  mesNomeParaNum,
} from '@/lib/relatorios'

export default function RelatoriosPage() {
  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  ]
  const [mesSelecionado, setMesSelecionado] = useState(meses[new Date().getMonth()] ?? 'janeiro')
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear())
  const [tipoRelatorio, setTipoRelatorio] = useState('completo')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const carregarDadosEExportar = async (
    formato: 'xlsx' | 'csv' | 'html' | 'whatsapp'
  ) => {
    if (!mesSelecionado) {
      setErro('Selecione o mês.')
      return
    }
    setLoading(true)
    setErro(null)
    try {
      const mesNum = mesNomeParaNum(mesSelecionado)
      const data = await fetchReportData(mesNum, anoSelecionado)
      if (formato === 'xlsx') {
        await exportXLSX(data, mesSelecionado, anoSelecionado)
      } else if (formato === 'csv') {
        exportCSV(data, mesSelecionado, anoSelecionado)
      } else if (formato === 'html') {
        exportHTML(data, mesSelecionado, anoSelecionado)
      } else if (formato === 'whatsapp') {
        window.open(getWhatsAppSummaryLink(data, mesSelecionado, anoSelecionado), '_blank')
      }
    } catch (e) {
      console.error(e)
      setErro(e instanceof Error ? e.message : 'Erro ao gerar relatório')
    } finally {
      setLoading(false)
    }
  }

  const gerarRelatorio = (formato: string) => {
    if (formato === 'pdf') {
      setErro('PDF será implementado em breve. Use HTML e imprima como PDF.')
      return
    }
    carregarDadosEExportar(formato as 'xlsx' | 'csv' | 'html' | 'whatsapp')
  }

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
      <Card>
        <CardHeader>
          <CardTitle>Configurações do Relatório</CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      {/* Formatos de Relatório */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Relatórios Visuais</CardTitle>
            <CardDescription>PDF e HTML com gráficos e tabelas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={() => gerarRelatorio('pdf')}
              className="w-full"
              variant="outline"
              disabled={loading}
            >
              <FileText className="w-4 h-4 mr-2" />
              Gerar Relatório em PDF
            </Button>
            <Button
              onClick={() => gerarRelatorio('html')}
              className="w-full"
              variant="outline"
              disabled={loading}
            >
              <FileDown className="w-4 h-4 mr-2" />
              Gerar Relatório em HTML
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Relatórios de Dados</CardTitle>
            <CardDescription>Formatos para análise e importação</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={() => gerarRelatorio('xlsx')}
              className="w-full"
              variant="outline"
              disabled={loading}
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              {loading ? 'Gerando...' : 'Gerar Relatório em Excel (XLSX)'}
            </Button>
            <Button
              onClick={() => gerarRelatorio('csv')}
              className="w-full"
              variant="outline"
              disabled={loading}
            >
              <Download className="w-4 h-4 mr-2" />
              Gerar Relatório em CSV
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* WhatsApp */}
      <Card>
        <CardHeader>
          <CardTitle>Compartilhar via WhatsApp</CardTitle>
          <CardDescription>Enviar resumo do relatório</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => gerarRelatorio('whatsapp')}
            className="w-full bg-green-600 hover:bg-green-700"
            disabled={loading}
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Compartilhar via WhatsApp
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
