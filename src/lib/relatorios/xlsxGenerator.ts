import ExcelJS from 'exceljs'
import type { FechamentoLinha, DadoProdutividadeRelatorio } from '../relatorios'
import { formatDateBR } from '@/lib/date-utils'

interface XlsxOptions {
  mesNome: string
  ano: number
}

export interface XlsxOptionsDadosGerais {
  /** Opcional; usado no nome do arquivo se não fornecido usa data atual */
  dataGerado?: string
}

const DADOS_GERAIS_COLUMNS = [
  { header: 'ID Carga', key: 'id_carga_cliente', width: 18 },
  { header: 'Carga', key: 'carga', width: 12 },
  { header: 'Data', key: 'data_carga_br', width: 12 },
  { header: 'Filial', key: 'filial', width: 15 },
  { header: 'Cliente', key: 'cliente', width: 22 },
  { header: 'Colaborador', key: 'colaborador', width: 18 },
  { header: 'Hora Inicial', key: 'hora_inicial', width: 12 },
  { header: 'Hora Final', key: 'hora_final', width: 12 },
  { header: 'Tempo', key: 'tempo', width: 10 },
  { header: 'Erros Sep.', key: 'erro_separacao', width: 11 },
  { header: 'Erros Ent.', key: 'erro_entregas', width: 11 },
  { header: 'Observação', key: 'observacao', width: 18 },
  { header: 'Peso Liq.', key: 'peso_liquido_total', width: 12 },
  { header: 'Volume', key: 'volume_total', width: 12 },
  { header: 'Paletes', key: 'paletes_total', width: 10 },
  { header: 'Kg/Hs', key: 'kg_hs', width: 10 },
  { header: 'Vol/Hs', key: 'vol_hs', width: 10 },
  { header: 'Plt/Hs', key: 'plt_hs', width: 10 },
]

const UNIFIED_COLUMNS = [
  { header: 'Filial', key: 'filial_nome', width: 20 },
  { header: 'Colaborador', key: 'colaborador_nome', width: 25 },
  { header: 'Peso Liq. Total', key: 'peso_liquido_total', width: 16 },
  { header: 'Volume Total', key: 'volume_total', width: 14 },
  { header: 'Paletes Total', key: 'paletes_total', width: 14 },
  { header: 'Tempo Total', key: 'tempo_total', width: 13 },
  { header: 'Kg/Hs', key: 'kg_hs', width: 10 },
  { header: 'Vol/Hs', key: 'vol_hs', width: 10 },
  { header: 'Plt/Hs', key: 'plt_hs', width: 10 },
  { header: 'Erros Sep.', key: 'erro_separacao_total', width: 11 },
  { header: 'Erros Ent.', key: 'erro_entregas_total', width: 11 },
  { header: '% Erros', key: 'percentual_erros', width: 10 },
  { header: 'Vlr Kg/Hs', key: 'valor_kg_hs', width: 12 },
  { header: 'Vlr Vol/Hs', key: 'valor_vol_hs', width: 12 },
  { header: 'Vlr Plt/Hs', key: 'valor_plt_hs', width: 12 },
  { header: 'Prod. Bruta', key: 'produtividade_bruta', width: 13 },
  { header: '% Descontos', key: 'percentual_descontos', width: 13 },
  { header: 'Vlr Descontos', key: 'valor_descontos', width: 14 },
  { header: 'Prod. Final R$', key: 'produtividade_final', width: 15 },
  { header: 'Meta', key: 'meta', width: 10 },
  { header: '% Atingimento', key: 'percentual_atingimento', width: 14 },
]

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function gerarRelatorioXLSX(data: FechamentoLinha[], options: XlsxOptions): Promise<void> {
  const { mesNome, ano } = options
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'DockProd'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Relatório Unificado', {
    headerFooter: { firstHeader: `Relatório DockProd - ${mesNome} ${ano}` },
  })

  // Set columns
  sheet.columns = UNIFIED_COLUMNS.map(c => ({
    header: c.header,
    key: c.key,
    width: c.width,
  }))

  // Style header row
  const headerRow = sheet.getRow(1)
  headerRow.values = UNIFIED_COLUMNS.map(c => c.header) as unknown as ExcelJS.CellValue[]
  headerRow.height = 22
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF228B22' }, // #228B22
    }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF166534' } },
      left: { style: 'thin', color: { argb: 'FF166534' } },
      bottom: { style: 'thin', color: { argb: 'FF166534' } },
      right: { style: 'thin', color: { argb: 'FF166534' } },
    }
  })

  // Add data rows
  data.forEach((row) => {
    sheet.addRow({
      filial_nome: row.filial_nome,
      colaborador_nome: row.colaborador_nome,
      peso_liquido_total: row.peso_liquido_total,
      volume_total: row.volume_total,
      paletes_total: row.paletes_total,
      tempo_total: row.tempo_total,
      kg_hs: row.kg_hs,
      vol_hs: row.vol_hs,
      plt_hs: row.plt_hs,
      erro_separacao_total: row.erro_separacao_total,
      erro_entregas_total: row.erro_entregas_total,
      percentual_erros: row.percentual_erros,
      valor_kg_hs: row.valor_kg_hs,
      valor_vol_hs: row.valor_vol_hs,
      valor_plt_hs: row.valor_plt_hs,
      produtividade_bruta: row.produtividade_bruta,
      percentual_descontos: row.percentual_descontos,
      valor_descontos: row.valor_descontos,
      produtividade_final: row.produtividade_final,
      meta: row.meta,
      percentual_atingimento: row.percentual_atingimento,
    })
  })

  // Style data rows
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return // skip header
    row.height = 18
    row.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF000000' } }
      cell.alignment = { vertical: 'middle' }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD1FAE5' } },
        left: { style: 'thin', color: { argb: 'FFD1FAE5' } },
        bottom: { style: 'thin', color: { argb: 'FFD1FAE5' } },
        right: { style: 'thin', color: { argb: 'FFD1FAE5' } },
      }
    })
    // Alternate row colors
    if (rowNumber % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF0FDF4' },
        }
      })
    }
  })

  // Number formatting for numeric columns
  const numericKeys = [
    'peso_liquido_total', 'volume_total', 'paletes_total', 'tempo_total',
    'kg_hs', 'vol_hs', 'plt_hs', 'valor_kg_hs', 'valor_vol_hs', 'valor_plt_hs',
    'produtividade_bruta', 'valor_descontos', 'produtividade_final', 'meta',
  ]
  const pctKeys = ['percentual_erros', 'percentual_descontos', 'percentual_atingimento']

  UNIFIED_COLUMNS.forEach((col, idx) => {
    const colNum = idx + 1
    if (numericKeys.includes(col.key)) {
      sheet.getColumn(colNum).numFmt = '#,##0.00'
    }
    if (pctKeys.includes(col.key)) {
      sheet.getColumn(colNum).numFmt = '#,##0.0"%"'
    }
  })

  // Auto filter
  const lastCol = String.fromCharCode(64 + UNIFIED_COLUMNS.length)
  const lastRow = data.length + 1
  sheet.autoFilter = { from: 'A1', to: `${lastCol}${lastRow}` }

  // Freeze header row
  sheet.views = [{ state: 'frozen', ySplit: 1 }]

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  downloadBlob(blob, `relatorio-dockprod-${mesNome}-${ano}.xlsx`)
}

