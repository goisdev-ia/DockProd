import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { hash } from 'bcryptjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

/**
 * Cria o registro em public.usuarios para o usuário atual do Auth, se ainda não existir.
 * Usado quando o usuário confirmou email no Auth mas o insert no cadastro não foi feito (ex.: saiu da página antes).
 * Aceita userId e access_token no body para contornar falhas de sessão via cookies.
 */
export async function POST(request: Request) {
  try {
    let user: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null = null

    const body = (await request.json().catch(() => ({}))) as { userId?: string; access_token?: string } | null
    const bodyUserId = body?.userId
    const access_token = body?.access_token

    if (bodyUserId && access_token) {
      const supabaseAnon = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data: { user: validatedUser }, error } = await supabaseAnon.auth.getUser(access_token)
      if (!error && validatedUser?.id === bodyUserId) {
        user = validatedUser
      }
    }

    if (!user) {
      const cookieStore = await cookies()
      const supabaseAnon = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll()
            },
            setAll() {
              // API: não persistir cookies
            },
          },
        }
      )
      const { data: { user: cookieUser }, error: authError } = await supabaseAnon.auth.getUser()
      if (authError || !cookieUser?.id) {
        return NextResponse.json(
          { error: 'Faça login primeiro.' },
          { status: 401 }
        )
      }
      user = cookieUser
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!serviceRoleKey || !supabaseUrl) {
      return NextResponse.json(
        { error: 'Variáveis de ambiente Supabase não configuradas' },
        { status: 503 }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: existing } = await supabaseAdmin
      .from('usuarios')
      .select('id')
      .eq('id', user.id)
      .single()

    if (existing) {
      return NextResponse.json({ ok: true, alreadyExists: true })
    }

    const email = user.email?.trim().toLowerCase() ?? ''
    const nome = (user.user_metadata?.nome as string)?.trim() || email.split('@')[0] || 'Usuário'
    const senhaPlaceholder = await hash(`backfill-${user.id}`, 10)

    const { error: insertError } = await supabaseAdmin.from('usuarios').insert({
      id: user.id,
      nome,
      email,
      senha: senhaPlaceholder,
      tipo: 'novo',
      ativo: true,
    })

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json({ ok: true })
      }
      console.error('backfill-usuario insert:', insertError)
      return NextResponse.json(
        { error: insertError.message || 'Falha ao criar perfil' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const err = e as Error
    console.error('backfill-usuario:', err)
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
