'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle, AlertCircle, Loader2, History, ChevronLeft, ChevronRight, Package, Clock } from 'lucide-react'
import * as XLSX from 'xlsx'
import { registrarLog } from '@/lib/logs'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import type { Recebimento } from '@/types/database'

function getCell(row: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const v = row[key]
    if (v !== undefined && v !== null && String(v).trim() !== '') return v
  }
  return undefined
}

function excelDateToYYYYMMDD(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'number') {
    const utc = (value - 25569) * 86400 * 1000
    const d = new Date(utc)
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
    return null
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const dmy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
    if (dmy) {
      const [, day, month, year] = dmy
      const d = parseInt(day, 10)
      const m = parseInt(month, 10)
      const y = parseInt(year, 10)
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        const pad = (n: number) => String(n).padStart(2, '0')
        return `${y}-${pad(m)}-${pad(d)}`
      }
    }
    const ymd = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/)
    if (ymd) {
      const [, year, month, day] = ymd
      const y = parseInt(year, 10)
      const m = parseInt(month, 10)
      const d = parseInt(day, 10)
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        const pad = (n: number) => String(n).padStart(2, '0')
        return `${y}-${pad(m)}-${pad(d)}`
      }
    }
    const d = new Date(trimmed)
    if (!isNaN(d.getTime())) {
      const iso = d.toISOString().split('T')[0]
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
    }
  }
  return null
}

function parseDateTime(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'number') {
    const d = new Date((value - 25569) * 86400 * 1000)
    if (!isNaN(d.getTime())) return d.toISOString()
    return null
  }
  if (typeof value === 'string') {
    const d = new Date(value.trim())
    if (!isNaN(d.getTime())) return d.toISOString()
  }
  return null
}

/** Exibe tempo_recebimento em horas decimais (ex.: "0.92 hours" → "0,92") */
function formatTempoDecimal(intervalStr: string | null | undefined): string {
  if (intervalStr == null || String(intervalStr).trim() === '') return '—'
  const m = String(intervalStr).trim().match(/^([\d.]+)\s*hours?/)
  if (m) return Number(m[1]).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return intervalStr
}

const COLUNAS_RECEBIMENTOS: { nome: string; keys: string[] }[] = [
  { nome: 'Filial', keys: ['Filial'] },
  { nome: 'Coleta', keys: ['Coleta'] },
  { nome: 'Dta Receb', keys: ['Dta Receb', 'Dta Recebimento', 'Data Receb'] },
]

const COLUNAS_TEMPO: { nome: string; keys: string[] }[] = [
  { nome: 'Filial', keys: ['Filial'] },
  { nome: 'Ordem Coleta', keys: ['Ordem Coleta', 'Ordem coleta', 'Coleta'] },
  { nome: 'Início Recebimento', keys: ['Início Recebimento', 'Inicio Recebimento'] },
  { nome: 'Final Recebimento', keys: ['Final Recebimento'] },
]

const LIMITE_POR_PAGINA = 50

interface RecebimentoProcessado extends Omit<Recebimento, 'id' | 'created_at' | 'updated_at'> {
  id_coleta_recebimento: string
}

interface TempoProcessado {
  id_filial: string | null
  empresa: string | null
  filial: string | null
  ordem_coleta: string | null
  inicio_recebimento: string | null
  final_recebimento: string | null
  tempo_recebimento: string | null
  id_coleta_recebimento: string | null
}

interface UploadHistoricoRow {
  id: string
  created_at: string
  nome_arquivo: string
  linhas_processadas: number
  menor_carga: string | null
  maior_carga: string | null
  tipo_upload: string | null
  usuarios: { nome: string; email: string } | null
}

