import ExcelJS from 'exceljs'
import { createClient } from '@/lib/supabase/client'

const MES_NOME_TO_NUM: Record<string, string> = {
  janeiro: '01',
  fevereiro: '02',
  março: '03',
  abril: '04',
  maio: '05',
  junho: '06',
  julho: '07',
  agosto: '08',
  setembro: '09',
  outubro: '10',
  novembro: '11',
  dezembro: '12',
}

export function mesNomeParaNum(mesNome: string): string {
  return MES_NOME_TO_NUM[mesNome] ?? '01'
}

export interface FechamentoLinha {
  id: string
  id_colaborador: string
  id_filial: string
  mes: string
  ano: number
  colaborador_nome: string
  filial_nome: string
  peso_liquido_total: number
  volume_total: number
  paletes_total: number
  tempo_total: number
  kg_hs: number
  vol_hs: number
  plt_hs: number
  erro_separacao_total: number
  erro_entregas_total: number
  percentual_erros: number
  valor_kg_hs: number
  valor_vol_hs: number
  valor_plt_hs: number
  produtividade_bruta: number
  percentual_descontos: number
  valor_descontos: number
  produtividade_final: number
  meta: number
  percentual_atingimento: number
}

export async function fetchReportData(mesNum: string, ano: number) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('fechamento')
    .select(`
      id,
      id_colaborador,
      id_filial,
      mes,
      ano,
      peso_liquido_total,
      volume_total,
      paletes_total,
      tempo_total,
      kg_hs,
      vol_hs,
      plt_hs,
      erro_separacao_total,
      erro_entregas_total,
      percentual_erros,
      valor_kg_hs,
      valor_vol_hs,
      valor_plt_hs,
      produtividade_bruta,
      percentual_descontos,
      valor_descontos,
      produtividade_final,
      meta,
      percentual_atingimento,
      colaboradores (nome),
      filiais (nome)
    `)
    .eq('mes', mesNum)
    .eq('ano', ano)
    .order('id_filial')
    .order('id_colaborador')

  if (error) throw error

  const linhas: FechamentoLinha[] = (data ?? []).map((f: Record<string, unknown>) => ({
    id: f.id as string,
    id_colaborador: f.id_colaborador as string,
    id_filial: f.id_filial as string,
    mes: f.mes as string,
    ano: f.ano as number,
    colaborador_nome: (f.colaboradores as { nome?: string } | null)?.nome ?? '',
    filial_nome: (f.filiais as { nome?: string } | null)?.nome ?? '',
    peso_liquido_total: Number(f.peso_liquido_total ?? 0),
    volume_total: Number(f.volume_total ?? 0),
    paletes_total: Number(f.paletes_total ?? 0),
    tempo_total: Number(f.tempo_total ?? 0),
    kg_hs: Number(f.kg_hs ?? 0),
    vol_hs: Number(f.vol_hs ?? 0),
    plt_hs: Number(f.plt_hs ?? 0),
    erro_separacao_total: Number(f.erro_separacao_total ?? 0),
    erro_entregas_total: Number(f.erro_entregas_total ?? 0),
    percentual_erros: Number(f.percentual_erros ?? 0),
    valor_kg_hs: Number(f.valor_kg_hs ?? 0),
    valor_vol_hs: Number(f.valor_vol_hs ?? 0),
    valor_plt_hs: Number(f.valor_plt_hs ?? 0),
    produtividade_bruta: Number(f.produtividade_bruta ?? 0),
    percentual_descontos: Number(f.percentual_descontos ?? 0),
    valor_descontos: Number(f.valor_descontos ?? 0),
    produtividade_final: Number(f.produtividade_final ?? 0),
    meta: Number(f.meta ?? 300),
    percentual_atingimento: Number(f.percentual_atingimento ?? 0),
  }))
  return linhas
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const XLSX_COLUMNS = [
  { header: 'Filial', key: 'filial_nome', width: 18 },
  { header: 'Colaborador', key: 'colaborador_nome', width: 22 },
  { header: 'Peso Liq. Total', key: 'peso_liquido_total', width: 14 },
  { header: 'Volume Total', key: 'volume_total', width: 14 },
  { header: 'Paletes Total', key: 'paletes_total', width: 14 },
  { header: 'Tempo Total', key: 'tempo_total', width: 12 },
  { header: 'Kg/Hs', key: 'kg_hs', width: 10 },
  { header: 'Vol/Hs', key: 'vol_hs', width: 10 },
  { header: 'Plt/Hs', key: 'plt_hs', width: 10 },
  { header: 'Erros Sep.', key: 'erro_separacao_total', width: 10 },
  { header: 'Erros Ent.', key: 'erro_entregas_total', width: 10 },
  { header: 'Vlr Kg/Hs', key: 'valor_kg_hs', width: 10 },
  { header: 'Vlr Vol/Hs', key: 'valor_vol_hs', width: 10 },
  { header: 'Vlr Plt/Hs', key: 'valor_plt_hs', width: 10 },
  { header: 'Prod. Bruta', key: 'produtividade_bruta', width: 12 },
  { header: '% Descontos', key: 'percentual_descontos', width: 12 },
  { header: 'Prod. Final R$', key: 'produtividade_final', width: 14 },
  { header: 'Meta', key: 'meta', width: 10 },
  { header: '% Atingimento', key: 'percentual_atingimento', width: 14 },
]

