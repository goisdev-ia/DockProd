import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { FechamentoLinha, DadoProdutividadeRelatorio } from '../relatorios'
import { formatDateBR } from '@/lib/date-utils'

interface PdfOptions {
  mesNome: string
  ano: number
  filial?: string
  usuario?: string
}

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function getMesFormatado(mesNome: string, ano: number): string {
  const meses: Record<string, string> = {
    'janeiro': 'JAN', 'fevereiro': 'FEV', 'março': 'MAR', 'abril': 'ABR',
    'maio': 'MAI', 'junho': 'JUN', 'julho': 'JUL', 'agosto': 'AGO',
    'setembro': 'SET', 'outubro': 'OUT', 'novembro': 'NOV', 'dezembro': 'DEZ',
    'todos': 'TODOS'
  }
  const mesAbrev = meses[mesNome.toLowerCase()] || mesNome.toUpperCase().substring(0, 3)
  return `${mesAbrev}/${ano}`
}

/** Cor de preenchimento da célula Prod. Final: 0 = vermelho; 0–300 = verde claro → escuro. Retorna RGB [0-255]. */
function getProdFinalFillColor(value: number): [number, number, number] {
  if (value === 0) return [220, 38, 38]
  const r = Math.min(1, Math.max(0, value / 300))
  const lightness = 0.55 - r * 0.33
  const h = 140 / 360
  const s = 0.7
  const c = (1 - Math.abs(2 * lightness - 1)) * s
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1))
  const m = lightness - c / 2
  let red = 0; let green = 0; let blue = 0
  if (h * 6 < 1) { red = c; green = x; blue = 0 } else if (h * 6 < 2) { red = x; green = c; blue = 0 } else if (h * 6 < 3) { red = 0; green = c; blue = x } else { red = 0; green = x; blue = c }
  return [
    Math.round((red + m) * 255),
    Math.round((green + m) * 255),
    Math.round((blue + m) * 255),
  ]
}

