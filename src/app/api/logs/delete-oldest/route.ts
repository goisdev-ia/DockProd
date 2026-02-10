import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
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

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado. Faça login novamente.' }, { status: 401 })
    }

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('tipo')
      .eq('id', user.id)
      .single()

    if (usuario?.tipo !== 'admin' && usuario?.tipo !== 'colaborador') {
      return NextResponse.json(
        { error: 'Apenas admin ou colaborador podem excluir logs.' },
        { status: 403 }
      )
    }

    const { data: deleted, error } = await supabase.rpc('delete_oldest_logs_acao', {
      p_limit: 1000,
    })

    if (error) {
      console.error('delete_oldest_logs_acao:', error)
      return NextResponse.json(
        { error: error.message || 'Erro ao excluir logs' },
        { status: 500 }
      )
    }

    const count = typeof deleted === 'number' ? deleted : 0
    return NextResponse.json({ deleted: count })
  } catch (e) {
    console.error('delete-oldest logs:', e)
    return NextResponse.json(
      { error: 'Erro interno ao excluir logs' },
      { status: 500 }
    )
  }
}
