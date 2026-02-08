'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
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
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    setLoading(true)

    try {
      // 1. Verificar credenciais na tabela 'usuarios' do banco
      const { data: usuario, error: userError } = await supabase
        .from('usuarios')
        .select('*')
        .eq('email', email)
        .eq('senha', senha)
        .single()

      if (userError || !usuario) {
        setErro('Email ou senha incorretos.')
        setLoading(false)
        return
      }

      if (!usuario.ativo) {
        setErro('Usuário desativado. Entre em contato com o administrador.')
        setLoading(false)
        return
      }

      // 2. Tentar fazer login no Supabase Auth
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      })

      if (signInError) {
        // 3. Se o usuário não existe no Auth, criar conta automaticamente
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password: senha,
          options: {
            data: {
              nome: usuario.nome,
              tipo: usuario.tipo,
            }
          }
        })

        if (signUpError) {
          console.error('Erro ao criar conta Auth:', signUpError)
          setErro('Erro ao autenticar. Tente novamente.')
          setLoading(false)
          return
        }

        // 4. Após signUp, tentar signIn novamente para obter sessão
        const { error: signIn2Error } = await supabase.auth.signInWithPassword({
          email,
          password: senha,
        })

        if (signIn2Error) {
          console.error('Erro no segundo signIn:', signIn2Error)
          // Pode ser que o Supabase exija confirmação de email.
          // Vamos tentar prosseguir mesmo assim se o signUp retornou sessão
          if (!signUpData?.session) {
            setErro('Conta criada. Verifique seu email ou tente fazer login novamente.')
            setLoading(false)
            return
          }
        }
      }

      // 5. Redirecionar baseado no tipo de usuário
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <Image
              src="/pickprodlogo.png"
              alt="PickProd Logo"
              width={140}
              height={140}
              className="object-contain rounded-full"
              priority
            />
          </div>
          <CardTitle className="text-2xl font-bold">PickProd</CardTitle>
          <CardDescription>Cada pedido conta</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            {erro && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
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
