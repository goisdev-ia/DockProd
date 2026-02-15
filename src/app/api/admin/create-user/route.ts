import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { hash } from 'bcryptjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
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
            // API route: não persistir cookies
          },
        },
      }
    )
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado. Faça login novamente.' }, { status: 401 })
    }
    const { data: usuario } = await supabaseAnon
      .from('usuarios')
      .select('tipo')
      .eq('id', user.id)
      .single()
    if (usuario?.tipo !== 'admin') {
      return NextResponse.json({ error: 'Apenas admin pode cadastrar usuários' }, { status: 403 })
    }

    const body = await request.json()
    const { nome, email, senha, id_filial, tipo, ativo } = body as {
      nome: string
      email: string
      senha: string
      id_filial: string | null
      tipo: string
      ativo: boolean
    }
    if (!nome?.trim() || !email?.trim() || !senha?.trim()) {
      return NextResponse.json(
        { error: 'Nome, email e senha são obrigatórios' },
        { status: 400 }
      )
    }
    if (senha.length < 6) {
      return NextResponse.json(
        { error: 'Senha deve ter no mínimo 6 caracteres' },
        { status: 400 }
      )
    }
    const tipoValido = ['admin', 'colaborador', 'gestor', 'novo'].includes(tipo)
    if (!tipoValido) {
      return NextResponse.json(
        { error: 'Tipo de usuário inválido' },
        { status: 400 }
      )
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      console.error('create-user: SUPABASE_SERVICE_ROLE_KEY não configurado')
      return NextResponse.json(
        { error: 'Serviço não configurado. Configure SUPABASE_SERVICE_ROLE_KEY no ambiente (ex: .env.local).' },
        { status: 503 }
      )
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password: senha,
      email_confirm: true,
      user_metadata: { nome: nome.trim() },
    })
    if (createError) {
      const msg = createError.message.includes('already registered')
        ? 'Este email já está cadastrado.'
        : createError.message
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    if (!newUser.user) {
      return NextResponse.json({ error: 'Falha ao criar usuário' }, { status: 500 })
    }

    const senhaHash = await hash(senha, 10)
    const { error: insertError } = await supabaseAdmin.from('usuarios').insert({
      id: newUser.user.id,
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      senha: senhaHash,
      id_filial: id_filial && id_filial !== 'nenhuma' ? id_filial : null,
      tipo,
      ativo: ativo !== false,
    })
    if (insertError) {
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id).catch(() => {})
      console.error('create-user insert usuarios:', insertError)
      return NextResponse.json(
        { error: insertError.message || 'Falha ao salvar perfil do usuário' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      id: newUser.user.id,
      nome: nome.trim(),
      email: email.trim(),
      tipo,
      ativo: ativo !== false,
    })
  } catch (e) {
    const err = e as Error
    console.error('create-user:', err)
    const message = process.env.NODE_ENV === 'development' ? err.message : 'Erro interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