export async function gerarRelatorioXLSXDadosGerais(
  data: DadoProdutividadeRelatorio[],
  options: XlsxOptionsDadosGerais = {}
): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'DockProd'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Dados Gerais', {
    headerFooter: { firstHeader: 'DockProd - Relatório Dados Gerais (Produtividade)' },
  })

  sheet.columns = DADOS_GERAIS_COLUMNS.map(c => ({
    header: c.header,
    key: c.key,
    width: c.width,
  }))

  const headerRow = sheet.getRow(1)
  headerRow.values = DADOS_GERAIS_COLUMNS.map(c => c.header) as unknown as ExcelJS.CellValue[]
  headerRow.height = 22
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF228B22' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF166534' } },
      left: { style: 'thin', color: { argb: 'FF166534' } },
      bottom: { style: 'thin', color: { argb: 'FF166534' } },
      right: { style: 'thin', color: { argb: 'FF166534' } },
    }
  })

  data.forEach((row) => {
    sheet.addRow({
      id_carga_cliente: row.id_carga_cliente,
      carga: row.carga,
      data_carga_br: formatDateBR(row.data_carga),
      filial: row.filial,
      cliente: row.cliente ?? '',
      colaborador: row.colaborador ?? '',
      hora_inicial: row.hora_inicial ?? '',
      hora_final: row.hora_final ?? '',
      tempo: row.tempo,
      erro_separacao: row.erro_separacao,
      erro_entregas: row.erro_entregas,
      observacao: row.observacao ?? '',
      peso_liquido_total: row.peso_liquido_total,
      volume_total: row.volume_total,
      paletes_total: row.paletes_total,
      kg_hs: row.kg_hs,
      vol_hs: row.vol_hs,
      plt_hs: row.plt_hs,
    })
  })

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    row.height = 18
    row.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF000000' } }
      cell.alignment = { vertical: 'middle' }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD1FAE5' } },
        left: { style: 'thin', color: { argb: 'FFD1FAE5' } },
        bottom: { style: 'thin', color: { argb: 'FFD1FAE5' } },
        right: { style: 'thin', color: { argb: 'FFD1FAE5' } },
      }
    })
    if (rowNumber % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } }
      })
    }
  })

  const numericKeys = ['peso_liquido_total', 'volume_total', 'paletes_total', 'tempo', 'kg_hs', 'vol_hs', 'plt_hs']
  DADOS_GERAIS_COLUMNS.forEach((col, idx) => {
    const colNum = idx + 1
    if (numericKeys.includes(col.key)) {
      sheet.getColumn(colNum).numFmt = '#,##0.00'
    }
  })

  const lastCol = String.fromCharCode(64 + DADOS_GERAIS_COLUMNS.length)
  const lastRow = data.length + 1
  sheet.autoFilter = { from: 'A1', to: `${lastCol}${lastRow}` }
  sheet.views = [{ state: 'frozen', ySplit: 1 }]

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const filename = options.dataGerado
    ? `relatorio-dados-gerais-dockprod-${options.dataGerado}.xlsx`
    : `relatorio-dados-gerais-dockprod-${new Date().toISOString().slice(0, 10)}.xlsx`
  downloadBlob(blob, filename)
}
