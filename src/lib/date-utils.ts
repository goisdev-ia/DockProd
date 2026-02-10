/**
 * Formata string ISO date (YYYY-MM-DD) para exibição em pt-BR (DD/MM/YYYY)
 * sem usar new Date() para evitar deslocamento de timezone (ex: 2026-02-07 virando 06/02/2026).
 */
export function formatDateBR(isoDate: string): string {
  if (!isoDate || typeof isoDate !== 'string') return ''
  const trimmed = isoDate.trim().slice(0, 10)
  const parts = trimmed.split('-')
  if (parts.length !== 3) return trimmed
  const [y, m, d] = parts
  if (!y || !m || !d) return trimmed
  return `${d}/${m}/${y}`
}
