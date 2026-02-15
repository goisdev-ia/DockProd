// Funções de cálculo de produtividade e bônus

export interface RegrasCalculo {
  regras_kg_hora: Array<{ kg_hora: number; valor: number }>
  regras_vol_hora: Array<{ vol_hora: number; valor: number }>
  regras_plt_hora: Array<{ plt_hora: number; valor: number }>
  percentuais_metricas: {
    kg_hora: number
    vol_hora: number
    plt_hora: number
  }
}

/**
 * Calcula o valor em R$ para uma métrica conforme faixas de pagamento (regrasprodutividade).
 * - kg/hs < 950 → vlr kg/hs = 0,00
 * - vol/hs < 190 → vlr vol/hs = 0,00
 * - plt/hs < 1,8 → vlr plt/hs = 0,00
 * - A partir da primeira faixa: retorna o valor R$ da maior faixa atingida.
 */
export function calcularValorMetrica(
  valorMetrica: number,
  regras: Array<{ [key: string]: number; valor: number }>,
  chaveMetrica: string
): number {
  if (!Array.isArray(regras) || regras.length === 0) return 0
  const valorNum = Number(valorMetrica)
  if (Number.isNaN(valorNum)) return 0

  const regrasOrdenadas = [...regras].sort(
    (a, b) => Number(a[chaveMetrica]) - Number(b[chaveMetrica])
  )
  const primeiroLimite = Number(regrasOrdenadas[0][chaveMetrica])
  if (valorNum < primeiroLimite) return 0

  for (let i = regrasOrdenadas.length - 1; i >= 0; i--) {
    const limite = Number(regrasOrdenadas[i][chaveMetrica])
    if (valorNum >= limite) {
      return Number(regrasOrdenadas[i].valor)
    }
  }
  return 0
}

function toPct01(v: number): number {
  const n = Number(v)
  if (Number.isNaN(n)) return 0
  return n > 1 ? n / 100 : n
}

function round2(x: number): number {
  return Math.round(x * 100) / 100
}

// Calcular produtividade bruta baseada nas três métricas (faixas + pesos)
export function calcularProdutividadeBruta(
  kgHs: number,
  volHs: number,
  pltHs: number,
  regras: RegrasCalculo
): {
  valor_kg_hs: number
  valor_vol_hs: number
  valor_plt_hs: number
  produtividade_bruta: number
} {
  const kg = Number(kgHs) || 0
  const vol = Number(volHs) || 0
  const plt = Number(pltHs) || 0
  const pct = regras.percentuais_metricas
  const pctKg = toPct01(pct.kg_hora)
  const pctVol = toPct01(pct.vol_hora)
  const pctPlt = toPct01(pct.plt_hora)

  const valorKg = calcularValorMetrica(kg, regras.regras_kg_hora, 'kg_hora')
  const valorVol = calcularValorMetrica(vol, regras.regras_vol_hora, 'vol_hora')
  const valorPlt = calcularValorMetrica(plt, regras.regras_plt_hora, 'plt_hora')

  const valor_kg_hs = round2(valorKg * pctKg)
  const valor_vol_hs = round2(valorVol * pctVol)
  const valor_plt_hs = round2(valorPlt * pctPlt)
  const produtividade_bruta = round2(valor_kg_hs + valor_vol_hs + valor_plt_hs)

  return {
    valor_kg_hs,
    valor_vol_hs,
    valor_plt_hs,
    produtividade_bruta,
  }
}

// Calcular percentual de erros (percentuais em decimal, ex.: 0.01 = 1%)
export function calcularPercentualErros(
  erroSeparacao: number,
  erroEntregas: number,
  erroSeparacaoPercent: number = 0.01,
  erroEntregasPercent: number = 0.01
): number {
  const percentualErros = (erroSeparacao * erroSeparacaoPercent) + (erroEntregas * erroEntregasPercent)
  return Math.min(percentualErros, 1) // Máximo 100%
}

// Calcular desconto por erros
export function calcularDescontoErros(
  produtividadeBruta: number,
  percentualErros: number
): number {
  return produtividadeBruta * percentualErros
}

// Calcular produtividade final
export function calcularProdutividadeFinal(
  produtividadeBruta: number,
  percentualErros: number,
  percentualDescontos: number
): {
  valor_desconto_erros: number
  valor_desconto_outros: number
  produtividade_final: number
} {
  // Desconto por erros
  const valor_desconto_erros = produtividadeBruta * percentualErros
  
  // Desconto por outros motivos (férias, faltas, etc)
  const valor_desconto_outros = produtividadeBruta * (percentualDescontos / 100)
  
  // Produtividade final
  const produtividade_final = Math.max(
    0,
    produtividadeBruta - valor_desconto_erros - valor_desconto_outros
  )
  
  return {
    valor_desconto_erros,
    valor_desconto_outros,
    produtividade_final
  }
}

