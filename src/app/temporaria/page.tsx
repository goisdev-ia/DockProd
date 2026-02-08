'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LogOut } from 'lucide-react'
import Image from 'next/image'

export default function TemporariaPage() {
  const [nomeUsuario, setNomeUsuario] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const carregarUsuario = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: usuario } = await supabase
          .from('usuarios')
          .select('nome')
          .eq('id', user.id)
          .single()
        
        if (usuario) {
          setNomeUsuario(usuario.nome)
        }
      }
    }

    carregarUsuario()
  }, [supabase])

  const handleLogout = async () => {
    setLoading(true)
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-amber-100 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <Image
              src="/pickprodlogo.png"
              alt="PickProd Logo"
              width={100}
              height={100}
              className="object-contain rounded-full"
              priority
            />
          </div>
          <CardTitle className="text-2xl font-bold">Aguardando Aprovação</CardTitle>
          <CardDescription>
            {nomeUsuario && `Olá, ${nomeUsuario}!`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-4">
            <div className="p-6 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex justify-center mb-3">
                <Image
                  src="/pickprodlogo.png"
                  alt="PickProd Logo"
                  width={80}
                  height={80}
                  className="object-contain opacity-80"
                />
              </div>
              <p className="text-gray-700 mb-2">
                Sua conta foi criada com sucesso!
              </p>
              <p className="text-sm text-gray-600">
                Seu acesso está pendente de aprovação pelo administrador. 
                Você receberá uma notificação quando seu perfil for ativado.
              </p>
            </div>
            
            <div className="text-sm text-gray-500 space-y-2">
              <p>Enquanto isso:</p>
              <ul className="list-disc list-inside text-left max-w-md mx-auto space-y-1">
                <li>Entre em contato com seu supervisor</li>
                <li>Aguarde a liberação do acesso</li>
                <li>Em caso de dúvidas, contate o suporte</li>
              </ul>
            </div>
          </div>

          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full"
            disabled={loading}
          >
            <LogOut className="w-4 h-4 mr-2" />
            {loading ? 'Saindo...' : 'Sair'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
