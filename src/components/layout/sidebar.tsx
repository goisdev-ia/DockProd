'use client'

import { useState, useEffect, createContext, useContext } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  LayoutDashboard,
  Upload,
  BarChart3,
  Percent,
  Trophy,
  FileText,
  Users,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  Sun,
  Moon,
  User,
  ScrollText,
  Target,
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import type { TipoUsuario } from '@/types/database'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  permitido: TipoUsuario[]
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permitido: ['colaborador', 'admin', 'gestor'] },
  { href: '/upload', label: 'Upload', icon: Upload, permitido: ['colaborador', 'admin'] },
  { href: '/produtividade', label: 'Produtividade', icon: BarChart3, permitido: ['colaborador', 'admin'] },
  { href: '/descontos', label: 'Descontos', icon: Percent, permitido: ['colaborador', 'admin'] },
  { href: '/resultado', label: 'Resultado', icon: Trophy, permitido: ['colaborador', 'admin'] },
  { href: '/relatorios', label: 'Relatórios', icon: FileText, permitido: ['colaborador', 'admin', 'gestor'] },
  { href: '/metas-e-regras', label: 'Metas e Regras', icon: Target, permitido: ['colaborador', 'admin'] },
  { href: '/cadastros', label: 'Cadastros', icon: Users, permitido: ['colaborador', 'admin'] },
  { href: '/perfil', label: 'Perfil', icon: User, permitido: ['colaborador', 'admin', 'gestor'] },
  { href: '/configuracoes', label: 'Configurações', icon: Settings, permitido: ['admin'] },
  { href: '/logs', label: 'Logs e Histórico', icon: ScrollText, permitido: ['admin', 'colaborador'] },
]

// Context para compartilhar estado da sidebar com o layout
interface SidebarContextType {
  isExpanded: boolean
}

const SidebarContext = createContext<SidebarContextType>({ isExpanded: true })

export function useSidebar() {
  return useContext(SidebarContext)
}

function NavLink({
  item,
  isActive,
  isExpanded,
}: {
  item: NavItem
  isActive: boolean
  isExpanded: boolean
}) {
  const Icon = item.icon

  const linkContent = (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
        isActive
          ? 'bg-green-600 text-white shadow-sm'
          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
        !isExpanded && 'justify-center px-2'
      )}
    >
      <Icon className={cn('shrink-0', isExpanded ? 'h-5 w-5' : 'h-5 w-5')} />
      {isExpanded && <span className="truncate">{item.label}</span>}
    </Link>
  )

  if (!isExpanded) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          {item.label}
        </TooltipContent>
      </Tooltip>
    )
  }

  return linkContent
}

function SidebarContent({
  isExpanded,
  setIsExpanded,
  nomeUsuario,
  tipoUsuario,
  iniciaisUsuario,
  avatarUrl,
  navItemsFiltrados,
  pathname,
  onLogout,
  tema,
  toggleTema,
}: {
  isExpanded: boolean
  setIsExpanded?: (v: boolean) => void
  nomeUsuario: string
  tipoUsuario: TipoUsuario
  iniciaisUsuario: string
  avatarUrl: string | null
  navItemsFiltrados: NavItem[]
  pathname: string
  onLogout: () => void
  tema: string
  toggleTema: () => void
}) {
  return (
    <div className="flex h-full flex-col bg-sidebar border-r border-sidebar-border">
      {/* Header com Logo */}
      <div className={cn(
        'flex items-center gap-3 px-4 py-5',
        !isExpanded && 'justify-center px-2'
      )}>
        <Link href="/dashboard" className="flex items-center gap-3 min-w-0">
          <Image
            src="/logodockprod.png"
            alt="DockProd Logo"
            width={38}
            height={38}
            className="shrink-0 rounded-full object-contain"
          />
          {isExpanded && (
            <div className="min-w-0">
              <div className="font-bold text-base leading-tight text-sidebar-foreground">DockProd</div>
              <div className="text-[11px] text-sidebar-foreground/50 truncate">Da doca ao resultado</div>
            </div>
          )}
        </Link>
        {isExpanded && setIsExpanded && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsExpanded(false)}
            className="ml-auto shrink-0 text-sidebar-foreground/50 hover:text-sidebar-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Navegação */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItemsFiltrados.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            isActive={pathname === item.href}
            isExpanded={isExpanded}
          />
        ))}
      </nav>

      <Separator className="bg-sidebar-border" />

      {/* Footer com perfil, tema e logout */}
      <div className={cn('px-3 py-4 space-y-2', !isExpanded && 'px-2')}>
        {/* Botão de tema */}
        {isExpanded ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTema}
            className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-sidebar-foreground"
          >
            {tema === 'dark' ? <Sun className="h-5 w-5 shrink-0" /> : <Moon className="h-5 w-5 shrink-0" />}
            <span>{tema === 'dark' ? 'Tema Claro' : 'Tema Escuro'}</span>
          </Button>
        ) : (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={toggleTema}
                className="w-full text-sidebar-foreground/70 hover:text-sidebar-foreground"
              >
                {tema === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {tema === 'dark' ? 'Tema Claro' : 'Tema Escuro'}
            </TooltipContent>
          </Tooltip>
        )}

        <Separator className="bg-sidebar-border" />

        {/* Perfil */}
        <div className={cn(
          'flex items-center gap-3 rounded-lg p-2',
          !isExpanded && 'justify-center'
        )}>
          <Avatar className="h-9 w-9 shrink-0">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={nomeUsuario} />}
            <AvatarFallback className="bg-green-600 text-white text-xs font-bold">
              {iniciaisUsuario}
            </AvatarFallback>
          </Avatar>
          {isExpanded && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-tight text-sidebar-foreground truncate">{nomeUsuario}</p>
              <p className="text-xs text-sidebar-foreground/50 capitalize">{tipoUsuario}</p>
            </div>
          )}
        </div>

        {/* Logout */}
        {isExpanded ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="w-full justify-start gap-3 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span>Sair</span>
          </Button>
        ) : (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onLogout}
                className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Sair</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  )
}

