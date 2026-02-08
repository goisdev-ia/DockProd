import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Rotas públicas
  const publicRoutes = ['/login', '/cadastro']
  const isPublicRoute = publicRoutes.some(route => request.nextUrl.pathname.startsWith(route))

  // Se não está autenticado e não está em rota pública, redirecionar para login
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Se está autenticado, verificar tipo de usuário
  if (user) {
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('tipo, ativo')
      .eq('id', user.id)
      .single()

    // Se usuário não está ativo, fazer logout
    if (!usuario?.ativo) {
      await supabase.auth.signOut()
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    // Usuário tipo 'novo' só pode acessar /temporaria
    if (usuario?.tipo === 'novo' && request.nextUrl.pathname !== '/temporaria') {
      const url = request.nextUrl.clone()
      url.pathname = '/temporaria'
      return NextResponse.redirect(url)
    }

    // Rotas administrativas - apenas para admin (cadastros liberado para admin e colaborador)
    const adminRoutes = ['/configuracoes', '/logs']
    const isAdminRoute = adminRoutes.some(route => request.nextUrl.pathname.startsWith(route))
    
    if (isAdminRoute && usuario?.tipo !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    // Gestor só pode acessar Dashboard, Resultado e Relatórios
    const gestorAllowedRoutes = ['/dashboard', '/resultado', '/relatorios']
    const isGestorAllowedRoute = gestorAllowedRoutes.some(route => request.nextUrl.pathname === route || request.nextUrl.pathname.startsWith(route + '/'))
    if (usuario?.tipo === 'gestor' && !isGestorAllowedRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    // Se está na página de login e já está autenticado, redirecionar
    // Mas permitir acesso a /cadastro mesmo autenticado (para admins cadastrarem novos usuários)
    if (request.nextUrl.pathname.startsWith('/login')) {
      const url = request.nextUrl.clone()
      url.pathname = usuario?.tipo === 'novo' ? '/temporaria' : '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
