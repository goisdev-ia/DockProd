import {
  startOfDay,
  endOfDay,
  subDays,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  format,
  addMonths,
} from 'date-fns'

export type PeriodoOption =
  | 'hoje'
  | 'ontem'
  | 'ultimos_7'
  | 'ultimos_15'
  | 'mes_atual'
  | 'mes_anterior'
  | 'trimestre_atual'
  | 'trimestre_anterior'
  | 'semestre_atual'
  | 'semestre_anterior'
  | 'ano_atual'
  | 'ano_anterior'

/**
 * Retorna data_inicio e data_fim (Date) para o período selecionado.
 * Usado para filtrar recebimentos por dta_receb (DockProd) ou data_carga (PickProd).
 */
export function getDatasPorPeriodo(periodo: PeriodoOption): {
  data_inicio: Date
  data_fim: Date
} {
  const hoje = new Date()
  switch (periodo) {
    case 'hoje':
      return { data_inicio: startOfDay(hoje), data_fim: endOfDay(hoje) }
    case 'ontem': {
      const ontem = subDays(hoje, 1)
      return { data_inicio: startOfDay(ontem), data_fim: endOfDay(ontem) }
    }
    case 'ultimos_7': {
      const d7 = subDays(hoje, 6)
      return { data_inicio: startOfDay(d7), data_fim: endOfDay(hoje) }
    }
    case 'ultimos_15': {
      const d15 = subDays(hoje, 14)
      return { data_inicio: startOfDay(d15), data_fim: endOfDay(hoje) }
    }
    case 'mes_atual':
      return {
        data_inicio: startOfMonth(hoje),
        data_fim: endOfMonth(hoje),
      }
    case 'mes_anterior': {
      const mesAnt = subMonths(hoje, 1)
      return {
        data_inicio: startOfMonth(mesAnt),
        data_fim: endOfMonth(mesAnt),
      }
    }
    case 'trimestre_atual':
      return {
        data_inicio: startOfQuarter(hoje),
        data_fim: endOfQuarter(hoje),
      }
    case 'trimestre_anterior': {
      const trimAnt = subMonths(hoje, 3)
      return {
        data_inicio: startOfQuarter(trimAnt),
        data_fim: endOfQuarter(trimAnt),
      }
    }
    case 'semestre_atual': {
      const sem = hoje.getMonth() < 6 ? 0 : 6
      const inicio = new Date(hoje.getFullYear(), sem, 1)
      return {
        data_inicio: inicio,
        data_fim: endOfMonth(addMonths(inicio, 5)),
      }
    }
    case 'semestre_anterior': {
      const primeiroSemestre = hoje.getMonth() < 6
      if (primeiroSemestre) {
        return {
          data_inicio: new Date(hoje.getFullYear() - 1, 6, 1),
          data_fim: new Date(hoje.getFullYear() - 1, 11, 31),
        }
      }
      return {
        data_inicio: new Date(hoje.getFullYear(), 0, 1),
        data_fim: new Date(hoje.getFullYear(), 5, 30),
      }
    }
    case 'ano_atual':
      return {
        data_inicio: startOfYear(hoje),
        data_fim: endOfYear(hoje),
      }
    case 'ano_anterior': {
      const anoAnt = new Date(hoje.getFullYear() - 1, 0, 1)
      return {
        data_inicio: startOfYear(anoAnt),
        data_fim: endOfYear(anoAnt),
      }
    }
    default:
      return {
        data_inicio: startOfMonth(hoje),
        data_fim: endOfMonth(hoje),
      }
  }
}