export function Sidebar({ children }: { children: React.ReactNode }) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [nomeUsuario, setNomeUsuario] = useState('')
  const [tipoUsuario, setTipoUsuario] = useState<TipoUsuario>('novo')
  const [iniciaisUsuario, setIniciaisUsuario] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [tema, setTema] = useState('light')
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  useEffect(() => {
    const carregarUsuario = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: usuario } = await supabase
          .from('usuarios')
          .select('nome, tipo, avatar_url')
          .eq('id', user.id)
          .single()

        if (usuario) {
          setNomeUsuario(usuario.nome)
          setTipoUsuario(usuario.tipo as TipoUsuario)
          setAvatarUrl(usuario.avatar_url || null)
          const palavras = usuario.nome.split(' ')
          const iniciais = palavras.length > 1
            ? `${palavras[0][0]}${palavras[palavras.length - 1][0]}`
            : usuario.nome.substring(0, 2)
          setIniciaisUsuario(iniciais.toUpperCase())

          // Registrar login uma vez por sessão
          const loginRegistrado = sessionStorage.getItem(`login_registrado_${user.id}`)
          if (!loginRegistrado) {
            await supabase.rpc('registrar_login', { p_user_id: user.id })
            sessionStorage.setItem(`login_registrado_${user.id}`, 'true')
          }
        }
      }
    }

    carregarUsuario()
  }, [supabase])

  // Inicializar tema (defer setState para evitar cascading renders)
  useEffect(() => {
    const temaArmazenado = localStorage.getItem('dockprod-tema') ?? 'light'
    document.documentElement.classList.toggle('dark', temaArmazenado === 'dark')
    const id = setTimeout(() => setTema(temaArmazenado), 0)
    return () => clearTimeout(id)
  }, [])

  const toggleTema = () => {
    const novoTema = tema === 'dark' ? 'light' : 'dark'
    setTema(novoTema)
    localStorage.setItem('dockprod-tema', novoTema)
    document.documentElement.classList.toggle('dark', novoTema === 'dark')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const navItemsFiltrados = navItems.filter(item =>
    item.permitido.includes(tipoUsuario)
  )

  // Fechar sheet mobile quando navegar
  useEffect(() => {
    const id = setTimeout(() => setMobileOpen(false), 0)
    return () => clearTimeout(id)
  }, [pathname])

  const sidebarProps = {
    nomeUsuario,
    tipoUsuario,
    iniciaisUsuario,
    avatarUrl,
    navItemsFiltrados,
    pathname,
    onLogout: handleLogout,
    tema,
    toggleTema,
  }

  return (
    <TooltipProvider>
      <SidebarContext.Provider value={{ isExpanded }}>
        <div className="flex h-screen overflow-hidden bg-background">
          {/* Sidebar Desktop */}
          <aside
            className={cn(
              'hidden md:flex flex-col shrink-0 transition-all duration-300 ease-in-out h-full',
              isExpanded ? 'w-64' : 'w-[68px]'
            )}
          >
            <SidebarContent
              isExpanded={isExpanded}
              setIsExpanded={setIsExpanded}
              {...sidebarProps}
            />
          </aside>

          {/* Botão de expandir (quando recolhida) */}
          {!isExpanded && (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setIsExpanded(true)}
                  className="hidden md:flex fixed top-5 left-[56px] z-40 rounded-full bg-sidebar border border-sidebar-border shadow-sm text-sidebar-foreground/60 hover:text-sidebar-foreground"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Expandir menu</TooltipContent>
            </Tooltip>
          )}

          {/* Conteúdo Principal */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Header Mobile */}
            <header className="flex md:hidden items-center justify-between h-14 px-4 border-b bg-sidebar shrink-0">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon-sm">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-0">
                  <SheetHeader className="sr-only">
                    <SheetTitle>Menu de navegação</SheetTitle>
                  </SheetHeader>
                  <SidebarContent
                    isExpanded={true}
                    {...sidebarProps}
                  />
                </SheetContent>
              </Sheet>
              <Link href="/dashboard" className="flex items-center gap-2">
                <Image
                  src="/logodockprod.png"
                  alt="DockProd Logo"
                  width={32}
                  height={32}
                  className="rounded-full object-contain"
                />
                <span className="font-bold text-sidebar-foreground">DockProd</span>
              </Link>
              <Avatar className="h-8 w-8">
                {avatarUrl && <AvatarImage src={avatarUrl} alt={nomeUsuario} />}
                <AvatarFallback className="bg-green-600 text-white text-xs font-bold">
                  {iniciaisUsuario}
                </AvatarFallback>
              </Avatar>
            </header>

            {/* Conteúdo da Página */}
            <main className="flex-1 overflow-y-auto p-4 md:p-6">
              {children}
            </main>
          </div>
        </div>
      </SidebarContext.Provider>
    </TooltipProvider>
  )
}
