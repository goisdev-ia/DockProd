'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { registrarLog } from '@/lib/logs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Eye, EyeOff } from 'lucide-react'
import Image from 'next/image'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    const erroUrl = searchParams.get('erro')
    if (erroUrl) setErro(decodeURIComponent(erroUrl))
  }, [searchParams])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    setLoading(true)

    try {
      // 1. Login via Supabase Auth (compatível com RLS: depois carregamos usuario por auth.uid())
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: senha,
      })

      if (signInError) {
        const msg =
          signInError.message?.toLowerCase().includes('invalid login')
            ? 'Email ou senha incorretos.'
            : signInError.message?.toLowerCase().includes('email not confirmed')
              ? 'Confirme seu email antes de entrar.'
              : 'Email ou senha incorretos. Verifique se o usuário existe no Supabase Auth (Authentication > Users).'
        setErro(msg)
        setLoading(false)
        return
      }

      const userId = signInData.user?.id
      if (!userId) {
        setErro('Erro ao obter sessão. Tente novamente.')
        setLoading(false)
        return
      }

      // 2. Carregar perfil em usuarios (RLS permite SELECT onde id = auth.uid())
      let { data: usuario, error: userError } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', userId)
        .single()

      // Se não existe em usuarios mas existe no Auth (ex.: confirmou email e saiu antes do insert), criar registro
      if ((userError || !usuario) && userId) {
        const res = await fetch('/api/backfill-usuario', {
          method: 'POST',
          credentials: 'include',
        })
        if (res.ok) {
          const retry = await supabase
            .from('usuarios')
            .select('*')
            .eq('id', userId)
            .single()
          usuario = retry.data
          userError = retry.error
        }
      }

      if (userError || !usuario) {
        setErro('Perfil não encontrado. Entre em contato com o administrador.')
        await supabase.auth.signOut()
        setLoading(false)
        return
      }

      if (!usuario.ativo) {
        setErro('Usuário desativado. Entre em contato com o administrador.')
        await supabase.auth.signOut()
        setLoading(false)
        return
      }

      await registrarLog(supabase, 'LOGIN')

      // 3. Redirecionar baseado no tipo de usuário
      if (usuario.tipo === 'novo') {
        router.push('/temporaria')
      } else {
        router.push('/dashboard')
      }
      router.refresh()
    } catch (error) {
      console.error('Erro no login:', error)
      setErro('Erro inesperado ao fazer login. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden p-4">
      {/* Background: arquivo em public/backgroundockprod.png */}
      <div className="absolute inset-0 z-0 bg-[#1a3d1a]">
        <Image
          src="/backgroundockprod.png"
          alt="Background DockProd"
          fill
          className="object-cover"
          priority
          quality={100}
          sizes="100vw"
          unoptimized
        />
        <div className="absolute inset-0 bg-black/40" />
      </div>

      <Card className="relative z-10 w-full max-w-md bg-white/15 backdrop-blur-md border-white/15 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-600">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <Image
              src="/logodockprod.png"
              alt="DockProd Logo"
              width={280}
              height={280}
              className="object-contain rounded-full w-[140px] h-[140px]"
              priority
              quality={100}
              style={{ imageRendering: 'auto' }}
            />
          </div>
          <CardTitle className="text-2xl font-bold">DockProd</CardTitle>
          <CardDescription>Da doca ao resultado</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            {erro && (
              <div className="p-3 text-sm text-red-200 bg-red-50 border border-red-600 rounded-md">
                {erro}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senha">Senha</Label>
              <div className="relative">
                <Input
                  id="senha"
                  type={mostrarSenha ? 'text' : 'password'}
                  placeholder="••••••"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  minLength={6}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-800 hover:text-gray-700"
                >
                  {mostrarSenha ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-2">
            <Button
              type="submit"
              className="w-full bg-green-600 hover:bg-green-700"
              disabled={loading}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => router.push('/cadastro')}
              disabled={loading}
            >
              Criar Conta
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
