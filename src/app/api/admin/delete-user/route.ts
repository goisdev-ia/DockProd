import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function DELETE(request: NextRequest) {
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

        // Verify user is authenticated
        const { data: { user }, error: authError } = await supabaseAnon.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Não autorizado. Faça login novamente.' }, { status: 401 })
        }

        // Verify user is admin
        const { data: usuario } = await supabaseAnon
            .from('usuarios')
            .select('tipo')
            .eq('id', user.id)
            .single()

        if (usuario?.tipo !== 'admin') {
            return NextResponse.json({ error: 'Apenas admin pode excluir usuários' }, { status: 403 })
        }

        // Get user ID to delete from request body
        const body = await request.json()
        const { userId } = body as { userId: string }

        if (!userId) {
            return NextResponse.json({ error: 'ID do usuário é obrigatório' }, { status: 400 })
        }

        // Prevent self-deletion
        if (userId === user.id) {
            return NextResponse.json({ error: 'Você não pode excluir sua própria conta' }, { status: 400 })
        }

        // Check if service role key is configured
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!serviceRoleKey) {
            console.error('delete-user: SUPABASE_SERVICE_ROLE_KEY não configurado')
            return NextResponse.json(
                { error: 'Serviço não configurado. Configure SUPABASE_SERVICE_ROLE_KEY no ambiente (ex: .env.local).' },
                { status: 503 }
            )
        }

        // Create admin client
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            serviceRoleKey,
            { auth: { autoRefreshToken: false, persistSession: false } }
        )

        // Optional: Check if this is the last admin (prevent deleting last admin)
        const { data: adminCheck } = await supabaseAdmin
            .from('usuarios')
            .select('id, tipo')
            .eq('tipo', 'admin')
            .eq('ativo', true)

        const activeAdmins = adminCheck?.filter(u => u.id !== userId) || []

        if (activeAdmins.length === 0) {
            const { data: deletingUser } = await supabaseAdmin
                .from('usuarios')
                .select('tipo')
                .eq('id', userId)
                .single()

            if (deletingUser?.tipo === 'admin') {
                return NextResponse.json(
                    { error: 'Não é possível excluir o último administrador do sistema' },
                    { status: 400 }
                )
            }
        }

        // Delete from usuarios table first
        const { error: deleteDbError } = await supabaseAdmin
            .from('usuarios')
            .delete()
            .eq('id', userId)

        if (deleteDbError) {
            console.error('delete-user delete usuarios:', deleteDbError)
            return NextResponse.json(
                { error: deleteDbError.message || 'Falha ao excluir usuário da base de dados' },
                { status: 500 }
            )
        }

        // Delete from auth.users
        const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId)

        if (deleteAuthError) {
            console.error('delete-user delete auth:', deleteAuthError)
            // Note: If auth deletion fails but DB deletion succeeded, 
            // the user won't be able to login (no record in usuarios table)
            // but will still exist in auth.users
            return NextResponse.json(
                {
                    error: 'Usuário removido do sistema mas falha ao remover autenticação',
                    warning: true
                },
                { status: 207 } // Multi-status
            )
        }

        return NextResponse.json({
            success: true,
            message: 'Usuário excluído com sucesso'
        })

    } catch (e) {
        const err = e as Error
        console.error('delete-user:', err)
        const message = process.env.NODE_ENV === 'development' ? err.message : 'Erro interno'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
