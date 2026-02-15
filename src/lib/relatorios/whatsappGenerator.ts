export interface ResumoDescontoItem {
  tipo: string
  percentual: number
}

/** Uma linha de erro de separação: data + quantidade */
export interface ErroSeparacaoItem {
  data: string
  quantidade: number
}

/** Uma linha de erro de entregas: data + quantidade + observação (tabela Produtividade) */
export interface ErroEntregaItem {
  data: string
  quantidade: number
  observacao?: string | null
}

export interface DadosWhatsApp {
  colaborador: string
  /** Matrícula do colaborador (tabela colaboradores), não o id */
  matricula: string
  /** Função do colaborador (ex.: Aux. Exp/Receb) */
  funcao: string
  /** Filial no formato "0102 - Trielo CD S.F BA" (código + nome) */
  filial: string
  mes: string
  pesoTotal: number
  volumeTotal: number
  paletesTotal: number
  tempo: number
  kgHs: number
  volHs: number
  pltHs: number
  /** Acuracidade de estoque (%) */
  acuracidade: number | null
  /** Checklist (%) */
  checklist: number | null
  /** Perdas (%) */
  perda: number | null
  /** Valor R$ Acuracidade (bônus) */
  vlrAcuracidade: number
  /** Valor R$ Checklist (bônus) */
  vlrChecklist: number
  /** Valor R$ Plt/Hs (bônus) */
  vlrPltHs: number
  /** Valor R$ Perdas (bônus) */
  vlrPerda: number
  prodBruta: number
  percentualDescontos: number
  prodFinal: number
  meta: number
  /** Percentual de atingimento da meta (ex.: 60,00) */
  percentualAtingimento?: number
  /** Resumo dos descontos (tipos, % e observação) */
  resumoDescontos?: {
    itens: ResumoDescontoItem[]
    observacao?: string | null
  }
}

