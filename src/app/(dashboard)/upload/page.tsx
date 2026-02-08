'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import * as XLSX from 'xlsx'

// Helper: retorna o primeiro valor não-undefined ao tentar cada chave (evita encoding quebrado)
function getCell(row: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const v = row[key]
    if (v !== undefined && v !== null && String(v).trim() !== '') return v
  }
  return undefined
}

// Converte data do Excel (serial ou string) para YYYY-MM-DD. Nunca devolve DD/MM/YYYY (Postgres exige ISO).
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
    // DD/MM/YYYY ou DD-MM-YYYY (comum no Brasil)
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
    // YYYY-MM-DD ou YYYY/MM/DD (já ISO ou ano primeiro)
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
    // Fallback: new Date (pode funcionar em alguns ambientes)
    const d = new Date(trimmed)
    if (!isNaN(d.getTime())) {
      const iso = d.toISOString().split('T')[0]
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
    }
    return null
  }
  return null
}

// Extrai código do cliente do texto "Nome (000082 - 85)" → "000082-85"
function extrairCodClienteDoTexto(cliente: string): string {
  const match = cliente.match(/\(\s*(\d+)\s*-\s*(\d+)\s*\)/)
  if (match) return `${match[1]}-${match[2]}`
  return ''
}

// Colunas obrigatórias com variantes de encoding para validação
const COLUNAS_OBRIGATORIAS: { nome: string; keys: string[] }[] = [
  { nome: 'Filial', keys: ['Filial'] },
  { nome: 'Carga', keys: ['Carga'] },
  { nome: 'Data Carga', keys: ['Data Carga'] },
  { nome: 'Peso Líquido', keys: ['Peso Líquido', 'Peso Liquido', 'Peso Lquido'] },
  { nome: 'Cliente', keys: ['Cliente'] },
]

interface DadoProcessado {
  id_carga_cliente: string
  id_filial: string
  filial: string
  carga: string
  data_carga: string
  data_frete: string | null
  nota_fiscal: string
  cliente: string
  peso_liquido: number
  qtd_venda: number
  paletes: number
  cod_cliente: string
  [key: string]: unknown
}

// Chaves inseríveis na tabela dados_produtividade (sem id, paletes, created_at, updated_at)
const CHAVES_INSERT: (keyof DadoProcessado)[] = [
  'id_carga_cliente', 'id_filial', 'filial', 'ordem_frete', 'data_frete', 'carga', 'seq_carga',
  'data_carga', 'nota_fiscal', 'item_nf', 'qtd_venda', 'familia', 'codigo_produto', 'produto',
  'valor_frete', 'peso_bruto', 'peso_liquido', 'percentual', 'grupo_veiculo', 'codigo_veiculo',
  'rota', 'rede', 'cliente', 'cidade_cliente', 'uf', 'cod_cliente', 'erro_separacao', 'erro_entregas', 'mes',
]

