import { createClient } from '@supabase/supabase-js'
import { hash } from 'bcryptjs'

/**
 * Cria o registro em public.usuarios para o usuário do Auth, se ainda não existir.
 * Usado pelo middleware quando o usuário existe no Auth mas não em usuarios (ex.: confirmou email e saiu antes do insert no cadastro).
 * Usa service_role para contornar RLS.
 * @returns true se o perfil foi criado ou já existia, false em caso de falha
 */
export async function backfillUsuario(userId: string): Promise<boolean> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!serviceRoleKey || !supabaseUrl) return false

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: existing } = await supabaseAdmin
    .from('usuarios')
    .select('id')
    .eq('id', userId)
    .single()

  if (existing) return true

  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId)
  if (authError || !authUser?.user) return false

  const email = authUser.user.email?.trim().toLowerCase() ?? ''
  const nome = (authUser.user.user_metadata?.nome as string)?.trim() || email.split('@')[0] || 'Usuário'
  const senhaPlaceholder = await hash(`backfill-${userId}`, 10)

  const { error: insertError } = await supabaseAdmin.from('usuarios').insert({
    id: userId,
    nome,
    email,
    senha: senhaPlaceholder,
    tipo: 'novo',
    ativo: true,
  })

  if (insertError) {
    if (insertError.code === '23505') return true // já existe (race)
    console.error('backfill-usuario insert:', insertError)
    return false
  }
  return true
}
