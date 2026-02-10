/**
 * Regra de negócio: registros "não informado" (colaborador vazio, Sem nome, etc.)
 * não devem entrar em resultados, relatórios nem gráficos por colaborador.
 * Não deletamos dados do banco — apenas excluímos da exibição/agrupamento.
 */

/**
 * Verifica se o valor representa "não informado" (colaborador não identificado).
 * Considera: vazio, null, undefined, "Sem nome", "Não informado" (qualquer case).
 */
export function isNaoInformado(value: unknown): boolean {
  if (value == null) return true
  const s = typeof value === 'string' ? value.trim().toLowerCase() : String(value).trim().toLowerCase()
  if (s === '') return true
  if (s === 'sem nome' || s === 'não informado' || s === 'nao informado') return true
  return false
}

/**
 * Filtra linhas excluindo as que têm colaborador_nome (ou campo equivalente) "não informado".
 * Mantém totais consistentes com o conjunto exibido.
 */
export function filterOutNaoInformado<T>(
  rows: T[],
  getColaboradorName: (row: T) => string | null | undefined
): T[] {
  return rows.filter((row) => !isNaoInformado(getColaboradorName(row)))
}
