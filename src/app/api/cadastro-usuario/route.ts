import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * Insere o registro em public.usuarios após signUp no Auth.
 * Usa service_role para contornar RLS (cadastro público não tem sessão com auth.uid() até confirmação).
 */
export async function POST(request: Request) {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!serviceRoleKey || !supabaseUrl) {
      return NextResponse.json(
        { error: 'Variáveis de ambiente Supabase não configuradas' },
        { status: 503 }
      )
    }

    const body = await request.json()
    const { id, nome, email, senhaHash, tipo } = body as {
      id: string
      nome: string
      email: string
      senhaHash: string
      tipo: string
    }

    if (!id || !nome || !email || !senhaHash || tipo === undefined) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: id, nome, email, senhaHash, tipo' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(id)
    if (authError || !authUser?.user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado no Auth. Complete o cadastro no Supabase Auth primeiro.' },
        { status: 400 }
      )
    }

    if (authUser.user.email?.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json(
        { error: 'Email não confere com o usuário do Auth.' },
        { status: 400 }
      )
    }

    const { error: insertError } = await supabaseAdmin.from('usuarios').insert({
      id,
      nome,
      email: email.trim().toLowerCase(),
      senha: senhaHash,
      tipo: tipo || 'novo',
      ativo: true,
    })

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'Este email já está cadastrado.' },
          { status: 409 }
        )
      }
      console.error('cadastro-usuario insert:', insertError)
      return NextResponse.json(
        { error: insertError.message || 'Falha ao salvar perfil' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const err = e as Error
    console.error('cadastro-usuario:', err)
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
