import type { FechamentoLinha, EvolucaoTemporalRow, DescontoReportRow, ResultadoReportRow, DadoColetaReportRow } from '../relatorios'
import { filterOutNaoInformado } from '../nao-informado'

interface HtmlOptions {
  mesNome: string
  ano: number
  filial?: string
  usuario?: string
  baseUrl?: string
}

/** Cor da célula Prod. Final: 0 = vermelho; 0–300 = verde claro → escuro; texto branco negrito. */
function getProdFinalCellStyle(value: number): string {
  if (value === 0) {
    return 'background-color:#dc2626;color:#fff;font-weight:bold'
  }
  const r = Math.min(1, Math.max(0, value / 300))
  const lightness = 55 - r * 33
  const h = 140
  const s = 0.7
  const l = lightness / 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let red = 0; let green = 0; let blue = 0
  if (h < 60) { red = c; green = x; blue = 0 } else if (h < 120) { red = x; green = c; blue = 0 } else if (h < 180) { red = 0; green = c; blue = x } else { red = 0; green = x; blue = c }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0')
  const bg = `#${toHex(red)}${toHex(green)}${toHex(blue)}`
  return `background-color:${bg};color:#fff;font-weight:bold`
}

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtMoeda(n: number): string {
  return 'R$ ' + fmt(n)
}

/** Mês/ano formatado para tabelas (ex.: Janeiro/2026). */
function getMesFormatadoLongo(mesNome: string, ano: number): string {
  const mesesLongos: Record<string, string> = {
    'janeiro': 'Janeiro', 'fevereiro': 'Fevereiro', 'março': 'Março', 'abril': 'Abril',
    'maio': 'Maio', 'junho': 'Junho', 'julho': 'Julho', 'agosto': 'Agosto',
    'setembro': 'Setembro', 'outubro': 'Outubro', 'novembro': 'Novembro', 'dezembro': 'Dezembro',
    'todos': 'Todos'
  }
  const nome = mesesLongos[mesNome.toLowerCase()] || mesNome
  return `${nome}/${ano}`
}

/** Primeiros 2 nomes do colaborador (igual ao Dashboard). */
function formatarNomeColab(nome: string): string {
  const partes = nome.trim().split(' ')
  if (partes.length >= 2) return `${partes[0]} ${partes[1]}`
  return partes[0] || nome
}

const ROWS_PER_PAGE = 50

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

