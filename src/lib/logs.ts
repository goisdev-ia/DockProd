import type { SupabaseClient } from '@supabase/supabase-js'

export async function registrarLog(
  supabase: SupabaseClient,
  acao: string,
  id_carga_cliente?: string | null
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let nome_usuario: string | null = null
    let id_filial: string | null = null
    let filial_nome: string | null = null

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('nome, id_filial')
      .eq('id', user.id)
      .single()

    if (usuario) {
      nome_usuario = usuario.nome ?? null
      id_filial = usuario.id_filial ?? null
      if (id_filial) {
        const { data: filial } = await supabase
          .from('filiais')
          .select('nome')
          .eq('id', id_filial)
          .single()
        filial_nome = filial?.nome ?? null
      }
    }

    await supabase.from('logs_acao').insert({
      id_usuario: user.id,
      nome_usuario,
      id_filial,
      filial_nome,
      acao,
      id_carga_cliente: id_carga_cliente ?? null,
    })
  } catch {
    // Silently ignore log errors to not break the main flow
  }
}