export default function UploadPage() {
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [processando, setProcessando] = useState(false)
  const [dadosProcessados, setDadosProcessados] = useState<DadoProcessado[]>([])
  const [preview, setPreview] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [totalRegistrosSalvos, setTotalRegistrosSalvos] = useState(0)
  const [erro, setErro] = useState('')

  const supabase = createClient()

  const processarArquivo = async (file: File) => {
    setErro('')
    setProcessando(true)
    setSucesso(false)
    setDadosProcessados([])
    setPreview(false)

    try {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]

      // Cabeçalho na primeira linha (índice 0)
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
        range: 0,
        defval: null,
      })

      if (!jsonData.length) {
        setErro('O arquivo não contém linhas de dados.')
        return
      }

      // Validação: colunas obrigatórias presentes (usando as chaves do primeiro objeto)
      const primeiraLinha = jsonData[0]
      const chavesPresentes = Object.keys(primeiraLinha)
      for (const { nome, keys } of COLUNAS_OBRIGATORIAS) {
        const encontrada = keys.some((k) => chavesPresentes.includes(k))
        if (!encontrada) {
          setErro(`Coluna obrigatória ausente: ${nome}. Verifique se o arquivo segue o modelo.`)
          return
        }
      }

      const { data: filiais } = await supabase.from('filiais').select('*')

      const processados: DadoProcessado[] = jsonData.map((row: Record<string, unknown>) => {
        const filialNome = String(getCell(row, ['Filial']) ?? '')
        const filialEncontrada = filiais?.find(
          (f: { codigo?: string; nome?: string }) =>
            filialNome.includes(f.codigo ?? '') || filialNome.includes(f.nome ?? '')
        )
        const idFilial = filialEncontrada?.id ?? ''

        const carga = String(getCell(row, ['Carga']) ?? '')
        const clienteTexto = String(getCell(row, ['Cliente']) ?? '')
        const codClienteCol = getCell(row, ['CÓD CLIENTE', 'COD CLIENTE', 'CD CLIENTE'])
        const codCliente = codClienteCol != null ? String(codClienteCol) : extrairCodClienteDoTexto(clienteTexto)
        const idCargaCliente = `${carga}-${(codCliente || clienteTexto.replace(/\s+/g, '_').slice(0, 30))}`

        const pesoLiquido = parseFloat(String(getCell(row, ['Peso Líquido', 'Peso Liquido', 'Peso Lquido']) ?? 0)) || 0
        const paletes = pesoLiquido / 550

        const dataCargaVal = getCell(row, ['Data Carga'])
        const dataFreteVal = getCell(row, ['Data Frete'])
        const dataCarga = excelDateToYYYYMMDD(dataCargaVal) ?? new Date().toISOString().split('T')[0]
        const dataFrete = excelDateToYYYYMMDD(dataFreteVal)

        return {
          id_carga_cliente: idCargaCliente,
          id_filial: idFilial,
          filial: filialNome,
          ordem_frete: String(getCell(row, ['Ordem Frete']) ?? ''),
          data_frete: dataFrete,
          carga,
          seq_carga: String(getCell(row, ['Seq. Carga']) ?? ''),
          data_carga: dataCarga,
          nota_fiscal: String(getCell(row, ['Nota Fiscal']) ?? ''),
          item_nf: String(getCell(row, ['Item NF']) ?? ''),
          qtd_venda: parseFloat(String(getCell(row, ['Qtd Venda']) ?? 0)) || 0,
          familia: String(getCell(row, ['Família', 'Familia', 'Famlia']) ?? ''),
          codigo_produto: String(getCell(row, ['Código Produto', 'Codigo Produto', 'Cdigo Produto']) ?? ''),
          produto: String(getCell(row, ['Produto']) ?? ''),
          valor_frete: parseFloat(String(getCell(row, ['Valor Frete']) ?? 0)) || 0,
          peso_bruto: parseFloat(String(getCell(row, ['Peso Bruto']) ?? 0)) || 0,
          peso_liquido: pesoLiquido,
          percentual: parseFloat(String(getCell(row, ['%']) ?? 0)) || 0,
          grupo_veiculo: String(getCell(row, ['Grupo Veículo', 'Grupo Veiculo', 'Grupo Veculo']) ?? ''),
          codigo_veiculo: String(getCell(row, ['Código Veículo', 'Codigo Veiculo', 'Cdigo Veculo']) ?? ''),
          rota: String(getCell(row, ['Rota']) ?? ''),
          rede: String(getCell(row, ['Rede']) ?? ''),
          cliente: clienteTexto,
          cidade_cliente: String(getCell(row, ['Cidade Cliente']) ?? ''),
          uf: String(getCell(row, ['UF']) ?? ''),
          cod_cliente: codCliente,
          paletes,
          mes: getCell(row, ['Mês', 'Mes', 'Ms']) != null ? String(getCell(row, ['Mês', 'Mes', 'Ms'])) : null,
          erro_separacao: 0,
          erro_entregas: 0,
        }
      })

      const semFilial = processados.filter((d) => !d.id_filial)
      if (semFilial.length > 0) {
        const filiaisNaoEncontradas = [...new Set(semFilial.map((d) => d.filial))]
        setErro(
          `Filial não encontrada no cadastro: ${filiaisNaoEncontradas.join(', ')}. Corrija o arquivo ou cadastre as filiais.`
        )
        return
      }

      setDadosProcessados(processados)
      setPreview(true)
    } catch (error) {
      console.error('Erro ao processar arquivo:', error)
      setErro('Erro ao processar arquivo. Verifique se o formato está correto.')
    } finally {
      setProcessando(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setArquivo(file)
      processarArquivo(file)
    }
  }

  const registrarDados = async () => {
    setSalvando(true)
    setErro('')

    try {
      const payload = dadosProcessados.map((d) => {
        const obj: Record<string, unknown> = {}
        for (const key of CHAVES_INSERT) {
          if (key === 'paletes') continue
          const v = d[key]
          if (v !== undefined) obj[key] = v
        }
        return obj
      })

      const { error } = await supabase.from('dados_produtividade').insert(payload)

      if (error) throw error

      setTotalRegistrosSalvos(payload.length)
      setSucesso(true)
      setPreview(false)
      setDadosProcessados([])
      setArquivo(null)
      const input = document.getElementById('arquivo') as HTMLInputElement
      if (input) input.value = ''
    } catch (error: unknown) {
      const err = error as { code?: string }
      console.error('Erro ao salvar dados:', error)
      if (err?.code === '23505') {
        setErro('Alguns registros já existem no banco de dados.')
      } else {
        setErro('Erro ao salvar dados. Tente novamente.')
      }
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Upload de Dados</h1>
        <p className="text-muted-foreground">
          Importe arquivos Excel (.xlsx) com dados de produtividade
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Importar Arquivo</CardTitle>
          <CardDescription>
            Selecione um arquivo Excel (.xlsx) com os dados de extração do BI (cabeçalho na primeira linha)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sucesso && (
            <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-green-700">
                Dados registrados com sucesso! Total de {totalRegistrosSalvos} registros salvos.
              </span>
            </div>
          )}

          {erro && (
            <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="text-red-700">{erro}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="arquivo">Arquivo Excel</Label>
            <Input
              id="arquivo"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              disabled={processando || salvando}
            />
          </div>

          {processando && (
            <div className="flex items-center gap-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
              <span className="text-blue-700">Processando arquivo...</span>
            </div>
          )}

          {arquivo && !processando && (
            <div className="flex items-center gap-2 p-4 bg-gray-50 border rounded-lg">
              <FileSpreadsheet className="w-5 h-5 text-gray-600" />
              <div className="flex-1">
                <p className="text-sm font-medium">{arquivo.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(arquivo.size / 1024).toFixed(2)} KB
                </p>
              </div>
              {dadosProcessados.length > 0 && (
                <Badge variant="secondary">
                  {dadosProcessados.length} registros
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {preview && dadosProcessados.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Preview dos Dados</CardTitle>
            <CardDescription>
              Visualize os dados antes de confirmar o registro no banco
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID Carga Cliente</TableHead>
                      <TableHead>Filial</TableHead>
                      <TableHead>Carga</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>NF</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Peso (kg)</TableHead>
                      <TableHead>Volume</TableHead>
                      <TableHead>Paletes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dadosProcessados.slice(0, 10).map((dado, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono text-xs">{dado.id_carga_cliente}</TableCell>
                        <TableCell className="text-xs">{dado.filial}</TableCell>
                        <TableCell>{dado.carga}</TableCell>
                        <TableCell className="text-xs">{dado.data_carga}</TableCell>
                        <TableCell>{dado.nota_fiscal}</TableCell>
                        <TableCell className="text-xs max-w-xs truncate">{dado.cliente}</TableCell>
                        <TableCell className="text-right">{Number(dado.peso_liquido).toFixed(2)}</TableCell>
                        <TableCell className="text-right">{dado.qtd_venda}</TableCell>
                        <TableCell className="text-right">{Number(dado.paletes).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {dadosProcessados.length > 10 && (
              <p className="text-sm text-muted-foreground text-center">
                Mostrando 10 de {dadosProcessados.length} registros
              </p>
            )}

            <div className="flex gap-2">
              <Button
                onClick={registrarDados}
                disabled={salvando}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {salvando ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Registrar Dados no Banco
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setPreview(false)
                  setDadosProcessados([])
                  setArquivo(null)
                  const input = document.getElementById('arquivo') as HTMLInputElement
                  if (input) input.value = ''
                }}
                disabled={salvando}
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