export default function UploadPage() {
  const [tipoUpload, setTipoUpload] = useState<'recebimentos' | 'tempo'>('recebimentos')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [processando, setProcessando] = useState(false)
  const [recebimentosProcessados, setRecebimentosProcessados] = useState<RecebimentoProcessado[]>([])
  const [tempoProcessado, setTempoProcessado] = useState<TempoProcessado[]>([])
  const [preview, setPreview] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [totalRegistrosSalvos, setTotalRegistrosSalvos] = useState(0)
  const [erro, setErro] = useState('')
  const [historico, setHistorico] = useState<UploadHistoricoRow[]>([])
  const [historicoLoading, setHistoricoLoading] = useState(false)
  const [paginaAtual, setPaginaAtual] = useState(1)
  const [totalRegistros, setTotalRegistros] = useState(0)
  const [filtroBusca, setFiltroBusca] = useState('')
  const [filtroBuscaDebounced, setFiltroBuscaDebounced] = useState('')
  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')

  const totalPaginas = Math.max(1, Math.ceil(totalRegistros / LIMITE_POR_PAGINA))
  const supabase = createClient()

  useEffect(() => {
    const t = setTimeout(() => setFiltroBuscaDebounced(filtroBusca), 300)
    return () => clearTimeout(t)
  }, [filtroBusca])

  const carregarHistorico = useCallback(async (pagina: number) => {
    setHistoricoLoading(true)
    try {
      const from = (pagina - 1) * LIMITE_POR_PAGINA
      const to = pagina * LIMITE_POR_PAGINA - 1
      const q = filtroBuscaDebounced.trim()

      let query = supabase
        .from('upload_historico')
        .select('id, created_at, nome_arquivo, linhas_processadas, menor_carga, maior_carga, tipo_upload, usuarios(nome, email)', { count: 'exact' })
        .order('created_at', { ascending: false })

      if (filtroDataInicio) query = query.gte('created_at', `${filtroDataInicio}T00:00:00.000Z`)
      if (filtroDataFim) query = query.lte('created_at', `${filtroDataFim}T23:59:59.999Z`)
      if (q) {
        query = query.or(`nome_arquivo.ilike.%${q}%,menor_carga.ilike.%${q}%,maior_carga.ilike.%${q}%,tipo_upload.ilike.%${q}%`)
      }

      const { data, error, count } = await query.range(from, to)
      if (error) throw error
      setHistorico((data ?? []) as unknown as UploadHistoricoRow[])
      setTotalRegistros(typeof count === 'number' ? count : 0)
    } catch {
      setHistorico([])
      setTotalRegistros(0)
    } finally {
      setHistoricoLoading(false)
    }
  }, [filtroBuscaDebounced, filtroDataInicio, filtroDataFim, supabase])

  useEffect(() => {
    carregarHistorico(paginaAtual)
  }, [paginaAtual, carregarHistorico])

  useEffect(() => {
    setPaginaAtual(1)
  }, [filtroBuscaDebounced, filtroDataInicio, filtroDataFim])

  const processarRecebimentos = async (file: File) => {
    setErro('')
    setProcessando(true)
    setRecebimentosProcessados([])
    setTempoProcessado([])
    setPreview(false)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]], { range: 0, defval: null })
      if (!jsonData.length) {
        setErro('O arquivo não contém linhas de dados.')
        return
      }
      const chaves = Object.keys(jsonData[0])
      for (const { nome, keys } of COLUNAS_RECEBIMENTOS) {
        if (!keys.some((k) => chaves.includes(k))) {
          setErro(`Coluna obrigatória ausente: ${nome}. Use a planilha "Detalha Recebimentos".`)
          return
        }
      }
      const { data: filiais } = await supabase.from('filiais').select('*')
      const coletaToId = new Map<string, string>()
      const processados: RecebimentoProcessado[] = jsonData.map((row: Record<string, unknown>) => {
        const filialNome = String(getCell(row, ['Filial']) ?? '')
        const filialEncontrada = filiais?.find((f: { codigo?: string; nome?: string }) => filialNome.includes(f.codigo ?? '') || filialNome.includes(f.nome ?? ''))
        const idFilial = filialEncontrada?.id ?? null
        const coleta = String(getCell(row, ['Coleta']) ?? '')
        if (!coletaToId.has(coleta)) coletaToId.set(coleta, `${crypto.randomUUID()}-${coleta}`)
        const idColeta = coletaToId.get(coleta)!
        const dtaReceb = excelDateToYYYYMMDD(getCell(row, ['Dta Receb', 'Dta Recebimento', 'Data Receb']))
        const qtdCaixas = parseFloat(String(getCell(row, ['Qtd Caixas Recebidas', 'Qtd caixas recebidas']) ?? 0)) || 0
        const pesoLiq = parseFloat(String(getCell(row, ['Peso Líquido Recebido', 'Peso Liquido Recebido']) ?? 0)) || 0
        return {
          id_filial: idFilial,
          filial: filialNome || null,
          fornecedor: String(getCell(row, ['Fornecedor']) ?? '') || null,
          motorista: String(getCell(row, ['Motorista']) ?? '') || null,
          coleta: coleta || null,
          item: String(getCell(row, ['Item']) ?? '') || null,
          seq: String(getCell(row, ['Seq.', 'Seq']) ?? '') || null,
          cd_prod: String(getCell(row, ['Cd. Prod', 'Cd Prod', 'Cod. Prod']) ?? '') || null,
          produto: String(getCell(row, ['Produto']) ?? '') || null,
          nota_fiscal: String(getCell(row, ['Nota Fiscal']) ?? '') || null,
          dta_receb: dtaReceb,
          usuario_recebto: String(getCell(row, ['Usuário Recebto', 'Usuario Recebto']) ?? '') || null,
          und: qtdCaixas ? null : (parseFloat(String(getCell(row, ['Und']) ?? 0)) || null),
          qtd_recebida: parseFloat(String(getCell(row, ['Qtd Recebida']) ?? 0)) || null,
          qtd_caixas_recebidas: qtdCaixas || null,
          peso_liquido_recebido: pesoLiq || null,
          id_coleta_recebimento: idColeta,
          observacao: null,
        }
      })
      const semFilial = processados.filter((d) => !d.id_filial && d.filial)
      if (semFilial.length > 0) {
        const nomes = [...new Set(semFilial.map((d) => d.filial).filter(Boolean))]
        setErro(`Filial não encontrada: ${nomes.join(', ')}. Cadastre as filiais em Cadastros.`)
        return
      }
      setRecebimentosProcessados(processados)
      setPreview(true)
      setTipoUpload('recebimentos')
    } catch (e) {
      console.error(e)
      setErro('Erro ao processar arquivo. Verifique se é a planilha "Detalha Recebimentos".')
    } finally {
      setProcessando(false)
    }
  }

  const processarTempo = async (file: File) => {
    setErro('')
    setProcessando(true)
    setRecebimentosProcessados([])
    setTempoProcessado([])
    setPreview(false)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]], { range: 0, defval: null })
      if (!jsonData.length) {
        setErro('O arquivo não contém linhas de dados.')
        return
      }
      const chaves = Object.keys(jsonData[0])
      for (const { nome, keys } of COLUNAS_TEMPO) {
        if (!keys.some((k) => chaves.includes(k))) {
          setErro(`Coluna obrigatória ausente: ${nome}. Use a planilha "Tempo".`)
          return
        }
      }
      const { data: filiais } = await supabase.from('filiais').select('*')
      type RecebColetaRow = { id_coleta_recebimento: string; coleta: string }
      const recebimentosExistentes = await fetchAllRows<RecebColetaRow>(() => supabase.from('recebimentos').select('id_coleta_recebimento, coleta, filial').not('id_coleta_recebimento', 'is', null))
      const mapaColetaToId = new Map<string, string>()
      recebimentosExistentes.forEach((r: RecebColetaRow) => {
        if (r.coleta && r.id_coleta_recebimento) mapaColetaToId.set(r.coleta, r.id_coleta_recebimento)
      })
      const processados: TempoProcessado[] = jsonData.map((row: Record<string, unknown>) => {
        const filialNome = String(getCell(row, ['Filial']) ?? '')
        const filialEncontrada = filiais?.find((f: { codigo?: string; nome?: string }) => filialNome.includes(f.codigo ?? '') || filialNome.includes(f.nome ?? ''))
        const idFilial = filialEncontrada?.id ?? null
        const ordemColeta = String(getCell(row, ['Ordem Coleta', 'Ordem coleta', 'Coleta']) ?? '')
        const idColeta = ordemColeta ? (mapaColetaToId.get(ordemColeta) ?? null) : null
        const inicio = parseDateTime(getCell(row, ['Início Recebimento', 'Inicio Recebimento']))
        const final = parseDateTime(getCell(row, ['Final Recebimento']))
        let tempoInterval: string | null = null
        if (inicio && final) {
          const msInicio = new Date(inicio).getTime()
          const msFinal = new Date(final).getTime()
          const horasDecimal = (msFinal - msInicio) / (1000 * 60 * 60)
          if (!Number.isNaN(horasDecimal) && horasDecimal >= 0) {
            tempoInterval = `${Math.round(horasDecimal * 100) / 100} hours`
          }
        }
        return {
          id_filial: idFilial,
          empresa: String(getCell(row, ['Empresa']) ?? '') || null,
          filial: filialNome || null,
          ordem_coleta: ordemColeta || null,
          inicio_recebimento: inicio,
          final_recebimento: final,
          tempo_recebimento: tempoInterval,
          id_coleta_recebimento: idColeta,
        }
      })
      setTempoProcessado(processados)
      setPreview(true)
      setTipoUpload('tempo')
    } catch (e) {
      console.error(e)
      setErro('Erro ao processar arquivo. Verifique se é a planilha "Tempo".')
    } finally {
      setProcessando(false)
    }
  }

  const handleFileRecebimentos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setArquivo(file)
      processarRecebimentos(file)
    }
  }

  const handleFileTempo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setArquivo(file)
      processarTempo(file)
    }
  }

  const registrarRecebimentos = async () => {
    setSalvando(true)
    setErro('')
    try {
      const payload = recebimentosProcessados.map(({ id_coleta_recebimento, ...rest }) => ({
        ...rest,
        id_coleta_recebimento,
      }))
      const { error } = await supabase.from('recebimentos').insert(payload)
      if (error) throw error
      const coletas = recebimentosProcessados.map((r) => r.coleta).filter(Boolean) as string[]
      let menor: string | null = null
      let maior: string | null = null
      if (coletas.length > 0) {
        const sorted = [...coletas].sort((a, b) => (Number(a) - Number(b)) || String(a).localeCompare(String(b)))
        menor = sorted[0]
        maior = sorted[sorted.length - 1]
      }
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('upload_historico').insert({
          nome_arquivo: arquivo?.name ?? 'recebimentos.xlsx',
          linhas_processadas: payload.length,
          id_usuario: user.id,
          menor_carga: menor,
          maior_carga: maior,
          tipo_upload: 'recebimentos',
        })
        registrarLog(supabase, 'Fez upload de recebimentos')
      }
      setTotalRegistrosSalvos(payload.length)
      setSucesso(true)
      setPreview(false)
      setRecebimentosProcessados([])
      setArquivo(null)
      setPaginaAtual(1)
      carregarHistorico(1)
      ;(document.getElementById('arquivo-recebimentos') as HTMLInputElement).value = ''
    } catch (err: unknown) {
      const e = err as { code?: string }
      setErro(e?.code === '23505' ? 'Alguns registros já existem.' : 'Erro ao salvar. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  const registrarTempo = async () => {
    setSalvando(true)
    setErro('')
    try {
      const payload = tempoProcessado.map(({ id_coleta_recebimento, ...rest }) => ({
        ...rest,
        id_coleta_recebimento,
      }))
      const { error } = await supabase.from('tempo').insert(payload)
      if (error) throw error
      const ordens = tempoProcessado.map((t) => t.ordem_coleta).filter(Boolean) as string[]
      let menor: string | null = null
      let maior: string | null = null
      if (ordens.length > 0) {
        const sorted = [...ordens].sort((a, b) => (Number(a) - Number(b)) || String(a).localeCompare(String(b)))
        menor = sorted[0]
        maior = sorted[sorted.length - 1]
      }
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('upload_historico').insert({
          nome_arquivo: arquivo?.name ?? 'tempo.xlsx',
          linhas_processadas: payload.length,
          id_usuario: user.id,
          menor_carga: menor,
          maior_carga: maior,
          tipo_upload: 'tempo',
        })
        registrarLog(supabase, 'Fez upload de tempo')
      }
      setTotalRegistrosSalvos(payload.length)
      setSucesso(true)
      setPreview(false)
      setTempoProcessado([])
      setArquivo(null)
      setPaginaAtual(1)
      carregarHistorico(1)
      ;(document.getElementById('arquivo-tempo') as HTMLInputElement).value = ''
    } catch (err: unknown) {
      const e = err as { code?: string }
      setErro(e?.code === '23505' ? 'Alguns registros já existem.' : 'Erro ao salvar. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  const limparFiltrosHistorico = () => {
    setFiltroBusca('')
    setFiltroDataInicio('')
    setFiltroDataFim('')
    setPaginaAtual(1)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Upload de Dados</h1>
        <p className="text-muted-foreground">
          Importe planilhas Excel: Detalha Recebimentos e Tempo
        </p>
      </div>

      {sucesso && (
        <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <span className="text-green-700">Dados registrados com sucesso! Total de {totalRegistrosSalvos} registros.</span>
        </div>
      )}
      {erro && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-700">{erro}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Detalha Recebimentos
            </CardTitle>
            <CardDescription>
              Planilha com colunas: Filial, Coleta, Dta Receb, Fornecedor, Motorista, Nota Fiscal, Qtd Recebida, Qtd Caixas Recebidas, Peso Líquido Recebido, etc.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="arquivo-recebimentos">Arquivo .xlsx</Label>
              <Input
                id="arquivo-recebimentos"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileRecebimentos}
                disabled={processando || salvando}
              />
            </div>
            {processando && tipoUpload === 'recebimentos' && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                Processando...
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Tempo
            </CardTitle>
            <CardDescription>
              Planilha com colunas: Empresa, Filial, Ordem Coleta, Início Recebimento, Final Recebimento, Tempo Recebimento.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="arquivo-tempo">Arquivo .xlsx</Label>
              <Input
                id="arquivo-tempo"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileTempo}
                disabled={processando || salvando}
              />
            </div>
            {processando && tipoUpload === 'tempo' && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                Processando...
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {preview && tipoUpload === 'recebimentos' && recebimentosProcessados.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Preview – Recebimentos</CardTitle>
            <CardDescription>Visualize antes de registrar no banco</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border rounded-lg overflow-auto max-h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Filial</TableHead>
                    <TableHead>Coleta</TableHead>
                    <TableHead>Dta Receb</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Nota Fiscal</TableHead>
                    <TableHead className="text-right">Qtd Caixas</TableHead>
                    <TableHead className="text-right">Peso Líq.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recebimentosProcessados.slice(0, 15).map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{r.filial}</TableCell>
                      <TableCell>{r.coleta}</TableCell>
                      <TableCell className="text-xs">{r.dta_receb}</TableCell>
                      <TableCell className="text-xs max-w-[120px] truncate">{r.fornecedor}</TableCell>
                      <TableCell className="text-xs">{r.nota_fiscal}</TableCell>
                      <TableCell className="text-right">{Number(r.qtd_caixas_recebidas ?? 0).toFixed(0)}</TableCell>
                      <TableCell className="text-right">{Number(r.peso_liquido_recebido ?? 0).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {recebimentosProcessados.length > 15 && (
              <p className="text-sm text-muted-foreground">Mostrando 15 de {recebimentosProcessados.length} registros</p>
            )}
            <div className="flex gap-2">
              <Button onClick={registrarRecebimentos} disabled={salvando} className="bg-green-600 hover:bg-green-700">
                {salvando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                Registrar dados no Banco
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setPreview(false)
                  setRecebimentosProcessados([])
                  setArquivo(null)
                }}
                disabled={salvando}
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {preview && tipoUpload === 'tempo' && tempoProcessado.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Preview – Tempo</CardTitle>
            <CardDescription>Visualize antes de registrar no banco</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border rounded-lg overflow-auto max-h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Filial</TableHead>
                    <TableHead>Ordem Coleta</TableHead>
                    <TableHead>Início</TableHead>
                    <TableHead>Final</TableHead>
                    <TableHead>Tempo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tempoProcessado.slice(0, 15).map((t, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{t.filial}</TableCell>
                      <TableCell>{t.ordem_coleta}</TableCell>
                      <TableCell className="text-xs">{t.inicio_recebimento ? new Date(t.inicio_recebimento).toLocaleString('pt-BR') : '—'}</TableCell>
                      <TableCell className="text-xs">{t.final_recebimento ? new Date(t.final_recebimento).toLocaleString('pt-BR') : '—'}</TableCell>
                      <TableCell className="text-xs">{formatTempoDecimal(t.tempo_recebimento)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {tempoProcessado.length > 15 && (
              <p className="text-sm text-muted-foreground">Mostrando 15 de {tempoProcessado.length} registros</p>
            )}
            <div className="flex gap-2">
              <Button onClick={registrarTempo} disabled={salvando} className="bg-green-600 hover:bg-green-700">
                {salvando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                Registrar dados no Banco
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setPreview(false)
                  setTempoProcessado([])
                  setArquivo(null)
                }}
                disabled={salvando}
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Uploads
          </CardTitle>
          <CardDescription>Últimos imports (recebimentos e tempo)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex-1 flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[180px]">
                <Label className="text-xs text-muted-foreground">Busca</Label>
                <Input placeholder="Arquivo, carga, tipo..." value={filtroBusca} onChange={(e) => setFiltroBusca(e.target.value)} className="h-9" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Data início</Label>
                <Input type="date" value={filtroDataInicio} onChange={(e) => setFiltroDataInicio(e.target.value)} className="h-9 w-[140px]" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Data fim</Label>
                <Input type="date" value={filtroDataFim} onChange={(e) => setFiltroDataFim(e.target.value)} className="h-9 w-[140px]" />
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={limparFiltrosHistorico}>Limpar</Button>
          </div>
          {historicoLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : historico.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nenhum upload registrado.</p>
          ) : (
            <>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Arquivo</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Linhas</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Menor / Maior</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historico.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-sm whitespace-nowrap">{new Date(row.created_at).toLocaleString('pt-BR')}</TableCell>
                        <TableCell className="font-medium">{row.nome_arquivo}</TableCell>
                        <TableCell><Badge variant="secondary">{row.tipo_upload ?? '—'}</Badge></TableCell>
                        <TableCell className="text-right">{row.linhas_processadas}</TableCell>
                        <TableCell className="text-sm">{row.usuarios?.nome ?? row.usuarios?.email ?? '—'}</TableCell>
                        <TableCell className="text-xs">{row.menor_carga ?? '—'} / {row.maior_carga ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {totalRegistros > 0 && (
                <div className="flex items-center justify-between pt-4 border-t mt-4">
                  <p className="text-sm text-muted-foreground">
                    {(paginaAtual - 1) * LIMITE_POR_PAGINA + 1}–{Math.min(paginaAtual * LIMITE_POR_PAGINA, totalRegistros)} de {totalRegistros}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))} disabled={paginaAtual <= 1}>
                      <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setPaginaAtual((p) => p + 1)} disabled={paginaAtual >= totalPaginas}>
                      Próximo <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