function formatNumber(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function gerarRelatorioWhatsApp(dados: DadosWhatsApp): string {
  const pct = dados.percentualAtingimento ?? 0
  let status: string
  if (pct >= 100) status = String.fromCodePoint(0x2705) + ' *META ATINGIDA!*'
  else if (pct > 0) status = String.fromCodePoint(0x26a0, 0xfe0f) + ' *META ATINGIDA PARCIALMENTE*'
  else status = String.fromCodePoint(0x274c) + ' *META NÃO ATINGIDA*'

  const emoji = {
    grafico: String.fromCodePoint(0x1f4ca),
    predio: String.fromCodePoint(0x1f3e2),
    calendario: String.fromCodePoint(0x1f4c5),
    pessoa: String.fromCodePoint(0x1f464),
    badge: String.fromCodePoint(0x1faaa),
    id: String.fromCodePoint(0x1f194),
    maleta: String.fromCodePoint(0x1f4bc),
    caixa: String.fromCodePoint(0x1f4e6),
    balanca: String.fromCodePoint(0x2696, 0xfe0f),
    regua: String.fromCodePoint(0x1f4cf),
    caminhao: String.fromCodePoint(0x1f69a),
    relogio: String.fromCodePoint(0x23f1, 0xfe0f),
    graficoCrescente: String.fromCodePoint(0x1f4c8),
    alvo: String.fromCodePoint(0x1f3af),
    dinheiro: String.fromCodePoint(0x1f4b0),
    notaDolar: String.fromCodePoint(0x1f4b5),
    trofeu: String.fromCodePoint(0x1f3c6),
    aviso: String.fromCodePoint(0x26a0, 0xfe0f),
    seta: String.fromCodePoint(0x1f4c9),
    lixeira: String.fromCodePoint(0x1f5d1, 0xfe0f),
    clipboard: String.fromCodePoint(0x1f4cb),
  }

  const linhasSeparadoras = String.fromCodePoint(0x2501).repeat(22)
  const acuStr = dados.acuracidade != null ? formatNumber(dados.acuracidade) + ' %' : '—'
  const chkStr = dados.checklist != null ? formatNumber(dados.checklist) + ' %' : '—'
  const perdaStr = dados.perda != null ? formatNumber(dados.perda) + ' %' : '—'

  return `
*${emoji.grafico} RESULTADO DA PRODUTIVIDADE*
${linhasSeparadoras}

*${emoji.predio} Filial:* ${dados.filial}
*${emoji.calendario} Mês:* ${dados.mes}

${linhasSeparadoras}
*${emoji.pessoa} COLABORADOR*
${linhasSeparadoras}

*${emoji.badge} Nome:* ${dados.colaborador}
*${emoji.id} Matrícula:* ${dados.matricula}
*${emoji.maleta} Função:* ${dados.funcao || '—'}

${linhasSeparadoras}
*${emoji.caixa} PRODUÇÃO*
${linhasSeparadoras}

*${emoji.balanca} Peso Total (kg):* ${formatNumber(dados.pesoTotal)}
*${emoji.regua} Volume Total:* ${formatNumber(dados.volumeTotal)}
*${emoji.caminhao} Paletes Total:* ${formatNumber(dados.paletesTotal)}
*${emoji.relogio} Tempo (h):* ${formatNumber(dados.tempo)}

${linhasSeparadoras}
*${emoji.graficoCrescente} PRODUTIVIDADE*
${linhasSeparadoras}

*${emoji.balanca} Kg/Hs:* ${formatNumber(dados.kgHs)}
*${emoji.regua} Vol/Hs:* ${formatNumber(dados.volHs)}
*${emoji.caminhao} Plt/Hs:* ${formatNumber(dados.pltHs)}

${linhasSeparadoras}
*${emoji.alvo} RESULTADOS*
${linhasSeparadoras}

*${emoji.caixa} Acuracidade de estoque:* ${acuStr}
*${emoji.clipboard} Checklist:* ${chkStr}
*${emoji.lixeira} Perdas:* ${perdaStr}

${linhasSeparadoras}
*${emoji.dinheiro} VALORES*
${linhasSeparadoras}

*${emoji.notaDolar} Vlr Acuracidade:* R$ ${formatNumber(dados.vlrAcuracidade)}
*${emoji.notaDolar} Vlr Checklist:* R$ ${formatNumber(dados.vlrChecklist)}
*${emoji.notaDolar} Vlr Plt/Hs:* R$ ${formatNumber(dados.vlrPltHs)}
*${emoji.notaDolar} Vlr Perdas:* R$ ${formatNumber(dados.vlrPerda)}

${linhasSeparadoras}
*${emoji.seta} RESUMO DESCONTOS*
${linhasSeparadoras}

${(dados.resumoDescontos?.itens?.length ?? 0) > 0
  ? dados.resumoDescontos!.itens.map((i) => `*${i.tipo}:* ${formatNumber(i.percentual)}%`).join('\n') +
    (dados.resumoDescontos?.observacao ? `\n\n*Observação:* ${dados.resumoDescontos.observacao}` : '')
  : 'Nenhum desconto aplicado.'}

${linhasSeparadoras}
*${emoji.alvo} RESULTADO FINAL*
${linhasSeparadoras}

*${emoji.grafico} Prod. Bruta:* ${formatNumber(dados.prodBruta)}
*${emoji.seta} % Descontos:* ${formatNumber(dados.percentualDescontos)}%

*${emoji.trofeu} Prod. Final:* *${formatNumber(dados.prodFinal)}*
*${emoji.alvo} Atingimento da meta:* ${formatNumber(dados.percentualAtingimento ?? 0)}%

*Status:* ${status}

${linhasSeparadoras}

_Relatório gerado automaticamente_
_Sistema DockProd ${String.fromCodePoint(0x00a9)} ${new Date().getFullYear()}_
  `.trim()
}

/**
 * Abre o WhatsApp com o texto pré-preenchido.
 * Usa encodeURIComponent para preservar emojis, acentos e quebras de linha.
 */
export function compartilharWhatsApp(texto: string, numero?: string): void {
  const textoLimpo = texto.trim()
  const textoCodificado = encodeURIComponent(textoLimpo)
  const base = numero ? `https://wa.me/${numero}` : 'https://wa.me/'
  const url = `${base}?text=${textoCodificado}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

/**
 * Copia o texto para a área de transferência (fallback 100% confiável para emojis).
 */
export async function copiarParaClipboard(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    try {
      const textArea = document.createElement('textarea')
      textArea.value = texto
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      textArea.style.top = '-999999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      const successful = document.execCommand('copy')
      document.body.removeChild(textArea)
      return successful
    } catch {
      return false
    }
  }
}