export async function exportXLSX(data: FechamentoLinha[], mesNome: string, ano: number) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Fechamento', { headerFooter: { firstHeader: 'Relatório PickProd - Fechamento' } })

  sheet.columns = XLSX_COLUMNS as unknown as ExcelJS.Column[]
  const headerRow = sheet.getRow(1)
  headerRow.values = XLSX_COLUMNS.map((c) => c.header) as unknown as ExcelJS.CellValue[]
  headerRow.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF006400' },
  }
  sheet.addRows(data)
  const lastCol = String.fromCharCode(64 + XLSX_COLUMNS.length)
  const lastRow = data.length + 1
  sheet.autoFilter = { from: 'A1', to: `${lastCol}${lastRow}` }
  sheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF90EE90' } },
        left: { style: 'thin', color: { argb: 'FF90EE90' } },
        bottom: { style: 'thin', color: { argb: 'FF90EE90' } },
        right: { style: 'thin', color: { argb: 'FF90EE90' } },
      }
    })
  })

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  downloadBlob(blob, `relatorio-fechamento-${mesNome}-${ano}.xlsx`)
}

export function exportCSV(data: FechamentoLinha[], mesNome: string, ano: number) {
  const headers = [
    'Filial',
    'Colaborador',
    'Peso Liq. Total',
    'Volume Total',
    'Paletes Total',
    'Tempo Total',
    'Kg/Hs',
    'Vol/Hs',
    'Plt/Hs',
    'Erros Sep.',
    'Erros Ent.',
    'Vlr Kg/Hs',
    'Vlr Vol/Hs',
    'Vlr Plt/Hs',
    'Prod. Bruta',
    '% Descontos',
    'Prod. Final R$',
    'Meta',
    '% Atingimento',
  ]
  const escape = (v: string | number) => {
    const s = String(v)
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const rows = data.map((r) =>
    [
      r.filial_nome,
      r.colaborador_nome,
      r.peso_liquido_total,
      r.volume_total,
      r.paletes_total,
      r.tempo_total,
      r.kg_hs,
      r.vol_hs,
      r.plt_hs,
      r.erro_separacao_total,
      r.erro_entregas_total,
      r.valor_kg_hs,
      r.valor_vol_hs,
      r.valor_plt_hs,
      r.produtividade_bruta,
      r.percentual_descontos,
      r.produtividade_final,
      r.meta,
      r.percentual_atingimento,
    ].map(escape).join(',')
  )
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  downloadBlob(blob, `relatorio-fechamento-${String(mesNome).replace(/\s/g, '-')}-${ano}.csv`)
}

export function exportHTML(data: FechamentoLinha[], mesNome: string, ano: number) {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Relatório Fechamento - ${mesNome} ${ano}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 1rem; }
    h1 { color: #166534; }
    table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
    th, td { border: 1px solid #86efac; padding: 0.5rem; text-align: left; }
    th { background: #166534; color: #fff; }
    tr:nth-child(even) { background: #f0fdf4; }
  </style>
</head>
<body>
  <h1>PickProd - Relatório de Fechamento</h1>
  <p><strong>Período:</strong> ${mesNome} ${ano}</p>
  <p><strong>Gerado em:</strong> ${new Date().toLocaleString('pt-BR')}</p>
  <table>
    <thead>
      <tr>
        <th>Filial</th>
        <th>Colaborador</th>
        <th>Peso Liq.</th>
        <th>Volume</th>
        <th>Paletes</th>
        <th>Tempo</th>
        <th>Kg/Hs</th>
        <th>Vol/Hs</th>
        <th>Plt/Hs</th>
        <th>Prod. Final R$</th>
        <th>Meta</th>
        <th>% Ating.</th>
      </tr>
    </thead>
    <tbody>
      ${data
        .map(
          (r) => `
      <tr>
        <td>${r.filial_nome}</td>
        <td>${r.colaborador_nome}</td>
        <td>${r.peso_liquido_total.toFixed(2)}</td>
        <td>${r.volume_total.toFixed(2)}</td>
        <td>${r.paletes_total.toFixed(2)}</td>
        <td>${r.tempo_total.toFixed(2)}</td>
        <td>${r.kg_hs.toFixed(2)}</td>
        <td>${r.vol_hs.toFixed(2)}</td>
        <td>${r.plt_hs.toFixed(2)}</td>
        <td>${r.produtividade_final.toFixed(2)}</td>
        <td>${r.meta.toFixed(2)}</td>
        <td>${r.percentual_atingimento.toFixed(1)}%</td>
      </tr>`
        )
        .join('')}
    </tbody>
  </table>
</body>
</html>`
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function getWhatsAppSummaryLink(data: FechamentoLinha[], mesNome: string, ano: number): string {
  const totalProd = data.reduce((s, r) => s + r.produtividade_final, 0)
  const metaTotal = data.length * 300
  const atingimento = metaTotal > 0 ? ((totalProd / metaTotal) * 100).toFixed(1) : '0'
  const text = `*PickProd - Resumo ${mesNome} ${ano}*
• Total Produtividade: R$ ${totalProd.toFixed(2)}
• Colaboradores: ${data.length}
• % Atingimento: ${atingimento}%
Gerado em ${new Date().toLocaleDateString('pt-BR')}`
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}
