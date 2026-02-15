/**
 * Busca todas as linhas de uma query Supabase paginando em chunks
 * (PostgREST retorna no máximo 1000 por request). Útil para recebimentos e tempo.
 */
const CHUNK_SIZE = 1000

type QueryWithRange = {
  range: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>
}

export async function fetchAllRows<T = unknown>(getQuery: () => QueryWithRange): Promise<T[]> {
  const all: T[] = []
  let from = 0
  while (true) {
    const query = getQuery().range(from, from + CHUNK_SIZE - 1)
    const { data, error } = await query
    if (error) throw new Error(error.message)
    const list = (data ?? []) as T[]
    all.push(...list)
    if (list.length < CHUNK_SIZE) break
    from += CHUNK_SIZE
  }
  return all
}
