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
  filial: string
  mes: string
  pesoTotal: number
  volumeTotal: number
  paletesTotal: number
  tempo: number
  kgHs: number
  volHs: number
  pltHs: number
  erros: number
  vlrKgHs: number
  vlrVolHs: number
  vlrPltHs: number
  prodBruta: number
  percentualErros: number
  percentualDescontos: number
  prodFinal: number
  meta: number
  /** Percentual de atingimento da meta (ex.: 95,5) */
  percentualAtingimento?: number
  /** Detalhe por data: erros separação e erros entregas + observação */
  detalheErros?: {
    errosSeparacao: ErroSeparacaoItem[]
    errosEntregas: ErroEntregaItem[]
  }
  /** Resumo dos descontos (tipos, % e observação) para a seção entre VALORES e RESULTADO FINAL */
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
  const atingiuMeta = dados.prodFinal >= dados.meta

  // Emojis criados usando String.fromCodePoint para melhor compatibilidade (evita na URL)
  const emoji = {
    grafico: String.fromCodePoint(0x1f4ca),           // 📊
    predio: String.fromCodePoint(0x1f3e2),            // 🏢
    calendario: String.fromCodePoint(0x1f4c5),        // 📅
    pessoa: String.fromCodePoint(0x1f464),             // 👤
    id: String.fromCodePoint(0x1f194),                // 🆔
    caixa: String.fromCodePoint(0x1f4e6),             // 📦
    balanca: String.fromCodePoint(0x2696, 0xfe0f),     // ⚖️
    regua: String.fromCodePoint(0x1f4cf),             // 📐
    caminhao: String.fromCodePoint(0x1f69a),          // 🚛
    relogio: String.fromCodePoint(0x23f1, 0xfe0f),    // ⏱️
    graficoCrescente: String.fromCodePoint(0x1f4c8), // 📈
    aviso: String.fromCodePoint(0x26a0, 0xfe0f),      // ⚠️
    circuloVermelho: String.fromCodePoint(0x1f534),  // 🔴
    dinheiro: String.fromCodePoint(0x1f4b0),           // 💰
    notaDolar: String.fromCodePoint(0x1f4b5),         // 💵
    alvo: String.fromCodePoint(0x1f3af),              // 🎯
    trofeu: String.fromCodePoint(0x1f3c6),            // 🏆
    checkVerde: String.fromCodePoint(0x2705),         // ✅
    xVermelho: String.fromCodePoint(0x274c),          // ❌
    seta: String.fromCodePoint(0x1f4c9),              // 📉
  }

  const linhasSeparadoras = String.fromCodePoint(0x2501).repeat(22) // ━━━━━

  return `
*${emoji.grafico} RESULTADO DA PRODUTIVIDADE*
${linhasSeparadoras}

*${emoji.predio} Filial:* ${dados.filial}
*${emoji.calendario} Mês:* ${dados.mes}

${linhasSeparadoras}
*${emoji.pessoa} COLABORADOR*
${linhasSeparadoras}

*Nome:* ${dados.colaborador}
*${emoji.id} Matrícula:* ${dados.matricula}

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
*${emoji.aviso} ERROS*
${linhasSeparadoras}

${dados.detalheErros
  ? (() => {
      const sep = dados.detalheErros!.errosSeparacao
      const ent = dados.detalheErros!.errosEntregas
      const linhas: string[] = []
      if (sep.length > 0) {
        linhas.push('*Erros Separação:*')
        sep.forEach((s) => linhas.push(`  ${s.data} - ${s.quantidade} erro(s)`))
      }
      if (ent.length > 0) {
        linhas.push('*Erros Entregas:*')
        ent.forEach((e) =>
          linhas.push(e.observacao ? `  ${e.data} - ${e.quantidade} erro(s) - Obs: ${e.observacao}` : `  ${e.data} - ${e.quantidade} erro(s)`)
        )
      }
      if (linhas.length === 0) linhas.push('Nenhum erro registrado.')
      return linhas.join('\n')
    })()
  : `*${emoji.circuloVermelho} Total de Erros:* ${dados.erros}`}

${linhasSeparadoras}
*${emoji.dinheiro} VALORES*
${linhasSeparadoras}

*${emoji.notaDolar} Vlr Kg/Hs:* R$ ${formatNumber(dados.vlrKgHs)}
*${emoji.notaDolar} Vlr Vol/Hs:* R$ ${formatNumber(dados.vlrVolHs)}
*${emoji.notaDolar} Vlr Plt/Hs:* R$ ${formatNumber(dados.vlrPltHs)}

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
*${emoji.aviso} % Erros:* ${formatNumber(dados.percentualErros)}%
*${emoji.seta} % Descontos:* ${formatNumber(dados.percentualDescontos)}%

*${emoji.trofeu} Prod. Final:* *${formatNumber(dados.prodFinal)}*
*${emoji.alvo} Atingimento da meta:* ${formatNumber(dados.percentualAtingimento ?? 0)}%

*Status:* ${atingiuMeta ? `${emoji.checkVerde} *META ATINGIDA!*` : `${emoji.aviso} *META NÃO ATINGIDA*`}

${linhasSeparadoras}

_Relatório gerado automaticamente_
_Sistema PickProd ${String.fromCodePoint(0x00a9)} ${new Date().getFullYear()}_
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
