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

// Calcular percentual de erros
export function calcularPercentualErros(
  erroSeparacao: number,
  erroEntregas: number
): number {
  // 1% de desconto para cada erro
  const percentualErros = (erroSeparacao * 0.01) + (erroEntregas * 0.01)
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
export function obterCorProdutividade(valor: number, max: number = 300): string {
  const percentual = Math.min(valor / max, 1)
  
  if (percentual === 0) return 'rgb(220, 38, 38)' // red-600
  if (percentual >= 1) return 'rgb(22, 163, 74)' // green-600
  
  // Gradient de vermelho (220, 38, 38) para verde (22, 163, 74)
  const r = Math.round(220 - (220 - 22) * percentual)
  const g = Math.round(38 + (163 - 38) * percentual)
  const b = Math.round(38 + (74 - 38) * percentual)
  
  return `rgb(${r}, ${g}, ${b})`
}
