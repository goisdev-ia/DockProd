'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Upload, Loader2, User as UserIcon } from 'lucide-react'
import { toast } from 'sonner'
import { registrarLog } from '@/lib/logs'

export default function PerfilPage() {
    const [perfil, setPerfil] = useState<{ nome: string; email: string; tipo: string; avatar_url: string | null } | null>(null)
    const [uploadando, setUploadando] = useState(false)
    const [loading, setLoading] = useState(true)
    const [loginStats, setLoginStats] = useState<{ total_logins: number; ultimo_login: string | null } | null>(null)

    const supabase = createClient()

    useEffect(() => {
        carregarPerfil()
    }, [])

    const carregarPerfil = async () => {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data } = await supabase
                .from('usuarios')
                .select('nome, email, tipo, avatar_url')
                .eq('id', user.id)
                .single()

            if (data) {
                setPerfil(data)
            }

            const { data: stats } = await supabase.rpc('get_usuario_login_stats', { p_user_id: user.id })
            if (stats && typeof stats === 'object' && 'total_logins' in stats) {
                const total = Number((stats as { total_logins?: number }).total_logins ?? 0)
                const ultimo = (stats as { ultimo_login?: string }).ultimo_login ?? null
                setLoginStats({ total_logins: total, ultimo_login: ultimo })
            }
        } catch (error) {
            console.error('Erro ao carregar perfil:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        // Validar arquivo
        const maxSize = 2 * 1024 * 1024 // 2MB
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

        if (file.size > maxSize) {
            toast.error('Arquivo muito grande. Máximo 2MB.')
            return
        }

        if (!allowedTypes.includes(file.type)) {
            toast.error('Formato não suportado. Use JPG, JPEG, PNG ou WEBP.')
            return
        }

        setUploadando(true)

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                toast.error('Usuário não autenticado')
                return
            }

            // Deletar avatar antigo se existir
            const { data: existingFiles } = await supabase.storage
                .from('avatars')
                .list(user.id)

            if (existingFiles && existingFiles.length > 0) {
                const filesToDelete = existingFiles.map(f => `${user.id}/${f.name}`)
                await supabase.storage.from('avatars').remove(filesToDelete)
            }

            // Upload novo avatar
            const fileExt = file.name.split('.').pop()
            const filePath = `${user.id}/avatar.${fileExt}`

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file, { upsert: true })

            if (uploadError) throw uploadError

            // Obter URL pública
            const { data: urlData } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath)

            // Atualizar banco de dados
            const { error: updateError } = await supabase
                .from('usuarios')
                .update({ avatar_url: urlData.publicUrl })
                .eq('id', user.id)

            if (updateError) throw updateError

            toast.success('Foto de perfil atualizada!')
            await carregarPerfil()
            registrarLog(supabase, 'Atualizou foto de perfil')

            // Recarregar a página para atualizar o avatar na sidebar
            setTimeout(() => window.location.reload(), 1000)

        } catch (error) {
            console.error('Erro ao fazer upload:', error)
            toast.error('Erro ao atualizar foto de perfil')
        } finally {
            setUploadando(false)
        }
    }

    const getIniciais = (nome: string) => {
        const palavras = nome.split(' ')
        if (palavras.length > 1) {
            return `${palavras[0][0]}${palavras[palavras.length - 1][0]}`.toUpperCase()
        }
        return nome.substring(0, 2).toUpperCase()
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                    <UserIcon className="h-8 w-8" />
                    Meu Perfil
                </h1>
                <p className="text-muted-foreground">
                    Gerencie suas informações pessoais e foto de perfil
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Foto de Perfil</CardTitle>
                    <CardDescription>
                        Adicione uma foto para personalizar seu perfil
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center space-y-6">
                        {/* Avatar Grande */}
                        <Avatar className="h-40 w-40 border-4 border-border">
                            {perfil?.avatar_url && (
                                <AvatarImage src={perfil.avatar_url} alt={perfil.nome} />
                            )}
                            <AvatarFallback className="bg-green-600 text-white text-5xl font-bold">
                                {perfil ? getIniciais(perfil.nome) : 'US'}
                            </AvatarFallback>
                        </Avatar>

                        {/* Info do Usuário */}
                        <div className="text-center space-y-1">
                            <h3 className="text-2xl font-semibold">{perfil?.nome}</h3>
                            <p className="text-sm text-muted-foreground">{perfil?.email}</p>
                            <p className="text-xs text-muted-foreground capitalize bg-secondary px-3 py-1 rounded-full inline-block">
                                {perfil?.tipo}
                            </p>
                        </div>

                        {/* Último login e total de logins */}
                        <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground border-t pt-4 w-full max-w-xs">
                            <span>
                                <strong className="text-foreground">Último login:</strong>{' '}
                                {loginStats?.ultimo_login
                                    ? new Date(loginStats.ultimo_login).toLocaleString('pt-BR')
                                    : 'Nunca'}
                            </span>
                            <span>
                                <strong className="text-foreground">Total de logins:</strong>{' '}
                                {loginStats?.total_logins ?? 0}
                            </span>
                        </div>

                        {/* Upload Button */}
                        <div className="flex flex-col items-center gap-2">
                            <input
                                type="file"
                                id="avatar-upload"
                                accept="image/jpeg,image/jpg,image/png,image/webp"
                                className="hidden"
                                onChange={handleAvatarUpload}
                                disabled={uploadando}
                            />
                            <label htmlFor="avatar-upload">
                                <Button
                                    type="button"
                                    variant="default"
                                    size="lg"
                                    disabled={uploadando}
                                    onClick={() => document.getElementById('avatar-upload')?.click()}
                                >
                                    {uploadando ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Enviando...
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="w-4 h-4 mr-2" />
                                            {perfil?.avatar_url ? 'Trocar Foto' : 'Upload Foto'}
                                        </>
                                    )}
                                </Button>
                            </label>
                            <p className="text-xs text-muted-foreground text-center max-w-xs">
                                JPG, JPEG, PNG ou WEBP. Máximo 2MB.
                                <br />
                                A foto será exibida no menu lateral e em todo o sistema.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