/** Formato YYYY-MM-DD para Supabase */
export function toISODate(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

const MESES_NOME_INDEX: Record<string, number> = {
  janeiro: 0,
  fevereiro: 1,
  março: 2,
  abril: 3,
  maio: 4,
  junho: 5,
  julho: 6,
  agosto: 7,
  setembro: 8,
  outubro: 9,
  novembro: 10,
  dezembro: 11,
}

const MESES_NUMERO_NOME: Record<number, string> = {
  0: 'janeiro',
  1: 'fevereiro',
  2: 'março',
  3: 'abril',
  4: 'maio',
  5: 'junho',
  6: 'julho',
  7: 'agosto',
  8: 'setembro',
  9: 'outubro',
  10: 'novembro',
  11: 'dezembro',
}

/**
 * Converte número do mês (0-11) para nome em português
 */
export function getMesNome(mesNumero: number): string {
  return MESES_NUMERO_NOME[mesNumero] || 'janeiro'
}

/**
 * Retorna primeiro e último dia do mês/ano para filtrar dados_produtividade por data_carga.
 * mesNome: nome do mês em português (ex.: "janeiro", "fevereiro").
 */
export function getDatasPorMesAno(
  mesNome: string,
  ano: number
): { dataInicio: Date; dataFim: Date } {
  const mesIndex = MESES_NOME_INDEX[mesNome.toLowerCase()] ?? 0
  const dataInicio = new Date(ano, mesIndex, 1)
  const dataFim = endOfMonth(dataInicio)
  return { dataInicio, dataFim }
}

/**
 * Retorna mes (string nome por extenso) e ano (number) para filtrar fechamento
 * conforme o período (usado quando período é baseado em mês/trimestre/ano).
 */
export function getMesAnoPorPeriodo(periodo: PeriodoOption): {
  mes: string
  ano: number
}[] {
  const hoje = new Date()
  const mesNome = getMesNome(hoje.getMonth())
  const ano = hoje.getFullYear()

  switch (periodo) {
    case 'mes_atual':
      return [{ mes: mesNome, ano }]
    case 'mes_anterior': {
      const ma = subMonths(hoje, 1)
      return [
        {
          mes: getMesNome(ma.getMonth()),
          ano: ma.getFullYear(),
        },
      ]
    }
    case 'trimestre_atual': {
      const q = Math.floor(hoje.getMonth() / 3) + 1
      const meses: { mes: string; ano: number }[] = []
      for (let i = (q - 1) * 3; i < q * 3; i++) {
        const d = new Date(hoje.getFullYear(), i, 1)
        meses.push({
          mes: getMesNome(d.getMonth()),
          ano: d.getFullYear(),
        })
      }
      return meses
    }
    case 'trimestre_anterior': {
      const qAnt = subMonths(hoje, 3)
      const q = Math.floor(qAnt.getMonth() / 3) + 1
      const meses: { mes: string; ano: number }[] = []
      for (let i = (q - 1) * 3; i < q * 3; i++) {
        const d = new Date(qAnt.getFullYear(), i, 1)
        meses.push({
          mes: getMesNome(d.getMonth()),
          ano: d.getFullYear(),
        })
      }
      return meses
    }
    case 'ano_atual':
      return Array.from({ length: 12 }, (_, i) => ({
        mes: getMesNome(i),
        ano: hoje.getFullYear(),
      }))
    case 'ano_anterior':
      return Array.from({ length: 12 }, (_, i) => ({
        mes: getMesNome(i),
        ano: hoje.getFullYear() - 1,
      }))
    case 'semestre_atual': {
      const sem = hoje.getMonth() < 6 ? 0 : 6
      return Array.from({ length: 6 }, (_, i) => ({
        mes: getMesNome(sem + i),
        ano: hoje.getFullYear(),
      }))
    }
    case 'semestre_anterior': {
      const primeiroSemestre = hoje.getMonth() < 6
      if (primeiroSemestre) {
        return Array.from({ length: 6 }, (_, i) => ({
          mes: getMesNome(6 + i),
          ano: hoje.getFullYear() - 1,
        }))
      }
      return Array.from({ length: 6 }, (_, i) => ({
        mes: getMesNome(i),
        ano: hoje.getFullYear(),
      }))
    }
    default:
      return [{ mes: mesNome, ano }]
  }
}
