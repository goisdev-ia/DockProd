import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { hash } from 'bcryptjs'

const ADMIN_EMAIL = 'goisdev.ia@gmail.com'
const ADMIN_SENHA = 'junio2019'
const ADMIN_NOME = 'obedys'

export async function POST() {
  try {
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

    const { data: existingAdmins } = await supabaseAdmin
      .from('usuarios')
      .select('id')
      .eq('tipo', 'admin')
      .limit(1)

    if (existingAdmins && existingAdmins.length > 0) {
      return NextResponse.json(
        { message: 'Admin já existe. Nenhuma ação necessária.' },
        { status: 200 }
      )
    }

    const { data: existingEmail } = await supabaseAdmin
      .from('usuarios')
      .select('id')
      .eq('email', ADMIN_EMAIL)
      .single()

    if (existingEmail) {
      await supabaseAdmin
        .from('usuarios')
        .update({ tipo: 'admin', senha: await hash(ADMIN_SENHA, 10) })
        .eq('email', ADMIN_EMAIL)
      return NextResponse.json({
        message: 'Usuário existente atualizado para admin.',
        email: ADMIN_EMAIL,
      })
    }

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_SENHA,
      email_confirm: true,
      user_metadata: { nome: ADMIN_NOME },
    })

    if (createError) {
      console.error('seed-admin createUser:', createError)
      return NextResponse.json(
        { error: createError.message || 'Falha ao criar usuário no Auth' },
        { status: 400 }
      )
    }

    if (!newUser.user) {
      return NextResponse.json({ error: 'Falha ao criar usuário' }, { status: 500 })
    }

    const senhaHash = await hash(ADMIN_SENHA, 10)

    const { error: insertError } = await supabaseAdmin.from('usuarios').insert({
      id: newUser.user.id,
      nome: ADMIN_NOME,
      email: ADMIN_EMAIL,
      senha: senhaHash,
      tipo: 'admin',
      ativo: true,
    })

    if (insertError) {
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id).catch(() => {})
      console.error('seed-admin insert usuarios:', insertError)
      return NextResponse.json(
        { error: insertError.message || 'Falha ao salvar perfil do usuário' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Admin criado com sucesso.',
      email: ADMIN_EMAIL,
      nome: ADMIN_NOME,
    })
  } catch (e) {
    const err = e as Error
    console.error('seed-admin:', err)
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
