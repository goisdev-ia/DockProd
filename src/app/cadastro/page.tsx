'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Eye, EyeOff, ArrowLeft } from 'lucide-react'
import Image from 'next/image'

export default function CadastroPage() {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    setLoading(true)

    try {
      // 1. Verificar se email já existe na tabela usuarios
      const { data: usuarioExistente } = await supabase
        .from('usuarios')
        .select('id')
        .eq('email', email)
        .single()

      if (usuarioExistente) {
        setErro('Este email já está cadastrado.')
        setLoading(false)
        return
      }

      // 2. Criar conta no Supabase Auth primeiro (para obter o UUID)
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password: senha,
        options: {
          data: {
            nome,
            tipo: 'novo',
          }
        }
      })

      if (signUpError) {
        console.error('Erro no Supabase Auth:', signUpError)
        setErro('Erro ao criar conta. Tente novamente.')
        setLoading(false)
        return
      }

      // 3. Inserir novo usuário na tabela usuarios usando o ID do Auth
      const userId = signUpData.user?.id
      const { error: insertError } = await supabase
        .from('usuarios')
        .insert({
          ...(userId ? { id: userId } : {}),
          nome,
          email,
          senha,
          tipo: 'novo',
          ativo: true
        })

      if (insertError) {
        console.error('Erro ao inserir na tabela usuarios:', insertError)
        setErro('Erro ao criar conta. Tente novamente.')
        setLoading(false)
        return
      }

      setSucesso(true)
      setTimeout(() => {
        router.push('/temporaria')
        router.refresh()
      }, 2000)
    } catch (error) {
      console.error('Erro no cadastro:', error)
      setErro('Erro ao criar conta. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden p-4">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/backgroundpickprod2.png"
          alt="Background"
          fill
          className="object-cover"
          priority
          quality={100}
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-black/40" />
      </div>

      <Card className="relative z-10 w-full max-w-md bg-white/35 backdrop-blur-md border-white/30 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-600">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <Image
              src="/pickprodlogo.png"
              alt="PickProd Logo"
              width={280}
              height={280}
              className="object-contain rounded-full w-[140px] h-[140px]"
              priority
              quality={100}
              style={{ imageRendering: 'auto' }}
            />
          </div>
          <CardTitle className="text-2xl font-bold">Criar Conta</CardTitle>
          <CardDescription>
            Registre-se no PickProd. Seu acesso será liberado após aprovação.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleCadastro}>
          <CardContent className="space-y-4">
            {erro && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                {erro}
              </div>
            )}
            {sucesso && (
              <div className="p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded-md">
                Conta criada com sucesso! Aguarde aprovação do administrador.
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="nome">Nome Completo</Label>
              <Input
                id="nome"
                type="text"
                placeholder="Seu nome completo"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                disabled={sucesso}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={sucesso}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senha">Senha</Label>
              <div className="relative">
                <Input
                  id="senha"
                  type={mostrarSenha ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  minLength={6}
                  className="pr-10"
                  disabled={sucesso}
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  disabled={sucesso}
                >
                  {mostrarSenha ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500">
                A senha deve ter no mínimo 6 caracteres (letras, números ou caracteres especiais)
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-2">
            <Button
              type="submit"
              className="w-full bg-green-600 hover:bg-green-700"
              disabled={loading || sucesso}
            >
              {loading ? 'Criando conta...' : 'Cadastrar'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => router.push('/login')}
              disabled={loading || sucesso}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar para Login
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