export function gerarRelatorioHTML(
  data: FechamentoLinha[],
  options: HtmlOptions,
  evolucaoTemporal: EvolucaoTemporalRow[] = [],
  descontosData: DescontoReportRow[] = [],
  resultadosData: ResultadoReportRow[] = [],
  dadosPorColetaData: DadoColetaReportRow[] = []
): string {
  data = filterOutNaoInformado(data, (r) => r.colaborador_nome)
  const { mesNome, ano, filial, usuario, baseUrl } = options
  const logoUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}/logodockprod.png` : '/logodockprod.png'

  // Formatar evolução temporal para o gráfico (data_carga -> dd/MM)
  const evolucaoFormatada = evolucaoTemporal.map((r) => ({
    ...r,
    data_carga: (() => {
      const d = new Date(r.data_carga + 'T12:00:00')
      const day = String(d.getDate()).padStart(2, '0')
      const month = String(d.getMonth() + 1).padStart(2, '0')
      return `${day}/${month}`
    })(),
  }))
  const evolucaoLabels = JSON.stringify(evolucaoFormatada.map((r) => r.data_carga))
  const evolucaoKg = JSON.stringify(evolucaoFormatada.map((r) => Number(r.total_kg.toFixed(0))))
  const evolucaoVolume = JSON.stringify(evolucaoFormatada.map((r) => Number(r.total_volume.toFixed(0))))
  const evolucaoPaletes = JSON.stringify(evolucaoFormatada.map((r) => Number(r.total_paletes.toFixed(1))))

  // ========== KPI calculations ==========
  const totalColab = data.length
  // Aggregate unique filial totals to avoid doubling (each collaborator has filial totals, so we deduplicate)
  const filialTotaisMap = new Map<string, { peso: number; volume: number; paletes: number; tempo: number }>()
  data.forEach(r => {
    const key = `${r.id_filial}|${r.mes}|${r.ano}`
    if (!filialTotaisMap.has(key)) {
      filialTotaisMap.set(key, { peso: r.peso_liquido_total, volume: r.volume_total, paletes: r.paletes_total, tempo: r.tempo_total })
    }
  })
  const totalPeso = Array.from(filialTotaisMap.values()).reduce((s, v) => s + v.peso, 0)
  const totalVolume = Array.from(filialTotaisMap.values()).reduce((s, v) => s + v.volume, 0)
  const totalPaletes = Array.from(filialTotaisMap.values()).reduce((s, v) => s + v.paletes, 0)
  const totalTempo = Array.from(filialTotaisMap.values()).reduce((s, v) => s + v.tempo, 0)
  const totalProdFinal = data.reduce((s, r) => s + r.produtividade_final, 0)
  const totalMeta = data.reduce((s, r) => s + r.meta, 0)
  const mediaAtingimento = totalColab > 0 ? data.reduce((s, r) => s + r.percentual_atingimento, 0) / totalColab : 0
  const metaAtingidos = data.filter(r => r.percentual_atingimento >= 100).length
  const totalDescontos = data.reduce((s, r) => s + r.valor_descontos, 0)

  // ========== Chart Data Preparations ==========

  // 1. Evolução Temporal (por data) - dados já em evolucaoLabels, evolucaoKg, evolucaoVolume, evolucaoPaletes

  // 2. Performance por Colaborador (R$)
  const top10R$ = [...data].sort((a, b) => b.produtividade_final - a.produtividade_final).slice(0, 10)
  const colabR$Labels = JSON.stringify(top10R$.map(r => r.colaborador_nome.split(' ').slice(0, 2).join(' ')))
  const colabR$Values = JSON.stringify(top10R$.map(r => Number(r.produtividade_final.toFixed(2))))

  // 3. Totais por Colaborador (empilhado)
  const top8Totais = [...data].sort((a, b) => b.peso_liquido_total - a.peso_liquido_total).slice(0, 8)
  const totaisLabels = JSON.stringify(top8Totais.map(r => r.colaborador_nome.split(' ').slice(0, 2).join(' ')))
  const totaisPeso = JSON.stringify(top8Totais.map(r => Number(r.peso_liquido_total.toFixed(0))))
  const totaisVolume = JSON.stringify(top8Totais.map(r => Number(r.volume_total.toFixed(0))))
  const totaisPaletes = JSON.stringify(top8Totais.map(r => Number(r.paletes_total.toFixed(1))))

  // 4. Performance por Filial (R$)
  const byFilial = data.reduce<Record<string, { prod: number; peso: number; volume: number; paletes: number }>>((acc, r) => {
    if (!acc[r.filial_nome]) acc[r.filial_nome] = { prod: 0, peso: 0, volume: 0, paletes: 0 }
    acc[r.filial_nome].prod += r.produtividade_final
    acc[r.filial_nome].peso += r.peso_liquido_total
    acc[r.filial_nome].volume += r.volume_total
    acc[r.filial_nome].paletes += r.paletes_total
    return acc
  }, {})
  const filialEntries = Object.entries(byFilial).sort((a, b) => b[1].prod - a[1].prod)
  const filialLabels = JSON.stringify(filialEntries.map(e => e[0]))
  const filialProd = JSON.stringify(filialEntries.map(e => Number(e[1].prod.toFixed(2))))

  // 5. Totais por Filial (valores únicos por filial - deduplicar pois cada colaborador repete os totais da filial)
  const filialUnicaPorNome = new Map<string, { peso: number; volume: number; paletes: number }>()
  data.forEach(r => {
    if (!filialUnicaPorNome.has(r.filial_nome)) {
      filialUnicaPorNome.set(r.filial_nome, {
        peso: r.peso_liquido_total,
        volume: r.volume_total,
        paletes: r.paletes_total,
      })
    }
  })
  const filialPeso = JSON.stringify(filialEntries.map(e => Number((filialUnicaPorNome.get(e[0])?.peso ?? 0).toFixed(0))))
  const filialVolume = JSON.stringify(filialEntries.map(e => Number((filialUnicaPorNome.get(e[0])?.volume ?? 0).toFixed(0))))
  const filialPaletes = JSON.stringify(filialEntries.map(e => Number((filialUnicaPorNome.get(e[0])?.paletes ?? 0).toFixed(1))))

  // 8. Descontos em % dos Colaboradores: descontosData como fonte principal quando disponível; senão data (percentual_erros + percentual_descontos)
  const porColabDescontosPerc = descontosData.length > 0
    ? descontosData.reduce((acc, r) => {
        const nome = r.colaborador_nome || 'Sem nome'
        if (!acc[nome]) acc[nome] = { nome, percentual: 0 }
        acc[nome].percentual += r.percentual_total ?? 0
        return acc
      }, {} as Record<string, { nome: string; percentual: number }>)
    : data.reduce((acc, r) => {
        const nome = r.colaborador_nome || 'Sem nome'
        if (!acc[nome]) acc[nome] = { nome, percentual: 0 }
        acc[nome].percentual += (r.percentual_erros ?? 0) + (r.percentual_descontos ?? 0)
        return acc
      }, {} as Record<string, { nome: string; percentual: number }>)
  const descontosPercTop = Object.values(porColabDescontosPerc)
    .filter(d => d.percentual > 0)
    .sort((a, b) => b.percentual - a.percentual)
    .slice(0, 12)
    .map((d, i) => ({
      name: formatarNomeColab(d.nome),
      value: Math.round(d.percentual * 10) / 10,
      fill: ['#b91c1c', '#dc2626', '#ef4444', '#f87171', '#fca5a5', '#fecaca', '#991b1b', '#7f1d1d'][i % 8],
    }))
  const descontosPercLabels = JSON.stringify(descontosPercTop.map(d => d.name))
  const descontosPercValues = JSON.stringify(descontosPercTop.map(d => d.value))
  const descontosPercCores = JSON.stringify(descontosPercTop.map(d => d.fill))

  // 7. Descontos por Colaborador (R$)
  const descontosColab = [...data].filter(r => r.valor_descontos > 0).sort((a, b) => b.valor_descontos - a.valor_descontos).slice(0, 10)
  const descontosLabels = JSON.stringify(descontosColab.map(r => r.colaborador_nome.split(' ').slice(0, 2).join(' ')))
  const descontosValues = JSON.stringify(descontosColab.map(r => Number(r.valor_descontos.toFixed(2))))

  // ========== Totalizadores para as Tabelas ==========
  const mesFormatadoLongo = getMesFormatadoLongo(mesNome, ano)

  // Totais Produtividade (usar deduplicação por filial - mesmo valor nos cards)
  const totaisProdPesoVolumePaletes = Array.from(filialTotaisMap.values()).reduce(
    (acc, v) => ({ peso: acc.peso + v.peso, volume: acc.volume + v.volume, paletes: acc.paletes + v.paletes }),
    { peso: 0, volume: 0, paletes: 0 }
  )
  const totaisProd = {
    peso: totaisProdPesoVolumePaletes.peso,
    volume: totaisProdPesoVolumePaletes.volume,
    paletes: totaisProdPesoVolumePaletes.paletes,
    tempo: data.reduce((s, r) => s + r.tempo_total, 0),
    kgHs: totalColab > 0 ? data.reduce((s, r) => s + r.kg_hs, 0) / totalColab : 0,
    volHs: totalColab > 0 ? data.reduce((s, r) => s + r.vol_hs, 0) / totalColab : 0,
    pltHs: totalColab > 0 ? data.reduce((s, r) => s + r.plt_hs, 0) / totalColab : 0,
  }

  // Tabelas paginadas (máx 50 registros por página)
  const prodChunks = chunkArray(data, ROWS_PER_PAGE)
  const prodTablesHtml = prodChunks
    .map((chunk, idx) => {
      const isLast = idx === prodChunks.length - 1
      const tbody = chunk
        .map(
          (r) =>
            `<tr><td>${mesFormatadoLongo}</td><td>${r.filial_nome}</td><td>${r.colaborador_nome}</td><td class="text-right">${fmt(r.peso_liquido_total, 2)}</td><td class="text-right">${fmt(r.volume_total, 0)}</td><td class="text-right">${fmt(r.paletes_total, 1)}</td><td class="text-right">${fmt(r.tempo_total, 1)}</td><td class="text-right">${fmt(r.kg_hs)}</td><td class="text-right">${fmt(r.vol_hs)}</td><td class="text-right">${fmt(r.plt_hs)}</td></tr>`
        )
        .join('')
      const tfoot = isLast
        ? `<tfoot><tr class="total-row"><td colspan="3"><strong>TOTAL (${data.length} colab.)</strong></td><td class="text-right"><strong>${fmt(totaisProd.peso, 2)}</strong></td><td class="text-right"><strong>${fmt(totaisProd.volume, 0)}</strong></td><td class="text-right"><strong>${fmt(totaisProd.paletes, 1)}</strong></td><td class="text-right"><strong>${fmt(totaisProd.tempo, 1)}</strong></td><td class="text-right"><strong>${fmt(totaisProd.kgHs)}</strong></td><td class="text-right"><strong>${fmt(totaisProd.volHs)}</strong></td><td class="text-right"><strong>${fmt(totaisProd.pltHs)}</strong></td></tr></tfoot>`
        : ''
      return `<div class="table-page"><table><thead><tr><th>Mês</th><th>Filial</th><th>Colaborador</th><th class="text-right">Peso Liq.</th><th class="text-right">Volume</th><th class="text-right">Paletes</th><th class="text-right">Tempo</th><th class="text-right">Kg/Hs</th><th class="text-right">Vol/Hs</th><th class="text-right">Plt/Hs</th></tr></thead><tbody>${tbody}</tbody>${tfoot}</table></div>`
    })
    .join('')

  // Tabela de Descontos (fonte: tabela descontos) - colunas: Colaborador, Filial, Mês/Ano, Faltas, Férias, Advertências, Suspensões, Atestado (dias), % Total, Observação
  const descSource = descontosData.length > 0 ? descontosData : []
  const descChunks = chunkArray(descSource, ROWS_PER_PAGE)
  const descTablesHtml = descChunks
    .map((chunk, idx) => {
      const isLast = idx === descChunks.length - 1
      const tbody = chunk
        .map(
          (r) =>
            `<tr><td>${r.colaborador_nome}</td><td>${r.filial_nome}</td><td>${r.mes_ano_formatado}</td><td class="text-center">${r.falta_injustificada}</td><td class="text-center">${r.ferias}</td><td class="text-center">${r.advertencia}</td><td class="text-center">${r.suspensao}</td><td class="text-center">${r.atestado}</td><td class="text-center">${fmt(r.percentual_total, 0)}%</td><td>${r.observacao || '—'}</td></tr>`
        )
        .join('')
      const totalDesc = descSource.length
      const tfoot = isLast && totalDesc > 0
        ? `<tfoot><tr class="total-row"><td colspan="3"><strong>TOTAL (${totalDesc} desconto${totalDesc !== 1 ? 's' : ''})</strong></td><td colspan="7"></td></tr></tfoot>`
        : ''
      return `<div class="table-page"><table><thead><tr><th>Colaborador</th><th>Filial</th><th>Mês/Ano</th><th class="text-center">Faltas</th><th class="text-center">Férias</th><th class="text-center">Advertências</th><th class="text-center">Suspensões</th><th class="text-center">Atestado (dias)</th><th class="text-center">% Total</th><th>Observação</th></tr></thead><tbody>${tbody}</tbody>${tfoot}</table></div>`
    })
    .join('')

  // Tabela de Fechamento / Resultado (fonte: tabela resultados) - colunas: Filial, Mes/Ano, Função, Matrícula, Colaborador, Vlr Acuracidade, Vlr Checklist, Vlr Plt/Hs, Vlr Perda, Desconto, Prod. Final R$, Meta
  const fechSource = resultadosData.length > 0 ? resultadosData : []
  const coletaSource = dadosPorColetaData.length > 0 ? dadosPorColetaData : []
  const totaisResultados = fechSource.length > 0 ? fechSource.reduce((acc, r) => ({
    vlrAcu: acc.vlrAcu + r.vlr_acuracidade,
    vlrChk: acc.vlrChk + r.vlr_checklist,
    vlrPlt: acc.vlrPlt + r.vlr_plt_hs,
    vlrPerda: acc.vlrPerda + r.vlr_perda,
    desconto: acc.desconto + r.desconto,
    prodFinal: acc.prodFinal + r.prod_final,
    meta: acc.meta + r.meta,
  }), { vlrAcu: 0, vlrChk: 0, vlrPlt: 0, vlrPerda: 0, desconto: 0, prodFinal: 0, meta: 0 }) : null
  const mediaAtingResultados = totaisResultados && fechSource.length > 0 && totaisResultados.meta > 0
    ? (totaisResultados.prodFinal / (fechSource.length * 250)) * 100
    : 0
  const fechChunks = chunkArray(fechSource, ROWS_PER_PAGE)
  const fechTablesHtml = fechChunks
    .map((chunk, idx) => {
      const isLast = idx === fechChunks.length - 1
      const tbody = chunk
        .map((r) => {
          const pctMeta = r.meta > 0 ? Math.min((r.prod_final / r.meta) * 100, 100) : 0
          return `<tr><td>${r.filial_nome}</td><td>${r.mes_ano_formatado}</td><td>${r.funcao}</td><td>${r.matricula}</td><td>${r.colaborador_nome}</td><td class="text-right">${fmtMoeda(r.vlr_acuracidade)}</td><td class="text-right">${fmtMoeda(r.vlr_checklist)}</td><td class="text-right">${fmtMoeda(r.vlr_plt_hs)}</td><td class="text-right">${fmtMoeda(r.vlr_perda)}</td><td class="text-right">${fmtMoeda(r.desconto)}</td><td class="text-right cell-prod-final" style="${getProdFinalCellStyle(r.prod_final)}">${fmtMoeda(r.prod_final)}</td><td>Meta ${fmtMoeda(r.meta)} / ${fmt(pctMeta, 0)}%</td></tr>`
        })
        .join('')
      const totalFech = fechSource.length
      const tfoot = isLast && totaisResultados
        ? `<tfoot><tr class="total-row"><td colspan="5"><strong>TOTAL (${totalFech} colab.)</strong></td><td class="text-right"><strong>${fmtMoeda(totaisResultados.vlrAcu)}</strong></td><td class="text-right"><strong>${fmtMoeda(totaisResultados.vlrChk)}</strong></td><td class="text-right"><strong>${fmtMoeda(totaisResultados.vlrPlt)}</strong></td><td class="text-right"><strong>${fmtMoeda(totaisResultados.vlrPerda)}</strong></td><td class="text-right"><strong>${fmtMoeda(totaisResultados.desconto)}</strong></td><td class="text-right"><strong>${fmtMoeda(totaisResultados.prodFinal)}</strong></td><td class="text-center"><strong>${fmt(mediaAtingResultados, 1)}%</strong></td></tr></tfoot>`
        : ''
      return `<div class="table-page"><table><thead><tr><th>Filial</th><th>Mes/Ano</th><th>Função</th><th>Matrícula</th><th>Colaborador</th><th class="text-right">Vlr Acuracidade</th><th class="text-right">Vlr Checklist</th><th class="text-right">Vlr Plt/Hs</th><th class="text-right">Vlr Perda</th><th class="text-right">Desconto</th><th class="text-right">Prod. Final R$</th><th>Meta</th></tr></thead><tbody>${tbody}</tbody>${tfoot}</table></div>`
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Relatório DockProd - ${mesNome} ${ano}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"><\/script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.min.js"><\/script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  
  @page {
    size: A4 portrait;
    margin: 15mm;
  }
  
  body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background: #f3f4f6;
    color: #333;
    font-size: 11px;
    padding: 10px;
    margin: 0;
  }
  
  /* Container A4 real: largura máxima 210mm */
  .report-page {
    max-width: 210mm;
    margin: 0 auto;
    padding: 0;
    background: white;
    min-height: 100vh;
  }

  /* ===== SESSÃO 1: HEADER ===== */
  .header {
    background: linear-gradient(135deg, #166534, #228B22);
    color: white;
    padding: 10px 12px;
    border-radius: 6px;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    gap: 12px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .header-logo {
    width: 44px;
    height: 44px;
    background: white;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    overflow: hidden;
  }
  .header-logo img { width: 90%; height: 90%; object-fit: contain; }
  .header h1 { font-size: 18px; margin-bottom: 3px; font-weight: bold; }
  .header-info { font-size: 9px; opacity: 0.95; line-height: 1.4; }

  /* ===== SESSÃO 2: KPI CARDS - estilo Shadcn (branco, borda sutil, sombra leve) ===== */
  .first-page { margin-bottom: 0; }
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 10px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .kpi-card {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 12px 14px;
    background: #fff;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .kpi-title { font-size: 11px; color: #64748b; font-weight: 500; margin-bottom: 4px; }
  .kpi-value { font-size: 18px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em; }
  .kpi-desc { font-size: 11px; color: #94a3b8; margin-top: 4px; }

  /* ===== SESSÃO 3: GRÁFICOS - 2 por linha, altura fixa ===== */
  .charts-section {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .chart-full {
    margin-bottom: 10px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .chart-full-container {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 8px;
    background: white;
    height: 160px;
    position: relative;
    width: 100%;
  }
  .chart-full-title { font-size: 14px; font-weight: 600; color: #0f172a; margin-bottom: 2px; }
  .chart-full-desc { font-size: 12px; color: #64748b; margin-bottom: 6px; }
  .chart-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    margin-bottom: 10px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .chart-card {
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 8px;
    background: white;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .chart-card h3 {
    font-size: 10px;
    color: #166534;
    margin-bottom: 4px;
    border-bottom: 1px solid #228B22;
    padding-bottom: 2px;
  }
  .chart-container {
    height: 150px;
    position: relative;
    width: 100%;
  }

  /* ===== SESSÃO 4: TABELAS ===== */
  .page-break { page-break-before: always; break-before: page; }
  .table-page { page-break-inside: avoid; break-inside: avoid; margin-bottom: 8px; }
  .table-page + .table-page { page-break-before: always; break-before: page; }
  .section-title {
    font-size: 12px;
    font-weight: bold;
    color: #166534;
    margin: 8px 0 6px;
    border-bottom: 2px solid #228B22;
    padding-bottom: 4px;
    page-break-after: avoid;
    break-after: avoid;
  }
  table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 0; }
  thead { background: #228B22; color: white; display: table-header-group; }
  th { padding: 5px 4px; text-align: left; font-weight: bold; font-size: 10px; white-space: nowrap; }
  td { padding: 4px; border: 1px solid #d1fae5; word-break: break-word; font-size: 10px; }
  tbody tr:nth-child(even) { background: #f0fdf4; }
  tbody tr { page-break-inside: avoid; break-inside: avoid; }
  tfoot { background: #166534; color: white; font-weight: bold; display: table-footer-group; }
  tfoot td { padding: 5px 4px; border: 1px solid #166534; font-size: 10px; }
  .total-row td { font-weight: bold; }
  .text-right { text-align: right; }
  .text-center { text-align: center; }
  .meta-ok { color: #16a34a; font-weight: bold; }
  .meta-fail { color: #dc2626; font-weight: bold; }
  .cell-prod-final { color: #fff; font-weight: bold; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  .footer {
    margin-top: 12px;
    padding-top: 8px;
    border-top: 2px solid #228B22;
    text-align: center;
    font-size: 9px;
    color: #6b7280;
  }

  .no-print {
    position: fixed;
    top: 10px;
    right: 10px;
    z-index: 1000;
    background: #228B22;
    color: white;
    border: none;
    padding: 10px 18px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: bold;
    font-size: 12px;
  }

  @media print {
    body { background: white; padding: 0; margin: 0; }
    .no-print { display: none !important; }
    .report-page { max-width: 100%; padding: 0; box-shadow: none; }
    .kpi-card, .chart-card, .chart-full { box-shadow: none !important; }
    .chart-full-container { height: 170px !important; }
    .chart-container { height: 160px !important; }
    .first-page { page-break-after: avoid; }
    .page-break { page-break-before: always !important; break-before: page !important; }
    .table-page + .table-page { page-break-before: always !important; break-before: page !important; }
    .section-title { margin-top: 6px !important; margin-bottom: 4px !important; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }

  @media (max-width: 600px) {
    .kpi-grid { grid-template-columns: 1fr; }
    .chart-grid { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>
<button class="no-print" onclick="window.print()">Imprimir / PDF</button>

<div class="report-page">
<div class="first-page">
<!-- ============ SESSÃO 1: CABEÇALHO ============ -->
<div class="header">
  <div class="header-logo">
    <img src="${logoUrl}" alt="DockProd" onerror="this.parentElement.innerHTML='DP'" />
  </div>
  <div>
    <h1>DockProd - Relatório de Produtividade</h1>
    <div class="header-info">
      <strong>Período:</strong> ${mesNome === 'todos' ? 'Todos os Meses' : mesNome} ${ano} &nbsp;|&nbsp;
      <strong>Filial:</strong> ${filial || 'Todas'} &nbsp;|&nbsp;
      <strong>Usuário:</strong> ${usuario || '-'} &nbsp;|&nbsp;
      <strong>Gerado em:</strong> ${new Date().toLocaleString('pt-BR')}
    </div>
  </div>
</div>

<!-- ============ SESSÃO 2: 8 KPI CARDS (estilo Shadcn) ============ -->
<div class="kpi-grid">
  <div class="kpi-card">
    <div class="kpi-title">Colaboradores</div>
    <div class="kpi-value">${totalColab}</div>
    <div class="kpi-desc">Total no período</div>
  </div>
  <div class="kpi-card">
    <div class="kpi-title">Prod. Final Total</div>
    <div class="kpi-value">${fmtMoeda(totalProdFinal)}</div>
    <div class="kpi-desc">Soma de todos</div>
  </div>
  <div class="kpi-card">
    <div class="kpi-title">Meta Total</div>
    <div class="kpi-value">${fmtMoeda(totalMeta)}</div>
    <div class="kpi-desc">${metaAtingidos} atingiram meta</div>
  </div>
  <div class="kpi-card">
    <div class="kpi-title">Média Atingimento</div>
    <div class="kpi-value">${fmt(mediaAtingimento, 1)}%</div>
    <div class="kpi-desc">Média geral</div>
  </div>
  <div class="kpi-card">
    <div class="kpi-title">Peso Liq. Total</div>
    <div class="kpi-value">${fmt(totalPeso, 2)} kg</div>
    <div class="kpi-desc">${fmt(totalPeso / 1000, 1)} toneladas</div>
  </div>
  <div class="kpi-card">
    <div class="kpi-title">Volume Total</div>
    <div class="kpi-value">${fmt(totalVolume, 0)}</div>
    <div class="kpi-desc">unidades</div>
  </div>
  <div class="kpi-card">
    <div class="kpi-title">Paletes Total</div>
    <div class="kpi-value">${fmt(totalPaletes, 1)}</div>
    <div class="kpi-desc">unidades</div>
  </div>
  <div class="kpi-card">
    <div class="kpi-title">Total Descontos</div>
    <div class="kpi-value">${fmtMoeda(totalDescontos)}</div>
    <div class="kpi-desc">${fmt(totalTempo, 1)}h tempo total</div>
  </div>
</div>

<!-- ============ SESSÃO 3: 7 GRÁFICOS (2 por linha, altura fixa) ============ -->
<div class="charts-section">
<!-- Gráfico 1 - Evolução Temporal por data (igual ao dashboard) -->
<div class="chart-full">
  <div class="chart-full-title">1. Evolução Temporal</div>
  <div class="chart-full-desc">Peso líquido, Volume e Paletes ao longo do tempo</div>
  <div class="chart-full-container"><canvas id="chartEvolucao"></canvas></div>
</div>

<!-- Gráficos 2-7 em grid 2x3 -->
<div class="chart-grid">
  <div class="chart-card">
    <h3>2. Performance por Colaborador (R$)</h3>
    <div class="chart-container"><canvas id="chartColabR$"></canvas></div>
  </div>
  <div class="chart-card">
    <h3>3. Totais por Colaborador</h3>
    <div class="chart-container"><canvas id="chartColabTotais"></canvas></div>
  </div>
</div>
<div class="chart-grid">
  <div class="chart-card">
    <h3>4. Produtividade por Filial (R$)</h3>
    <div class="chart-container"><canvas id="chartFilialR$"></canvas></div>
  </div>
  <div class="chart-card">
    <h3>5. Totais por Filial</h3>
    <div class="chart-container"><canvas id="chartFilialTotais"></canvas></div>
  </div>
</div>
<div class="chart-grid">
  <div class="chart-card">
    <h3>8. Descontos em % dos Colaboradores</h3>
    <div class="chart-container"><canvas id="chartDescontosPerc"></canvas></div>
  </div>
  <div class="chart-card">
    <h3>7. Descontos por Colaborador (R$)</h3>
    <div class="chart-container"><canvas id="chartDescontos"></canvas></div>
  </div>
</div>
</div>
</div>

<!-- ============ SESSÃO 4: TABELAS (a partir da 2ª página; mínima separação entre tabelas) ============ -->
<div class="section-title page-break">Tabela de Produtividade (${data.length} registros)</div>
${prodTablesHtml}

<!-- Tabela de Indicadores (resultados brutos: Plt/Hs, Acuracidade, Checklist, Perda) -->
<div class="section-title">Indicadores por Colaborador (${fechSource.length} registros)</div>
${(function buildIndicadoresTable() {
  const indChunks = chunkArray(fechSource, ROWS_PER_PAGE)
  return indChunks
    .map((chunk) => {
      const tbody = chunk
        .map((r) => {
          const pltHsStr = r.plt_hs != null ? fmt(r.plt_hs, 2) : '—'
          const acuStr = r.acuracidade != null ? fmt(r.acuracidade, 2) + ' %' : '—'
          const chkStr = r.checklist != null ? fmt(r.checklist, 2) + ' %' : '—'
          const perdaStr = r.perda != null ? fmt(r.perda, 2) + ' %' : '—'
          return '<tr><td>' + r.mes_ano_formatado + '</td><td>' + r.filial_nome + '</td><td>' + r.colaborador_nome + '</td><td class="text-right">' + pltHsStr + '</td><td class="text-right">' + acuStr + '</td><td class="text-right">' + chkStr + '</td><td class="text-right">' + perdaStr + '</td></tr>'
        })
        .join('')
      return '<div class="table-page"><table><thead><tr><th>Mes/Ano</th><th>Filial</th><th>Colaborador</th><th class="text-right">Plt/Hs</th><th class="text-right">Acuracidade</th><th class="text-right">Checklist</th><th class="text-right">Perda</th></tr></thead><tbody>' + tbody + '</tbody></table></div>'
    })
    .join('')
})()}

<div class="section-title">Tabela de Descontos (${descSource.length} registros)</div>
${descTablesHtml}

<div class="section-title">Tabela de Fechamento / Resultado (${fechSource.length} registros)</div>
${fechTablesHtml}

<div class="section-title">Dados por Coleta (${coletaSource.length} registros)</div>
${(function buildDadosPorColetaTable() {
  const coletaChunks = chunkArray(coletaSource, ROWS_PER_PAGE)
  return coletaChunks
    .map((chunk) => {
      const tbody = chunk
        .map((r) => {
          const pltHsStr = r.plt_hs != null ? fmt(r.plt_hs, 2) : '—'
          const volHsStr = r.vol_hs != null ? fmt(r.vol_hs, 2) : '—'
          const kgHsStr = r.kg_hs != null ? fmt(r.kg_hs, 2) : '—'
          const tempoStr = r.tempo_horas != null ? fmt(r.tempo_horas, 2) : '—'
          return '<tr><td>' + r.mes_ano + '</td><td>' + r.filial + '</td><td>' + r.coleta + '</td><td>' + (r.fornec || '—') + '</td><td>' + r.dta_receb + '</td><td class="text-right">' + fmt(r.qtd_caixas, 0) + '</td><td class="text-right">' + fmt(r.peso_liquido, 2) + '</td><td class="text-right">' + fmt(r.qtd_paletes, 2) + '</td><td class="text-right">' + (r.hora_inicial || '—') + '</td><td class="text-right">' + (r.hora_final || '—') + '</td><td class="text-right">' + tempoStr + '</td><td class="text-right">' + kgHsStr + '</td><td class="text-right">' + volHsStr + '</td><td class="text-right">' + pltHsStr + '</td></tr>'
        })
        .join('')
      return '<div class="table-page"><table><thead><tr><th>Mes/Ano</th><th>Filial</th><th>Coleta</th><th>Fornec</th><th>Dta Receb</th><th class="text-right">Qtd Caixas</th><th class="text-right">Peso Líq.</th><th class="text-right">Qtd Paletes</th><th class="text-right">Hora Inicial</th><th class="text-right">Hora Final</th><th class="text-right">Tempo (h)</th><th class="text-right">Kg/Hs</th><th class="text-right">Vol/Hs</th><th class="text-right">Plt/Hs</th></tr></thead><tbody>' + tbody + '</tbody></table></div>'
    })
    .join('')
})()}

<div class="footer">
  <p>Relatório gerado automaticamente pelo Sistema DockProd &copy; ${new Date().getFullYear()}</p>
  <p>Data de geração: ${new Date().toLocaleString('pt-BR')}</p>
</div>
</div>

<script>
  Chart.defaults.font.size = 9;
  Chart.defaults.color = '#333';
  if (typeof ChartDataLabels !== 'undefined') Chart.register(ChartDataLabels);

  const commonOpts = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 4, right: 4, bottom: 4, left: 4 } },
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', titleColor: '#fff', bodyColor: '#fff', borderColor: '#228B22', borderWidth: 1 }
    }
  };
  const datalabelsOpt = {
    color: '#fff',
    font: { size: 8, weight: 'bold' },
    anchor: 'end',
    align: 'top',
    formatter: function(v) { return v != null ? Number(v).toLocaleString('pt-BR') : ''; }
  };

  const evolucaoDataLength = ${evolucaoFormatada.length};
  const chartEvolEl = document.getElementById('chartEvolucao');
  if (evolucaoDataLength > 0) {
    new Chart(chartEvolEl, {
      type: 'line',
      data: {
        labels: ${evolucaoLabels},
        datasets: [
          { label: 'Peso (kg)', data: ${evolucaoKg}, borderColor: '#166534', backgroundColor: 'rgba(22,101,52,0.3)', fill: true, tension: 0.3, pointRadius: 2 },
          { label: 'Volume', data: ${evolucaoVolume}, borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,0.3)', fill: true, tension: 0.3, pointRadius: 2 },
          { label: 'Paletes', data: ${evolucaoPaletes}, borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.3)', fill: true, tension: 0.3, pointRadius: 2 }
        ]
      },
      options: {
        ...commonOpts,
        plugins: { ...commonOpts.plugins, legend: { display: true, position: 'top', labels: { font: { size: 9 }, boxWidth: 10, padding: 4 } } },
        scales: {
          x: { ticks: { font: { size: 9 }, maxRotation: 45, maxTicksLimit: 14 } },
          y: { beginAtZero: true, ticks: { font: { size: 9 } } }
        }
      }
    });
  } else {
    chartEvolEl.parentElement.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#64748b;font-size:12px;">Sem dados no período</div>';
  }

  // 2. Performance Colaborador R$ (valores dentro das barras)
  const chartColabREl = document.getElementById('chartColabR$');
  const colabRDataLength = ${top10R$.length};
  if (colabRDataLength > 0) {
  new Chart(chartColabREl, {
    type: 'bar',
    data: {
      labels: ${colabR$Labels},
      datasets: [{ label: 'R$', data: ${colabR$Values}, backgroundColor: '#166534', borderRadius: 3 }]
    },
    options: {
      ...commonOpts,
      plugins: { ...commonOpts.plugins, datalabels: datalabelsOpt },
      scales: {
        x: { ticks: { font: { size: 9 }, maxRotation: 45, maxTicksLimit: 10 } },
        y: { beginAtZero: true, ticks: { font: { size: 9 }, callback: v => 'R$ ' + v.toLocaleString('pt-BR') } }
      }
    }
  });
  } else {
    chartColabREl.parentElement.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#64748b;font-size:12px;">Sem dados</div>';
  }

  // 3. Totais Colaborador (empilhado - valores nas barras)
  new Chart(document.getElementById('chartColabTotais'), {
    type: 'bar',
    data: {
      labels: ${totaisLabels},
      datasets: [
        { label: 'Peso', data: ${totaisPeso}, backgroundColor: '#166534', stack: 'a' },
        { label: 'Volume', data: ${totaisVolume}, backgroundColor: '#16a34a', stack: 'a' },
        { label: 'Paletes', data: ${totaisPaletes}, backgroundColor: '#22c55e', stack: 'a' }
      ]
    },
    options: {
      ...commonOpts,
      plugins: { ...commonOpts.plugins, legend: { display: true, position: 'top', labels: { font: { size: 8 }, boxWidth: 8, padding: 4 } }, datalabels: datalabelsOpt },
      scales: {
        x: { stacked: true, ticks: { font: { size: 9 }, maxRotation: 45, maxTicksLimit: 10 } },
        y: { stacked: true, beginAtZero: true, ticks: { font: { size: 9 } } }
      }
    }
  });

  // 4. Filial R$ (horizontal - valores nas barras)
  new Chart(document.getElementById('chartFilialR$'), {
    type: 'bar',
    data: {
      labels: ${filialLabels},
      datasets: [{ label: 'Prod. Final (R$)', data: ${filialProd}, backgroundColor: '#228B22', borderRadius: 3 }]
    },
    options: {
      ...commonOpts,
      plugins: { ...commonOpts.plugins, datalabels: datalabelsOpt },
      indexAxis: 'y',
      scales: {
        x: { beginAtZero: true, ticks: { font: { size: 9 }, callback: v => 'R$ ' + v.toLocaleString('pt-BR') } },
        y: { ticks: { font: { size: 9 } } }
      }
    }
  });

  // 5. Totais por Filial (valores nas barras)
  new Chart(document.getElementById('chartFilialTotais'), {
    type: 'bar',
    data: {
      labels: ${filialLabels},
      datasets: [
        { label: 'Peso', data: ${filialPeso}, backgroundColor: '#166534', borderRadius: 2 },
        { label: 'Volume', data: ${filialVolume}, backgroundColor: '#2563eb', borderRadius: 2 },
        { label: 'Paletes', data: ${filialPaletes}, backgroundColor: '#7c3aed', borderRadius: 2 }
      ]
    },
    options: {
      ...commonOpts,
      plugins: { ...commonOpts.plugins, legend: { display: true, position: 'top', labels: { font: { size: 8 }, boxWidth: 8, padding: 4 } }, datalabels: datalabelsOpt },
      scales: {
        x: { ticks: { font: { size: 9 } } },
        y: { beginAtZero: true, ticks: { font: { size: 9 } } }
      }
    }
  });

  // 8. Descontos em % dos Colaboradores (igual ao Dashboard: Pie/Doughnut)
  const chartDescontosPercEl = document.getElementById('chartDescontosPerc');
  const descontosPercDataLength = ${descontosPercTop.length};
  if (chartDescontosPercEl) {
  if (descontosPercDataLength > 0) {
    new Chart(chartDescontosPercEl, {
      type: 'doughnut',
      data: {
        labels: ${descontosPercLabels},
        datasets: [{
          data: ${descontosPercValues},
          backgroundColor: ${descontosPercCores}
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { font: { size: 9 }, boxWidth: 8, padding: 4 } },
          datalabels: {
            color: '#fff',
            font: { size: 9, weight: 'bold' },
            formatter: function(v) { return v != null ? Number(v).toFixed(1) + '%' : ''; }
          },
          tooltip: {
            ...commonOpts.plugins.tooltip,
            callbacks: { label: function(ctx) { return (ctx.label || '') + ': ' + (ctx.raw != null ? Number(ctx.raw).toFixed(1) : '') + '%'; } }
          }
        }
      }
    });
  } else {
    chartDescontosPercEl.parentElement.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#64748b;font-size:12px;">Nenhum desconto no período</div>';
  }
  }

  // 7. Descontos Colaborador (valores dentro das barras - cor clara para contraste no vermelho)
  const chartDescontosEl = document.getElementById('chartDescontos');
  const descontosColabLength = ${descontosColab.length};
  if (descontosColabLength > 0) {
  new Chart(chartDescontosEl, {
    type: 'bar',
    data: {
      labels: ${descontosLabels},
      datasets: [{ label: 'Descontos (R$)', data: ${descontosValues}, backgroundColor: '#dc2626', borderRadius: 3 }]
    },
    options: {
      ...commonOpts,
      plugins: { ...commonOpts.plugins, datalabels: { ...datalabelsOpt, color: '#fff' } },
      scales: {
        x: { ticks: { font: { size: 9 }, maxRotation: 45, maxTicksLimit: 10 } },
        y: { beginAtZero: true, ticks: { font: { size: 9 }, callback: v => 'R$ ' + v.toLocaleString('pt-BR') } }
      }
    }
  });
  } else {
    chartDescontosEl.parentElement.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#64748b;font-size:12px;">Nenhum desconto no período</div>';
  }
<\/script>
</body>
</html>`
}
