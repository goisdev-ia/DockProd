'use client'

import { useEffect, useState, useCallback } from 'react'
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
import { Edit, Save, Settings as SettingsIcon, Users, Shield, Globe, Mail, Database, MessageSquare, FileText } from 'lucide-react'
import { toast } from 'sonner'
import type { Usuario, TipoUsuario } from '@/types/database'
import type { RegrasCalculo } from '@/lib/calculos'
import { registrarLog } from '@/lib/logs'

interface UsuarioExtendido extends Usuario {
  filial_nome?: string
}

interface RegraTier {
  kg_hora?: number
  vol_hora?: number
  plt_hora?: number
  valor: number
}

export default function ConfiguracoesPage() {
  const [usuarios, setUsuarios] = useState<UsuarioExtendido[]>([])
  const [filiais, setFiliais] = useState<{ id: string; nome: string; [key: string]: unknown }[]>([])
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

  const supabase = createClient()

  useEffect(() => {
    carregarUsuarios()
    carregarFiliais()
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
      // Converter "nenhuma" para null antes de salvar
      const filialParaSalvar = filialUsuario === 'nenhuma' || filialUsuario === '' ? null : filialUsuario
      
      // Usar função RPC para evitar problemas de RLS
      const { error } = await supabase.rpc('update_usuario_by_admin', {
        usuario_id: usuarioEditando.id,
        novo_nome: nomeUsuario,
        novo_email: emailUsuario,
        nova_senha: senhaUsuario || null,
        novo_tipo: tipoUsuario,
        nova_filial: filialParaSalvar,
        novo_ativo: ativoUsuario
      })

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
      const { error } = await supabase
        .from('usuarios')
        .delete()
        .eq('id', idUsuarioExcluir)

      if (error) throw error
      registrarLog(supabase, 'Excluiu usuário')
      toast.success('Usuário excluído')
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

      <Tabs defaultValue="usuarios" className="space-y-4">
        <TabsList>
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
                  <p className="text-sm text-muted-foreground">PickProd - Cada pedido conta. Logo configurável em versão futura.</p>
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
      </Tabs>

      {/* Dialog de Edição / Cadastro de Usuário */}
      <Dialog open={dialogUsuarioAberto} onOpenChange={setDialogUsuarioAberto}>
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
        )}
      </Dialog>

      {/* Dialog Editar Meta */}
      <Dialog open={dialogMetaAberto} onOpenChange={setDialogMetaAberto}>
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
      </Dialog>

      {/* Dialog Editar Regras */}
      <Dialog open={dialogRegrasAberto} onOpenChange={setDialogRegrasAberto}>
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
      </Dialog>

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
    </div>
  )
}