// Calcular percentual de atingimento da meta
export function calcularPercentualAtingimento(
  produtividadeFinal: number,
  meta: number
): number {
  if (meta === 0) return 0
  return (produtividadeFinal / meta) * 100
}

// Obter cor para a célula de produtividade (gradient de vermelho a verde)
export function obterCorProdutividade(valor: number, max: number = 250): string {
  const percentual = Math.min(valor / max, 1)
  
  if (percentual === 0) return 'rgb(220, 38, 38)' // red-600
  if (percentual >= 1) return 'rgb(22, 163, 74)' // green-600
  
  // Gradient de vermelho (220, 38, 38) para verde (22, 163, 74)
  const r = Math.round(220 - (220 - 22) * percentual)
  const g = Math.round(38 + (163 - 38) * percentual)
  const b = Math.round(38 + (74 - 38) * percentual)
  
  return `rgb(${r}, ${g}, ${b})`
}

/** DockProd: contagem de paletes por qtd_caixas_recebidas. < 10 → 0,25; 10–14,99 → 0,5; ≥ 15 → 1 */
export function contarPaletes(qtdCaixasRecebidas: (number | null | undefined)[]): number {
  let total = 0
  for (const qtd of qtdCaixasRecebidas) {
    const n = Number(qtd ?? 0)
    if (Number.isNaN(n)) continue
    if (n < 10) total += 0.25
    else if (n < 15) total += 0.5
    else total += 1
  }
  return Math.round(total * 100) / 100
}

/** Metas PLT/HS por filial (código) para expedição/recebimento. Estoque não usa plt_hs. */
export const META_PLT_HS_POR_FILIAL: Record<string, number> = {
  '0102': 23,
  '0104': 20,
}

/** DockProd: valor R$ (100 ou 0) para PLT/HS da filial conforme meta. setor: 'expedição' | 'recebimento' | 'estoque' */
export function calcularValorPltHsPorFilial(
  pltHsFilial: number,
  codigoFilial: string,
  setor: string
): number {
  const setorNorm = (setor || '').toLowerCase()
  if (setorNorm === 'estoque') return 0
  const meta = META_PLT_HS_POR_FILIAL[codigoFilial] ?? 23
  return pltHsFilial >= meta ? 100 : 0
}

/** DockProd: valor R$ para acuracidade (meta >= 95% → 100) */
export function calcularValorAcuracidade(acuracidade: number): number {
  return acuracidade >= 95 ? 100 : 0
}

/** DockProd: valor R$ para checklist (meta >= 90% → 50) */
export function calcularValorChecklist(checklist: number): number {
  return checklist >= 90 ? 50 : 0
}

/** DockProd: valor R$ para perda (meta < 1,70% → 100) */
export function calcularValorPerda(perda: number): number {
  return perda < 1.7 ? 100 : 0
}

/** Converte intervalo Postgres (ex: "02:30:00", "2 hours" ou "0.92 hours") para horas decimais */
export function intervalToHours(intervalStr: string | null | undefined): number | null {
  if (intervalStr == null || String(intervalStr).trim() === '') return null
  const s = String(intervalStr).trim()
  const match = s.match(/^(\d+):(\d+):(\d+)/)
  if (match) {
    const [, h, m, sec] = match.map(Number)
    return h + m / 60 + sec / 3600
  }
  const hoursMatch = s.match(/([\d.]+)\s*hours?/)
  const minsMatch = s.match(/(\d+)\s*min/)
  const h = hoursMatch ? parseFloat(hoursMatch[1]) : 0
  const m = minsMatch ? parseInt(minsMatch[1], 10) : 0
  return h + m / 60
}

/** DockProd: bônus bruto (soma das métricas conforme setor). Meta total 250. */
export function calcularBonusBrutoDockProd(
  valorAcuracidade: number,
  valorChecklist: number,
  valorPltHs: number,
  valorPerda: number,
  setor: string
): number {
  const setorNorm = (setor || '').toLowerCase()
  if (setorNorm === 'estoque') {
    return Math.min(250, valorAcuracidade + valorChecklist + valorPerda)
  }
  return Math.min(250, valorAcuracidade + valorChecklist + valorPltHs)
}