export async function gerarRelatorioPDF(data: FechamentoLinha[], options: PdfOptions): Promise<Blob> {
  const { mesNome, ano, filial, usuario } = options
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 10

  const addFooter = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pageCount = (doc as any).internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(7)
      doc.setTextColor(120)
      doc.text(
        `DockProd - Relatório Gerado em ${new Date().toLocaleString('pt-BR')} | Página ${i} de ${pageCount}`,
        pageWidth / 2,
        pageHeight - 5,
        { align: 'center' }
      )
    }
  }

  // --- Header ---
  doc.setFillColor(34, 139, 34) // #228B22
  doc.rect(0, 0, pageWidth, 20, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('DockProd - Relatório de Produtividade', margin, 10)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Período: ${mesNome} ${ano}  |  Filial: ${filial || 'Todas'}  |  Usuário: ${usuario || '-'}  |  Gerado: ${new Date().toLocaleString('pt-BR')}`, margin, 16)

  let yPos = 26

  // --- Tabela 1: Fechamento Geral ---
  doc.setTextColor(34, 139, 34)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('1. Fechamento Geral', margin, yPos)
  yPos += 2

  const mesFormatado = getMesFormatado(mesNome, ano)
  const totais1 = {
    peso: data.reduce((s, r) => s + r.peso_liquido_total, 0),
    volume: data.reduce((s, r) => s + r.volume_total, 0),
    paletes: data.reduce((s, r) => s + r.paletes_total, 0),
    tempo: data.reduce((s, r) => s + r.tempo_total, 0),
    kgHs: data.length > 0 ? data.reduce((s, r) => s + r.kg_hs, 0) / data.length : 0,
    volHs: data.length > 0 ? data.reduce((s, r) => s + r.vol_hs, 0) / data.length : 0,
    pltHs: data.length > 0 ? data.reduce((s, r) => s + r.plt_hs, 0) / data.length : 0,
    prodFinal: data.reduce((s, r) => s + r.produtividade_final, 0),
    meta: data.reduce((s, r) => s + r.meta, 0),
    atingimento: data.length > 0 ? data.reduce((s, r) => s + r.percentual_atingimento, 0) / data.length : 0,
  }

  const PROD_FINAL_COL_IDX_TABLE1 = 10
  autoTable(doc, {
    startY: yPos,
    head: [['Mês', 'Filial', 'Colaborador', 'Peso Liq.', 'Volume', 'Paletes', 'Tempo', 'Kg/Hs', 'Vol/Hs', 'Plt/Hs', 'Prod. Final R$', 'Meta', '% Ating.']],
    body: data.map(r => [
      mesFormatado,
      r.filial_nome,
      r.colaborador_nome,
      fmt(r.peso_liquido_total),
      fmt(r.volume_total),
      fmt(r.paletes_total),
      fmt(r.tempo_total),
      fmt(r.kg_hs),
      fmt(r.vol_hs),
      fmt(r.plt_hs),
      fmt(r.produtividade_final),
      fmt(r.meta),
      `${fmt(r.percentual_atingimento, 1)}%`,
    ]),
    foot: [[
      'TOTAL',
      '',
      `${data.length} colab.`,
      fmt(totais1.peso),
      fmt(totais1.volume),
      fmt(totais1.paletes),
      fmt(totais1.tempo),
      fmt(totais1.kgHs),
      fmt(totais1.volHs),
      fmt(totais1.pltHs),
      fmt(totais1.prodFinal),
      fmt(totais1.meta),
      `${fmt(totais1.atingimento, 1)}%`,
    ]],
    theme: 'grid',
    headStyles: { fillColor: [34, 139, 34], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, font: 'helvetica' },
    bodyStyles: { fontSize: 6.5, font: 'helvetica', textColor: [0, 0, 0] },
    alternateRowStyles: { fillColor: [240, 253, 244] },
    footStyles: { fillColor: [22, 101, 52], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
    margin: { left: margin, right: margin },
    tableWidth: 'auto',
    didParseCell: (tableData) => {
      if (tableData.section === 'body' && tableData.column.index === PROD_FINAL_COL_IDX_TABLE1) {
        const rowIndex = tableData.row.index
        const value = data[rowIndex]?.produtividade_final ?? 0
        const cell = tableData.cell as { fillColor?: [number, number, number]; textColor?: number[]; fontStyle?: string }
        cell.fillColor = getProdFinalFillColor(value)
        cell.textColor = [255, 255, 255]
        cell.fontStyle = 'bold'
      }
    },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  yPos = (doc as any).lastAutoTable.finalY + 8

  // --- Tabela 2: Resultado (Valores) ---
  if (yPos > pageHeight - 40) { doc.addPage(); yPos = 15; }
  doc.setTextColor(34, 139, 34)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('2. Resultado (Valores)', margin, yPos)
  yPos += 2

  const totais2 = {
    vlrKgHs: data.reduce((s, r) => s + r.valor_kg_hs, 0),
    vlrVolHs: data.reduce((s, r) => s + r.valor_vol_hs, 0),
    vlrPltHs: data.reduce((s, r) => s + r.valor_plt_hs, 0),
    prodBruta: data.reduce((s, r) => s + r.produtividade_bruta, 0),
    percErros: data.length > 0 ? data.reduce((s, r) => s + r.percentual_erros, 0) / data.length : 0,
    percDescontos: data.length > 0 ? data.reduce((s, r) => s + r.percentual_descontos, 0) / data.length : 0,
    vlrDescontos: data.reduce((s, r) => s + r.valor_descontos, 0),
    prodFinal: data.reduce((s, r) => s + r.produtividade_final, 0),
    meta: data.reduce((s, r) => s + r.meta, 0),
    atingimento: data.length > 0 ? data.reduce((s, r) => s + r.percentual_atingimento, 0) / data.length : 0,
  }

  const PROD_FINAL_COL_IDX_TABLE2 = 10
  autoTable(doc, {
    startY: yPos,
    head: [['Mês', 'Filial', 'Colaborador', 'Vlr Kg/Hs', 'Vlr Vol/Hs', 'Vlr Plt/Hs', 'Prod. Bruta', '% Erros', '% Descontos', 'Vlr Descontos', 'Prod. Final R$', 'Meta', '% Ating.']],
    body: data.map(r => [
      mesFormatado,
      r.filial_nome,
      r.colaborador_nome,
      fmt(r.valor_kg_hs),
      fmt(r.valor_vol_hs),
      fmt(r.valor_plt_hs),
      fmt(r.produtividade_bruta),
      `${fmt(r.percentual_erros, 1)}%`,
      `${fmt(r.percentual_descontos, 1)}%`,
      fmt(r.valor_descontos),
      fmt(r.produtividade_final),
      fmt(r.meta),
      `${fmt(r.percentual_atingimento, 1)}%`,
    ]),
    foot: [[
      'TOTAL',
      '',
      `${data.length} colab.`,
      fmt(totais2.vlrKgHs),
      fmt(totais2.vlrVolHs),
      fmt(totais2.vlrPltHs),
      fmt(totais2.prodBruta),
      `${fmt(totais2.percErros, 1)}%`,
      `${fmt(totais2.percDescontos, 1)}%`,
      fmt(totais2.vlrDescontos),
      fmt(totais2.prodFinal),
      fmt(totais2.meta),
      `${fmt(totais2.atingimento, 1)}%`,
    ]],
    theme: 'grid',
    headStyles: { fillColor: [34, 139, 34], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, font: 'helvetica' },
    bodyStyles: { fontSize: 6.5, font: 'helvetica', textColor: [0, 0, 0] },
    alternateRowStyles: { fillColor: [240, 253, 244] },
    footStyles: { fillColor: [22, 101, 52], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
    margin: { left: margin, right: margin },
    didParseCell: (tableData) => {
      if (tableData.section === 'body' && tableData.column.index === PROD_FINAL_COL_IDX_TABLE2) {
        const rowIndex = tableData.row.index
        const value = data[rowIndex]?.produtividade_final ?? 0
        const cell = tableData.cell as { fillColor?: [number, number, number]; textColor?: number[]; fontStyle?: string }
        cell.fillColor = getProdFinalFillColor(value)
        cell.textColor = [255, 255, 255]
        cell.fontStyle = 'bold'
      }
    },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  yPos = (doc as any).lastAutoTable.finalY + 8

  // --- Tabela 3: Descontos ---
  if (yPos > pageHeight - 40) { doc.addPage(); yPos = 15; }
  doc.setTextColor(34, 139, 34)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('3. Descontos', margin, yPos)
  yPos += 2

  const totais3 = {
    errosSep: data.reduce((s, r) => s + r.erro_separacao_total, 0),
    errosEnt: data.reduce((s, r) => s + r.erro_entregas_total, 0),
    percErros: data.length > 0 ? data.reduce((s, r) => s + r.percentual_erros, 0) / data.length : 0,
    percDescontos: data.length > 0 ? data.reduce((s, r) => s + r.percentual_descontos, 0) / data.length : 0,
    vlrDescontos: data.reduce((s, r) => s + r.valor_descontos, 0),
  }

  autoTable(doc, {
    startY: yPos,
    head: [['Mês', 'Filial', 'Colaborador', 'Erros Sep.', 'Erros Ent.', '% Erros', '% Descontos', 'Vlr Descontos']],
    body: data.map(r => [
      mesFormatado,
      r.filial_nome,
      r.colaborador_nome,
      r.erro_separacao_total.toString(),
      r.erro_entregas_total.toString(),
      `${fmt(r.percentual_erros, 1)}%`,
      `${fmt(r.percentual_descontos, 1)}%`,
      fmt(r.valor_descontos),
    ]),
    foot: [[
      'TOTAL',
      '',
      `${data.length} colab.`,
      totais3.errosSep.toString(),
      totais3.errosEnt.toString(),
      `${fmt(totais3.percErros, 1)}%`,
      `${fmt(totais3.percDescontos, 1)}%`,
      fmt(totais3.vlrDescontos),
    ]],
    theme: 'grid',
    headStyles: { fillColor: [34, 139, 34], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, font: 'helvetica' },
    bodyStyles: { fontSize: 6.5, font: 'helvetica', textColor: [0, 0, 0] },
    alternateRowStyles: { fillColor: [240, 253, 244] },
    footStyles: { fillColor: [22, 101, 52], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
    margin: { left: margin, right: margin },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  yPos = (doc as any).lastAutoTable.finalY + 8

  // --- Tabela 4: Produtividade ---
  if (yPos > pageHeight - 40) { doc.addPage(); yPos = 15; }
  doc.setTextColor(34, 139, 34)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('4. Produtividade', margin, yPos)
  yPos += 2

  const totais4 = {
    peso: data.reduce((s, r) => s + r.peso_liquido_total, 0),
    volume: data.reduce((s, r) => s + r.volume_total, 0),
    paletes: data.reduce((s, r) => s + r.paletes_total, 0),
    tempo: data.reduce((s, r) => s + r.tempo_total, 0),
    kgHs: data.length > 0 ? data.reduce((s, r) => s + r.kg_hs, 0) / data.length : 0,
    volHs: data.length > 0 ? data.reduce((s, r) => s + r.vol_hs, 0) / data.length : 0,
    pltHs: data.length > 0 ? data.reduce((s, r) => s + r.plt_hs, 0) / data.length : 0,
  }

  autoTable(doc, {
    startY: yPos,
    head: [['Mês', 'Filial', 'Colaborador', 'Peso Liq.', 'Volume', 'Paletes', 'Tempo', 'Kg/Hs', 'Vol/Hs', 'Plt/Hs']],
    body: data.map(r => [
      mesFormatado,
      r.filial_nome,
      r.colaborador_nome,
      fmt(r.peso_liquido_total),
      fmt(r.volume_total),
      fmt(r.paletes_total),
      fmt(r.tempo_total),
      fmt(r.kg_hs),
      fmt(r.vol_hs),
      fmt(r.plt_hs),
    ]),
    foot: [[
      'TOTAL',
      '',
      `${data.length} colab.`,
      fmt(totais4.peso),
      fmt(totais4.volume),
      fmt(totais4.paletes),
      fmt(totais4.tempo),
      fmt(totais4.kgHs),
      fmt(totais4.volHs),
      fmt(totais4.pltHs),
    ]],
    theme: 'grid',
    headStyles: { fillColor: [34, 139, 34], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, font: 'helvetica' },
    bodyStyles: { fontSize: 6.5, font: 'helvetica', textColor: [0, 0, 0] },
    alternateRowStyles: { fillColor: [240, 253, 244] },
    footStyles: { fillColor: [22, 101, 52], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
    margin: { left: margin, right: margin },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  yPos = (doc as any).lastAutoTable.finalY + 8

  // --- Tabela 5: Resumo Geral ---
  if (yPos > pageHeight - 40) { doc.addPage(); yPos = 15; }
  doc.setTextColor(34, 139, 34)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('5. Resumo Geral', margin, yPos)
  yPos += 2

  const totalPeso = data.reduce((s, r) => s + r.peso_liquido_total, 0)
  const totalVolume = data.reduce((s, r) => s + r.volume_total, 0)
  const totalPaletes = data.reduce((s, r) => s + r.paletes_total, 0)
  const totalTempo = data.reduce((s, r) => s + r.tempo_total, 0)
  const totalProdFinal = data.reduce((s, r) => s + r.produtividade_final, 0)
  const totalMeta = data.reduce((s, r) => s + r.meta, 0)
  const mediaAtingimento = data.length > 0 ? data.reduce((s, r) => s + r.percentual_atingimento, 0) / data.length : 0

  autoTable(doc, {
    startY: yPos,
    head: [['Indicador', 'Valor']],
    body: [
      ['Total de Colaboradores', data.length.toString()],
      ['Peso Líquido Total', fmt(totalPeso)],
      ['Volume Total', fmt(totalVolume)],
      ['Paletes Total', fmt(totalPaletes)],
      ['Tempo Total', fmt(totalTempo)],
      ['Produtividade Final Total', `R$ ${fmt(totalProdFinal)}`],
      ['Meta Total', `R$ ${fmt(totalMeta)}`],
      ['Média de Atingimento', `${fmt(mediaAtingimento, 1)}%`],
    ],
    theme: 'grid',
    headStyles: { fillColor: [34, 139, 34], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8, font: 'helvetica' },
    bodyStyles: { fontSize: 7, font: 'helvetica', textColor: [0, 0, 0] },
    alternateRowStyles: { fillColor: [240, 253, 244] },
    margin: { left: margin, right: margin },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 60 },
      1: { cellWidth: 50 },
    },
  })

  addFooter()

  return doc.output('blob')
}

export interface PdfOptionsDadosGerais {
  usuario?: string
}

export async function gerarRelatorioPDFDadosGerais(
  data: DadoProdutividadeRelatorio[],
  options: PdfOptionsDadosGerais = {}
): Promise<Blob> {
  const { usuario } = options
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 10

  const addFooter = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pageCount = (doc as any).internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(7)
      doc.setTextColor(120)
      doc.text(
        `DockProd - Relatório Dados Gerais - Gerado em ${new Date().toLocaleString('pt-BR')} | Página ${i} de ${pageCount}`,
        pageWidth / 2,
        pageHeight - 5,
        { align: 'center' }
      )
    }
  }

  doc.setFillColor(34, 139, 34)
  doc.rect(0, 0, pageWidth, 20, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('DockProd - Relatório Dados Gerais (Produtividade)', margin, 10)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Usuário: ${usuario || '-'}  |  Gerado: ${new Date().toLocaleString('pt-BR')}  |  ${data.length} registro(s)`, margin, 16)

  const yPos = 26

  const head = [
    'ID Carga',
    'Carga',
    'Data',
    'Filial',
    'Cliente',
    'Colaborador',
    'Hora Inic.',
    'Hora Fim',
    'Tempo',
    'Erros Sep.',
    'Erros Ent.',
    'Observação',
    'Peso',
    'Volume',
    'Paletes',
    'Kg/Hs',
    'Vol/Hs',
    'Plt/Hs',
  ]
  const body = data.map((r) => [
    r.id_carga_cliente,
    r.carga,
    formatDateBR(r.data_carga),
    r.filial,
    (r.cliente ?? '').slice(0, 20),
    r.colaborador ?? '',
    r.hora_inicial ?? '',
    r.hora_final ?? '',
    r.tempo != null ? fmt(r.tempo) : '',
    String(r.erro_separacao),
    String(r.erro_entregas),
    (r.observacao ?? '').slice(0, 15),
    fmt(r.peso_liquido_total),
    fmt(r.volume_total),
    fmt(r.paletes_total),
    r.kg_hs != null ? fmt(r.kg_hs) : '',
    r.vol_hs != null ? fmt(r.vol_hs) : '',
    r.plt_hs != null ? fmt(r.plt_hs) : '',
  ])

  autoTable(doc, {
    startY: yPos,
    head: [head],
    body,
    theme: 'grid',
    headStyles: { fillColor: [34, 139, 34], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6, font: 'helvetica' },
    bodyStyles: { fontSize: 5.5, font: 'helvetica', textColor: [0, 0, 0] },
    alternateRowStyles: { fillColor: [240, 253, 244] },
    margin: { left: margin, right: margin },
    tableWidth: 'auto',
  })

  addFooter()
  return doc.output('blob')
}
