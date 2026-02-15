'use client'

import { useEffect, useState, useCallback } from 'react'
import { hash } from 'bcryptjs'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Edit, Save, Settings as SettingsIcon, Users, Shield, Globe, Mail, Database, MessageSquare, FileText, Trash2, User, Upload as UploadIcon, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Usuario, TipoUsuario } from '@/types/database'
import type { RegrasCalculo } from '@/lib/calculos'
import { registrarLog } from '@/lib/logs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface UsuarioExtendido extends Usuario {
  filial_nome?: string
}

export default function ConfiguracoesPage() {
  const [usuarios, setUsuarios] = useState<UsuarioExtendido[]>([])
  const [filiais, setFiliais] = useState<{ id: string; nome: string;[key: string]: unknown }[]>([])
  const [loading, setLoading] = useState(true)

  // Dialog de edição de usuário
  const [dialogUsuarioAberto, setDialogUsuarioAberto] = useState(false)
  const [usuarioEditando, setUsuarioEditando] = useState<UsuarioExtendido | null>(null)
  const [nomeUsuario, setNomeUsuario] = useState('')
  const [emailUsuario, setEmailUsuario] = useState('')
  const [senhaUsuario, setSenhaUsuario] = useState('')
  const [tipoUsuario, setTipoUsuario] = useState<TipoUsuario>('novo')
  const [filialUsuario, setFilialUsuario] = useState('')
  const [ativoUsuario, setAtivoUsuario] = useState(true)

  // Regras de Cálculo e Meta
  const [metaValor, setMetaValor] = useState(300)
  const [dialogMetaAberto, setDialogMetaAberto] = useState(false)
  const [dialogRegrasAberto, setDialogRegrasAberto] = useState(false)
  const [regras, setRegras] = useState<RegrasCalculo | null>(null)
  const [salvandoRegras, setSalvandoRegras] = useState(false)
  const [salvandoMeta, setSalvandoMeta] = useState(false)
  const [confirmSalvarUsuarioOpen, setConfirmSalvarUsuarioOpen] = useState(false)
  const [confirmExcluirUsuarioOpen, setConfirmExcluirUsuarioOpen] = useState(false)
  const [idUsuarioExcluir, setIdUsuarioExcluir] = useState<string | null>(null)
  const [confirmSalvarMetaOpen, setConfirmSalvarMetaOpen] = useState(false)
  const [confirmSalvarRegrasOpen, setConfirmSalvarRegrasOpen] = useState(false)
  const [salvandoNovoUsuario, setSalvandoNovoUsuario] = useState(false)
  const [perfilUsuario, setPerfilUsuario] = useState<{ nome: string; email: string; avatar_url: string | null } | null>(null)
  const [uploadandoAvatar, setUploadandoAvatar] = useState(false)

  // Regras de descontos (%)
  const [dialogRegrasDescontosAberto, setDialogRegrasDescontosAberto] = useState(false)
  const [salvandoRegrasDescontos, setSalvandoRegrasDescontos] = useState(false)
  const [regrasDescontos, setRegrasDescontos] = useState({
    atestadoPercent: 100,
    faltaInjustificadaPercent: 100,
    advertenciaPercent: 50,
    feriasPercent: 100,
    suspensaoPercent: 100,
    erroSeparacaoPercent: 1,
    erroEntregasPercent: 1,
  })

  const supabase = createClient()

  useEffect(() => {
    carregarUsuarios()
    carregarFiliais()
    carregarPerfilUsuario()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const carregarUsuarios = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('usuarios')
        .select(`
          *,
          filiais (nome)
        `)
        .order('nome')

      if (data) {
        const usuariosFormatados = data.map(u => ({
          ...u,
          filial_nome: u.filiais?.nome
        }))
        setUsuarios(usuariosFormatados)
      }
    } catch (error) {
      console.error('Erro ao carregar usuários:', error)
    } finally {
      setLoading(false)
    }
  }

  const carregarFiliais = async () => {
    const { data } = await supabase
      .from('filiais')
      .select('*')
      .eq('ativo', true)
    if (data) setFiliais(data)
  }

  const carregarPerfilUsuario = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('usuarios')
        .select('nome, email, avatar_url')
        .eq('id', user.id)
        .single()

      if (data) {
        setPerfilUsuario(data)
      }
    } catch (error) {
      console.error('Erro ao carregar perfil:', error)
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

    setUploadandoAvatar(true)

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
      await carregarPerfilUsuario()
      registrarLog(supabase, 'Atualizou foto de perfil')

    } catch (error) {
      console.error('Erro ao fazer upload:', error)
      toast.error('Erro ao atualizar foto de perfil')
    } finally {
      setUploadandoAvatar(false)
    }
  }

  const carregarConfiguracoesRegras = useCallback(async () => {
    const { data } = await supabase.from('configuracoes').select('chave, valor').in('chave', [
      'regras_kg_hora',
      'regras_vol_hora',
      'regras_plt_hora',
      'percentuais_metricas',
      'meta_colaborador',
    ])
    if (!data) return
    const map = Object.fromEntries(data.map((r) => [r.chave, r.valor]))
    const meta = (map.meta_colaborador as { valor?: number })?.valor ?? 300
    setMetaValor(meta)
    setRegras({
      regras_kg_hora: (map.regras_kg_hora as RegrasCalculo['regras_kg_hora']) ?? [],
      regras_vol_hora: (map.regras_vol_hora as RegrasCalculo['regras_vol_hora']) ?? [],
      regras_plt_hora: (map.regras_plt_hora as RegrasCalculo['regras_plt_hora']) ?? [],
      percentuais_metricas: (map.percentuais_metricas as RegrasCalculo['percentuais_metricas']) ?? {
        kg_hora: 0.5,
        vol_hora: 0.3,
        plt_hora: 0.2,
      },
    })
  }, [supabase])

  useEffect(() => {
    carregarConfiguracoesRegras()
  }, [carregarConfiguracoesRegras])

  const salvarMeta = async () => {
    const valor = Number(metaValor)
    if (valor < 0 || valor > 10000) {
      toast.error('Meta deve estar entre 0 e 10000')
      return
    }
    setSalvandoMeta(true)
    try {
      const { data: existing } = await supabase.from('configuracoes').select('id').eq('chave', 'meta_colaborador').single()
      const payload = { valor: { valor }, updated_at: new Date().toISOString() }
      if (existing) {
        const { error } = await supabase.from('configuracoes').update(payload).eq('chave', 'meta_colaborador')
        if (error) throw error
      } else {
        const { error } = await supabase.from('configuracoes').insert({ chave: 'meta_colaborador', valor: { valor }, updated_at: new Date().toISOString() })
        if (error) throw error
      }
      registrarLog(supabase, 'Alterou meta de produtividade')
      toast.success('Meta atualizada')
      setDialogMetaAberto(false)
    } catch (e) {
      console.error(e)
      toast.error('Erro ao salvar meta')
    } finally {
      setSalvandoMeta(false)
    }
  }

  const carregarRegrasDescontos = useCallback(async () => {
    const { data } = await supabase.from('configuracoes').select('valor').eq('chave', 'regras_descontos').single()
    if (!data?.valor) return
    const v = data.valor as {
      atestado?: { percent?: number }[]
      falta_injustificada_percent?: number
      advertencia_percent?: number
      ferias_percent?: number
      suspensao_percent?: number
      erro_separacao_percent?: number
      erro_entregas_percent?: number
    }
    const toPct = (n: number | undefined) => (n != null ? Math.round(Number(n) * 100) : 100)
    const atestadoMax = Array.isArray(v.atestado) && v.atestado.length > 0
      ? Math.max(...v.atestado.map((t) => (t.percent != null ? Number(t.percent) * 100 : 100)))
      : 100
    setRegrasDescontos({
      atestadoPercent: atestadoMax,
      faltaInjustificadaPercent: toPct(v.falta_injustificada_percent),
      advertenciaPercent: toPct(v.advertencia_percent),
      feriasPercent: toPct(v.ferias_percent),
      suspensaoPercent: toPct(v.suspensao_percent),
      erroSeparacaoPercent: toPct(v.erro_separacao_percent) || 1,
      erroEntregasPercent: toPct(v.erro_entregas_percent) || 1,
    })
  }, [supabase])

  const abrirDialogRegrasDescontos = async () => {
    await carregarRegrasDescontos()
    setDialogRegrasDescontosAberto(true)
  }

  const salvarRegrasDescontos = async () => {
    const { atestadoPercent, faltaInjustificadaPercent, advertenciaPercent, feriasPercent, suspensaoPercent, erroSeparacaoPercent, erroEntregasPercent } = regrasDescontos
    if ([atestadoPercent, faltaInjustificadaPercent, advertenciaPercent, feriasPercent, suspensaoPercent, erroSeparacaoPercent, erroEntregasPercent].some((p) => p < 0 || p > 100)) {
      toast.error('Percentuais devem estar entre 0 e 100')
      return
    }
    setSalvandoRegrasDescontos(true)
    try {
      const { data: existing } = await supabase.from('configuracoes').select('valor').eq('chave', 'regras_descontos').single()
      const current = (existing?.valor as Record<string, unknown>) ?? {}
      const atestadoArray = Array.isArray(current.atestado) ? (current.atestado as { percent?: number; ate_dias?: number; acima_dias?: number }[]) : [
        { percent: 0.25, ate_dias: 2 }, { percent: 0.5, ate_dias: 5 }, { percent: 0.7, ate_dias: 7 }, { percent: 1, acima_dias: 7 },
      ]
      const updatedAtestado = atestadoArray.map((t, i) =>
        i === atestadoArray.length - 1 ? { ...t, percent: atestadoPercent / 100 } : t
      )
      const valor = {
        ...current,
        atestado: updatedAtestado,
        falta_injustificada_percent: faltaInjustificadaPercent / 100,
        advertencia_percent: advertenciaPercent / 100,
        ferias_percent: feriasPercent / 100,
        suspensao_percent: suspensaoPercent / 100,
        erro_separacao_percent: erroSeparacaoPercent / 100,
        erro_entregas_percent: erroEntregasPercent / 100,
      }
      const { error } = await supabase.from('configuracoes').update({ valor, updated_at: new Date().toISOString() }).eq('chave', 'regras_descontos')
      if (error) throw error
      registrarLog(supabase, 'Alterou regras de descontos (%)')
      toast.success('Regras de descontos salvas')
      setDialogRegrasDescontosAberto(false)
    } catch (e) {
      console.error(e)
      toast.error('Erro ao salvar regras de descontos')
    } finally {
      setSalvandoRegrasDescontos(false)
    }
  }

  const salvarRegras = async () => {
    if (!regras) return
    setSalvandoRegras(true)
    try {
      const rows = [
        { chave: 'regras_kg_hora', valor: regras.regras_kg_hora, updated_at: new Date().toISOString() },
        { chave: 'regras_vol_hora', valor: regras.regras_vol_hora, updated_at: new Date().toISOString() },
        { chave: 'regras_plt_hora', valor: regras.regras_plt_hora, updated_at: new Date().toISOString() },
        { chave: 'percentuais_metricas', valor: regras.percentuais_metricas, updated_at: new Date().toISOString() },
      ]
      for (const row of rows) {
        const { error } = await supabase.from('configuracoes').update({ valor: row.valor, updated_at: row.updated_at }).eq('chave', row.chave)
        if (error) throw error
      }
      registrarLog(supabase, 'Alterou regras de cálculo')
      setDialogRegrasAberto(false)
      toast.success('Regras salvas')
    } catch (e) {
      console.error(e)
      toast.error('Erro ao salvar regras')
    } finally {
      setSalvandoRegras(false)
    }
  }

  const abrirEdicaoUsuario = (usuario: UsuarioExtendido) => {
    setUsuarioEditando(usuario)
    setNomeUsuario(usuario.nome)
    setEmailUsuario(usuario.email)
    setSenhaUsuario('')
    setTipoUsuario(usuario.tipo)
    setFilialUsuario(usuario.id_filial || 'nenhuma')
    setAtivoUsuario(usuario.ativo)
    setDialogUsuarioAberto(true)
  }

  const abrirCadastroNovoUsuario = () => {
    setUsuarioEditando(null)
    setNomeUsuario('')
    setEmailUsuario('')
    setSenhaUsuario('')
    setTipoUsuario('colaborador')
    setFilialUsuario('nenhuma')
    setAtivoUsuario(true)
    setDialogUsuarioAberto(true)
  }

  const cadastrarNovoUsuario = async () => {
    const nome = nomeUsuario.trim()
    const email = emailUsuario.trim().toLowerCase()
    const senha = senhaUsuario.trim()
    if (!nome) {
      toast.error('Nome é obrigatório')
      return
    }
    if (!email) {
      toast.error('Email é obrigatório')
      return
    }
    if (!senha) {
      toast.error('Senha é obrigatória')
      return
    }
    if (senha.length < 6) {
      toast.error('Senha deve ter no mínimo 6 caracteres')
      return
    }
    setSalvandoNovoUsuario(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error('Sessão expirada. Faça login novamente.')
        return
      }
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          nome,
          email,
          senha,
          id_filial: filialUsuario === 'nenhuma' || !filialUsuario ? null : filialUsuario,
          tipo: tipoUsuario,
          ativo: ativoUsuario,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'Erro ao cadastrar usuário')
        return
      }
      registrarLog(supabase, 'Cadastrou novo usuário')
      toast.success('Usuário cadastrado com sucesso')
      setDialogUsuarioAberto(false)
      carregarUsuarios()
    } catch (e) {
      console.error(e)
      toast.error('Erro ao cadastrar usuário')
    } finally {
      setSalvandoNovoUsuario(false)
    }
  }

  const salvarUsuario = async () => {
    if (!usuarioEditando) return

    try {
      const filialParaSalvar = filialUsuario === 'nenhuma' || filialUsuario === '' ? null : filialUsuario
      const novaSenhaHash = senhaUsuario?.trim()
        ? await hash(senhaUsuario.trim(), 10)
        : null

      const payload: Record<string, unknown> = {
        nome: nomeUsuario,
        email: emailUsuario,
        tipo: tipoUsuario,
        id_filial: filialParaSalvar,
        ativo: ativoUsuario,
        updated_at: new Date().toISOString(),
      }
      if (novaSenhaHash) payload.senha = novaSenhaHash

      const { error } = await supabase
        .from('usuarios')
        .update(payload)
        .eq('id', usuarioEditando.id)

      if (error) throw error

      registrarLog(supabase, 'Alterou dados de usuário')
      toast.success('Usuário atualizado com sucesso!')
      setDialogUsuarioAberto(false)
      carregarUsuarios()
    } catch (error) {
      console.error('Erro ao salvar usuário:', error)
      toast.error('Erro ao salvar usuário')
    }
  }

  const abrirConfirmExcluirUsuario = (id: string) => {
    setIdUsuarioExcluir(id)
    setConfirmExcluirUsuarioOpen(true)
  }

  const executarExcluirUsuario = async () => {
    if (!idUsuarioExcluir) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error('Sessão expirada. Faça login novamente.')
        return
      }

      const res = await fetch('/api/admin/delete-user', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId: idUsuarioExcluir }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        toast.error(data.error || 'Erro ao excluir usuário')
        return
      }

      if (data.warning) {
        toast.warning(data.error || 'Usuário parcialmente removido')
      } else {
        toast.success('Usuário excluído com sucesso')
      }

      registrarLog(supabase, 'Excluiu usuário')
      carregarUsuarios()
      setIdUsuarioExcluir(null)
    } catch (error) {
      console.error('Erro ao deletar usuário:', error)
      toast.error('Erro ao excluir usuário')
    }
  }

  const obterCorTipo = (tipo: TipoUsuario) => {
    switch (tipo) {
      case 'admin':
        return 'destructive'
      case 'colaborador':
        return 'default'
      case 'gestor':
        return 'outline'
      case 'novo':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie usuários e configurações do sistema
        </p>
      </div>

      <Tabs defaultValue="perfil" className="space-y-4">
        <TabsList>
          <TabsTrigger value="perfil">
            <User className="w-4 h-4 mr-2" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="usuarios">
            <Users className="w-4 h-4 mr-2" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="regras">
            <SettingsIcon className="w-4 h-4 mr-2" />
            Regras de Cálculo
          </TabsTrigger>
          <TabsTrigger value="permissoes">
            <Shield className="w-4 h-4 mr-2" />
            Permissões
          </TabsTrigger>
          <TabsTrigger value="sistema">
            <SettingsIcon className="w-4 h-4 mr-2" />
            Sistema
          </TabsTrigger>
        </TabsList>

        {/* Tab de Perfil */}
        <TabsContent value="perfil">
          <Card>
            <CardHeader>
              <CardTitle>Meu Perfil</CardTitle>
              <CardDescription>
                Gerencie suas informações pessoais e foto de perfil
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar */}
              <div className="flex flex-col items-center space-y-4">
                <Avatar className="h-32 w-32">
                  {perfilUsuario?.avatar_url && (
                    <AvatarImage src={perfilUsuario.avatar_url} alt={perfilUsuario.nome} />
                  )}
                  <AvatarFallback className="bg-green-600 text-white text-4xl font-bold">
                    {perfilUsuario?.nome.substring(0, 2).toUpperCase() || 'US'}
                  </AvatarFallback>
                </Avatar>
                <div className="text-center">
                  <h3 className="font-semibold text-lg">{perfilUsuario?.nome}</h3>
                  <p className="text-sm text-muted-foreground">{perfilUsuario?.email}</p>
                </div>
                <div>
                  <input
                    type="file"
                    id="avatar-upload"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    className="hidden"
                    onChange={handleAvatarUpload}
                    disabled={uploadandoAvatar}
                  />
                  <label htmlFor="avatar-upload">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={uploadandoAvatar}
                      onClick={() => document.getElementById('avatar-upload')?.click()}
                    >
                      {uploadandoAvatar ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <UploadIcon className="w-4 h-4 mr-2" />
                          Upload Foto
                        </>
                      )}
                    </Button>
                  </label>
                  <p className="text-xs text-muted-foreground mt-2">
                    JPG, JPEG, PNG ou WEBP. Máximo 2MB.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usuarios">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Gerenciar Usuários</CardTitle>
                  <CardDescription>
                    {usuarios.length} usuário(s) cadastrado(s)
                  </CardDescription>
                </div>
                <Button onClick={abrirCadastroNovoUsuario} className="bg-green-600 hover:bg-green-700">
                  <Users className="w-4 h-4 mr-2" />
                  Cadastrar novo usuário
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Filial</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          Carregando...
                        </TableCell>
                      </TableRow>
                    ) : usuarios.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Nenhum usuário encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      usuarios.map((usuario) => (
                        <TableRow key={usuario.id}>
                          <TableCell className="font-medium">{usuario.nome}</TableCell>
                          <TableCell className="text-xs">{usuario.email}</TableCell>
                          <TableCell>
                            <Badge variant={obterCorTipo(usuario.tipo)} className="capitalize">
                              {usuario.tipo}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">{usuario.filial_nome || '-'}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={usuario.ativo ? 'default' : 'secondary'}>
                              {usuario.ativo ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => abrirEdicaoUsuario(usuario)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => abrirConfirmExcluirUsuario(usuario.id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="regras">
          <Card>
            <CardHeader>
              <CardTitle>Regras de Cálculo</CardTitle>
              <CardDescription>
                Configure as regras de bonificação e descontos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold mb-2">Regras de Produtividade</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Faixas KG/Hora, VOL/Hora e PLT/Hora e percentuais (50% / 30% / 20%).
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      carregarConfiguracoesRegras()
                      setDialogRegrasAberto(true)
                    }}
                  >
                    <SettingsIcon className="w-4 h-4 mr-2" />
                    Editar Regras
                  </Button>
                </div>
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold mb-2">Meta de Produtividade</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Meta atual: R$ {metaValor.toFixed(2)} por colaborador
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      carregarConfiguracoesRegras()
                      setDialogMetaAberto(true)
                    }}
                  >
                    <SettingsIcon className="w-4 h-4 mr-2" />
                    Editar Meta
                  </Button>
                </div>
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold mb-2">Regras de descontos (%)</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Percentuais para atestado, falta injustificada, advertência, férias, suspensão, erros separação e entregas
                  </p>
                  <Button variant="outline" onClick={abrirDialogRegrasDescontos}>
                    <SettingsIcon className="w-4 h-4 mr-2" />
                    Editar regras de descontos
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissoes">
          <Card>
            <CardHeader>
              <CardTitle>Permissões do Sistema</CardTitle>
              <CardDescription>
                Configurações de acesso por tipo de usuário
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold mb-2">Tipo: Admin</h3>
                  <p className="text-sm text-muted-foreground">
                    Acesso total ao sistema, incluindo configurações e gerenciamento de usuários.
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold mb-2">Tipo: Colaborador</h3>
                  <p className="text-sm text-muted-foreground">
                    Acesso a todas as funcionalidades operacionais, exceto configurações.
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold mb-2">Tipo: Novo</h3>
                  <p className="text-sm text-muted-foreground">
                    Acesso limitado apenas à tela temporária, aguardando aprovação.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sistema">
          <Card>
            <CardHeader>
              <CardTitle>Configurações do Sistema</CardTitle>
              <CardDescription>
                Nome do app, logo, integrações e auditoria
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 border rounded-lg flex items-center gap-3">
                <Globe className="h-5 w-5 text-muted-foreground" />
                <div>
                  <h3 className="font-semibold">Nome e logo do app</h3>
                  <p className="text-sm text-muted-foreground">DockProd - Da doca ao resultado. Logo configurável em versão futura.</p>
                </div>
              </div>
              <div className="p-4 border rounded-lg flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <h3 className="font-semibold">Notificações por e-mail</h3>
                  <p className="text-sm text-muted-foreground">Envio de relatórios e alertas por e-mail. Configuração em desenvolvimento.</p>
                </div>
              </div>
              <div className="p-4 border rounded-lg flex items-center gap-3">
                <Database className="h-5 w-5 text-muted-foreground" />
                <div>
                  <h3 className="font-semibold">Backup e Google Sheets</h3>
                  <p className="text-sm text-muted-foreground">Agendamento de backup e sincronização com Google Sheets. Em desenvolvimento.</p>
                </div>
              </div>
              <div className="p-4 border rounded-lg flex items-center gap-3">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
                <div>
                  <h3 className="font-semibold">WhatsApp Business API</h3>
                  <p className="text-sm text-muted-foreground">Integração para envio de relatórios via WhatsApp. Configure token e número em variáveis de ambiente.</p>
                </div>
              </div>
              <div className="p-4 border rounded-lg flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <h3 className="font-semibold">Logs de auditoria</h3>
                  <p className="text-sm text-muted-foreground">Registro de ações (criar, editar, excluir, login). Tabela auditoria em desenvolvimento.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs >

      {/* Dialog de Edição / Cadastro de Usuário */}
      < Dialog open={dialogUsuarioAberto} onOpenChange={setDialogUsuarioAberto} >
        {dialogUsuarioAberto && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{usuarioEditando ? 'Editar Usuário' : 'Cadastrar novo usuário'}</DialogTitle>
              <DialogDescription>
                {usuarioEditando ? 'Altere os dados e permissões do usuário' : 'Preencha os dados. O usuário ficará ativo e poderá acessar o sistema.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={nomeUsuario}
                  onChange={(e) => setNomeUsuario(e.target.value)}
                  placeholder="Nome completo"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={emailUsuario}
                  onChange={(e) => setEmailUsuario(e.target.value)}
                  placeholder="email@exemplo.com"
                  disabled={!!usuarioEditando}
                />
                {usuarioEditando && <p className="text-xs text-muted-foreground">Email não pode ser alterado aqui.</p>}
              </div>
              <div className="space-y-2">
                <Label>{usuarioEditando ? 'Senha (deixe vazio para não alterar)' : 'Senha (mín. 6 caracteres)'}</Label>
                <Input
                  type="password"
                  value={senhaUsuario}
                  onChange={(e) => setSenhaUsuario(e.target.value)}
                  placeholder="••••••"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Usuário</Label>
                <Select value={tipoUsuario} onValueChange={(v) => setTipoUsuario(v as TipoUsuario)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="novo">Novo</SelectItem>
                    <SelectItem value="colaborador">Colaborador (comum)</SelectItem>
                    <SelectItem value="gestor">Gestor</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Filial</Label>
                <Select value={filialUsuario || "nenhuma"} onValueChange={(v) => setFilialUsuario(v === "nenhuma" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhuma">Nenhuma</SelectItem>
                    {filiais.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="ativo"
                  checked={ativoUsuario}
                  onChange={(e) => setAtivoUsuario(e.target.checked)}
                  className="w-4 h-4"
                />
                <Label htmlFor="ativo">Usuário Ativo</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogUsuarioAberto(false)}>
                Cancelar
              </Button>
              {usuarioEditando ? (
                <Button onClick={() => setConfirmSalvarUsuarioOpen(true)} className="bg-green-600 hover:bg-green-700">
                  <Save className="w-4 h-4 mr-2" />
                  Salvar
                </Button>
              ) : (
                <Button onClick={cadastrarNovoUsuario} disabled={salvandoNovoUsuario} className="bg-green-600 hover:bg-green-700">
                  <Save className="w-4 h-4 mr-2" />
                  {salvandoNovoUsuario ? 'Cadastrando...' : 'Cadastrar'}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        )
        }
      </Dialog >

      {/* Dialog Editar Meta */}
      < Dialog open={dialogMetaAberto} onOpenChange={setDialogMetaAberto} >
        {dialogMetaAberto && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Meta de Produtividade</DialogTitle>
              <DialogDescription>
                Meta em R$ por colaborador (máximo bônus mensal)
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label>Meta (R$)</Label>
              <Input
                type="number"
                min={0}
                max={10000}
                step={50}
                value={metaValor}
                onChange={(e) => setMetaValor(Number(e.target.value) || 0)}
                className="mt-2"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogMetaAberto(false)}>Cancelar</Button>
              <Button onClick={() => setConfirmSalvarMetaOpen(true)} disabled={salvandoMeta} className="bg-green-600 hover:bg-green-700">
                {salvandoMeta ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog >

      {/* Dialog Editar Regras de Descontos (%) */}
      <Dialog open={dialogRegrasDescontosAberto} onOpenChange={setDialogRegrasDescontosAberto}>
        {dialogRegrasDescontosAberto && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Editar regras de descontos (%)</DialogTitle>
              <DialogDescription>
                Percentuais aplicados sobre a produtividade. Valores entre 0 e 100.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Atestado % (máx.)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={regrasDescontos.atestadoPercent}
                    onChange={(e) => setRegrasDescontos((r) => ({ ...r, atestadoPercent: Number(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Falta injustificada %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={regrasDescontos.faltaInjustificadaPercent}
                    onChange={(e) => setRegrasDescontos((r) => ({ ...r, faltaInjustificadaPercent: Number(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Advertência %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={regrasDescontos.advertenciaPercent}
                    onChange={(e) => setRegrasDescontos((r) => ({ ...r, advertenciaPercent: Number(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Férias %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={regrasDescontos.feriasPercent}
                    onChange={(e) => setRegrasDescontos((r) => ({ ...r, feriasPercent: Number(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Suspensão %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={regrasDescontos.suspensaoPercent}
                    onChange={(e) => setRegrasDescontos((r) => ({ ...r, suspensaoPercent: Number(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Erros separação %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={regrasDescontos.erroSeparacaoPercent}
                    onChange={(e) => setRegrasDescontos((r) => ({ ...r, erroSeparacaoPercent: Number(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Erros entregas %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={regrasDescontos.erroEntregasPercent}
                    onChange={(e) => setRegrasDescontos((r) => ({ ...r, erroEntregasPercent: Number(e.target.value) || 0 }))}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogRegrasDescontosAberto(false)}>Cancelar</Button>
              <Button onClick={salvarRegrasDescontos} disabled={salvandoRegrasDescontos} className="bg-green-600 hover:bg-green-700">
                {salvandoRegrasDescontos ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Dialog Editar Regras */}
      < Dialog open={dialogRegrasAberto} onOpenChange={setDialogRegrasAberto} >
        {dialogRegrasAberto && (
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Regras de Cálculo</DialogTitle>
              <DialogDescription>
                Faixas mínimas e valor em R$ para cada métrica. Percentuais: KG 50%, VOL 30%, PLT 20%.
              </DialogDescription>
            </DialogHeader>
            {regras && (
              <div className="space-y-6 py-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>% Kg/Hora</Label>
                    <Input
                      type="number"
                      min={0}
                      max={1}
                      step={0.1}
                      value={regras.percentuais_metricas.kg_hora}
                      onChange={(e) =>
                        setRegras({
                          ...regras,
                          percentuais_metricas: {
                            ...regras.percentuais_metricas,
                            kg_hora: Number(e.target.value) || 0,
                          },
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>% Vol/Hora</Label>
                    <Input
                      type="number"
                      min={0}
                      max={1}
                      step={0.1}
                      value={regras.percentuais_metricas.vol_hora}
                      onChange={(e) =>
                        setRegras({
                          ...regras,
                          percentuais_metricas: {
                            ...regras.percentuais_metricas,
                            vol_hora: Number(e.target.value) || 0,
                          },
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>% Plt/Hora</Label>
                    <Input
                      type="number"
                      min={0}
                      max={1}
                      step={0.1}
                      value={regras.percentuais_metricas.plt_hora}
                      onChange={(e) =>
                        setRegras({
                          ...regras,
                          percentuais_metricas: {
                            ...regras.percentuais_metricas,
                            plt_hora: Number(e.target.value) || 0,
                          },
                        })
                      }
                    />
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">KG/Hora (mínimo → valor R$)</h4>
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Mín. Kg/Hora</TableHead>
                          <TableHead>Valor (R$)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {regras.regras_kg_hora.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <Input
                                type="number"
                                value={r.kg_hora ?? ''}
                                onChange={(e) => {
                                  const v = [...regras.regras_kg_hora]
                                  v[i] = { ...v[i], kg_hora: Number(e.target.value) || 0, valor: v[i].valor }
                                  setRegras({ ...regras, regras_kg_hora: v })
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={r.valor ?? ''}
                                onChange={(e) => {
                                  const v = [...regras.regras_kg_hora]
                                  v[i] = { ...v[i], valor: Number(e.target.value) || 0, kg_hora: v[i].kg_hora }
                                  setRegras({ ...regras, regras_kg_hora: v })
                                }}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Vol/Hora (mínimo → valor R$)</h4>
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Mín. Vol/Hora</TableHead>
                          <TableHead>Valor (R$)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {regras.regras_vol_hora.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <Input
                                type="number"
                                value={r.vol_hora ?? ''}
                                onChange={(e) => {
                                  const v = [...regras.regras_vol_hora]
                                  v[i] = { ...v[i], vol_hora: Number(e.target.value) || 0, valor: v[i].valor }
                                  setRegras({ ...regras, regras_vol_hora: v })
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={r.valor ?? ''}
                                onChange={(e) => {
                                  const v = [...regras.regras_vol_hora]
                                  v[i] = { ...v[i], valor: Number(e.target.value) || 0, vol_hora: v[i].vol_hora }
                                  setRegras({ ...regras, regras_vol_hora: v })
                                }}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Plt/Hora (mínimo → valor R$)</h4>
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Mín. Plt/Hora</TableHead>
                          <TableHead>Valor (R$)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {regras.regras_plt_hora.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <Input
                                type="number"
                                step={0.1}
                                value={r.plt_hora ?? ''}
                                onChange={(e) => {
                                  const v = [...regras.regras_plt_hora]
                                  v[i] = { ...v[i], plt_hora: Number(e.target.value) || 0, valor: v[i].valor }
                                  setRegras({ ...regras, regras_plt_hora: v })
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={r.valor ?? ''}
                                onChange={(e) => {
                                  const v = [...regras.regras_plt_hora]
                                  v[i] = { ...v[i], valor: Number(e.target.value) || 0, plt_hora: v[i].plt_hora }
                                  setRegras({ ...regras, regras_plt_hora: v })
                                }}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogRegrasAberto(false)}>Cancelar</Button>
              <Button onClick={() => setConfirmSalvarRegrasOpen(true)} disabled={salvandoRegras || !regras} className="bg-green-600 hover:bg-green-700">
                {salvandoRegras ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog >

      <ConfirmDialog
        open={confirmSalvarUsuarioOpen}
        onOpenChange={setConfirmSalvarUsuarioOpen}
        title="Deseja realmente alterar?"
        message="As alterações serão aplicadas a este usuário."
        onConfirm={salvarUsuario}
        confirmLabel="Sim"
        cancelLabel="Não"
      />
      <ConfirmDialog
        open={confirmExcluirUsuarioOpen}
        onOpenChange={(open) => { setConfirmExcluirUsuarioOpen(open); if (!open) setIdUsuarioExcluir(null) }}
        title="Deseja realmente excluir este usuário?"
        message="O usuário será removido."
        onConfirm={executarExcluirUsuario}
        confirmLabel="Sim"
        cancelLabel="Não"
      />
      <ConfirmDialog
        open={confirmSalvarMetaOpen}
        onOpenChange={setConfirmSalvarMetaOpen}
        title="Deseja realmente alterar?"
        message="A meta de produtividade será atualizada."
        onConfirm={salvarMeta}
        confirmLabel="Sim"
        cancelLabel="Não"
      />
      <ConfirmDialog
        open={confirmSalvarRegrasOpen}
        onOpenChange={setConfirmSalvarRegrasOpen}
        title="Deseja realmente alterar?"
        message="As regras de cálculo serão atualizadas."
        onConfirm={salvarRegras}
        confirmLabel="Sim"
        cancelLabel="Não"
      />
    </div >
  )
}
