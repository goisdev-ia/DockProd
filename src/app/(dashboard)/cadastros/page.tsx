'use client'

import { useEffect, useState, useRef } from 'react'
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
import { Edit, Trash2, Plus, UserPlus, Download, Upload, Building2 } from 'lucide-react'
import type { Colaborador } from '@/types/database'
import * as XLSX from 'xlsx'

interface ColaboradorExtendido extends Colaborador {
  filiais?: { nome: string }
}

interface FilialRow {
  id: string
  codigo: string
  nome: string
  ativo: boolean
}

export default function CadastrosPage() {
  const [colaboradores, setColaboradores] = useState<ColaboradorExtendido[]>([])
  const [filiais, setFiliais] = useState<{ id: string; nome: string;[key: string]: unknown }[]>([])
  const [loading, setLoading] = useState(true)

  // Dialog
  const [dialogAberto, setDialogAberto] = useState(false)
  const [modoEdicao, setModoEdicao] = useState(false)
  const [colaboradorEditando, setColaboradorEditando] = useState<Colaborador | null>(null)

  // Form
  const [matricula, setMatricula] = useState('')
  const [nome, setNome] = useState('')
  const [filialSelecionada, setFilialSelecionada] = useState('')
  const [funcao, setFuncao] = useState('Separador')

  // Filiais CRUD
  const [filiaisLista, setFiliaisLista] = useState<FilialRow[]>([])
  const [dialogFilialAberto, setDialogFilialAberto] = useState(false)
  const [filialEditando, setFilialEditando] = useState<FilialRow | null>(null)
  const [filialCodigo, setFilialCodigo] = useState('')
  const [filialNome, setFilialNome] = useState('')
  const [filialAtivo, setFilialAtivo] = useState(true)
  const [confirmSalvarColabOpen, setConfirmSalvarColabOpen] = useState(false)
  const [confirmSalvarFilialOpen, setConfirmSalvarFilialOpen] = useState(false)
  const [confirmAlternarOpen, setConfirmAlternarOpen] = useState(false)
  const [alternarPayload, setAlternarPayload] = useState<{ id: string; ativoAtual: boolean } | null>(null)

  // Delete state
  const [confirmDeleteColabOpen, setConfirmDeleteColabOpen] = useState(false)
  const [colaboradorParaDeletar, setColaboradorParaDeletar] = useState<string | null>(null)
  const [confirmDeleteFilialOpen, setConfirmDeleteFilialOpen] = useState(false)
  const [filialParaDeletar, setFilialParaDeletar] = useState<string | null>(null)

  const inputFileRef = useRef<HTMLInputElement>(null)

  const supabase = createClient()

  useEffect(() => {
    carregarDados()
    carregarFiliais()
  }, [])

  const carregarDados = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('colaboradores')
        .select(`
          *,
          filiais (nome)
        `)
        .order('nome')

      if (data) {
        setColaboradores(data)
      }
    } catch (error) {
      console.error('Erro ao carregar colaboradores:', error)
    } finally {
      setLoading(false)
    }
  }

  const carregarFiliais = async () => {
    const { data } = await supabase
      .from('filiais')
      .select('*')
      .order('nome')
    if (data) {
      setFiliais(data.filter((f: { ativo: boolean }) => f.ativo))
      setFiliaisLista(data)
    }
  }

  const abrirNovaFilial = () => {
    setFilialEditando(null)
    setFilialCodigo('')
    setFilialNome('')
    setFilialAtivo(true)
    setDialogFilialAberto(true)
  }

  const abrirEdicaoFilial = (f: FilialRow) => {
    setFilialEditando(f)
    setFilialCodigo(f.codigo)
    setFilialNome(f.nome)
    setFilialAtivo(f.ativo)
    setDialogFilialAberto(true)
  }

  const salvarFilial = async () => {
    if (!filialCodigo.trim() || !filialNome.trim()) {
      alert('Preencha código e nome')
      return
    }
    try {
      const payload = { codigo: filialCodigo.trim(), nome: filialNome.trim(), ativo: filialAtivo, updated_at: new Date().toISOString() }
      if (filialEditando) {
        const { error } = await supabase.from('filiais').update(payload).eq('id', filialEditando.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('filiais').insert(payload)
        if (error) throw error
      }
      setDialogFilialAberto(false)
      carregarFiliais()
    } catch (e: unknown) {
      const err = e as { code?: string }
      if (err.code === '23505') alert('Código de filial já existe')
      else alert('Erro ao salvar filial')
    }
  }

  const exportarColaboradores = () => {
    const rows = colaboradores.map((c) => ({
      Matrícula: c.matricula,
      Nome: c.nome,
      Filial: (c as ColaboradorExtendido).filiais?.nome ?? '',
      Função: c.funcao,
      Status: c.ativo ? 'Ativo' : 'Inativo',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Colaboradores')
    XLSX.writeFile(wb, `colaboradores-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const importarColaboradores = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)
      const filiaisByNome = Object.fromEntries((filiais as { id: string; nome: string; codigo?: string }[]).map((f) => [f.nome, f.id]))
      const filiaisByCodigo = Object.fromEntries((filiais as { id: string; nome: string; codigo?: string }[]).map((f) => [f.codigo, f.id]))
      let ok = 0
      let erros = 0
      for (const row of rows) {
        const matricula = String(row['Matrícula'] ?? row['matricula'] ?? '').trim()
        const nome = String(row['Nome'] ?? row['nome'] ?? '').trim()
        const filialNome = String(row['Filial'] ?? row['filial'] ?? '').trim()
        const filialCod = String(row['Código'] ?? row['codigo'] ?? '').trim()
        const idFilial = filiaisByNome[filialNome] ?? filiaisByCodigo[filialCod]
        if (!matricula || !nome || !idFilial) {
          erros++
          continue
        }
        const funcao = String(row['Função'] ?? row['funcao'] ?? 'Separador').trim()
        const { error } = await supabase.from('colaboradores').upsert(
          { matricula, nome, id_filial: idFilial, funcao, ativo: true },
          { onConflict: 'matricula' }
        )
        if (error) erros++
        else ok++
      }
      if (inputFileRef.current) inputFileRef.current.value = ''
      carregarDados()
      alert(`Importação: ${ok} ok, ${erros} erros.`)
    } catch (err) {
      console.error(err)
      alert('Erro ao importar. Verifique o formato (colunas: Matrícula, Nome, Filial ou Código, Função).')
    }
  }

  const abrirNovo = () => {
    setModoEdicao(false)
    setColaboradorEditando(null)
    resetarForm()
    setDialogAberto(true)
  }

  const abrirEdicao = (colaborador: ColaboradorExtendido) => {
    setModoEdicao(true)
    setColaboradorEditando(colaborador)
    setMatricula(colaborador.matricula)
    setNome(colaborador.nome)
    setFilialSelecionada(colaborador.id_filial)
    setFuncao(colaborador.funcao)
    setDialogAberto(true)
  }

  const resetarForm = () => {
    setMatricula('')
    setNome('')
    setFilialSelecionada('')
    setFuncao('Separador')
  }

  const salvar = async () => {
    if (!matricula || !nome || !filialSelecionada) {
      alert('Preencha todos os campos obrigatórios')
      return
    }

    try {
      const dadosColaborador = {
        matricula,
        nome,
        id_filial: filialSelecionada,
        funcao,
        ativo: true
      }

      if (modoEdicao && colaboradorEditando) {
        const { error } = await supabase
          .from('colaboradores')
          .update(dadosColaborador)
          .eq('id', colaboradorEditando.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('colaboradores')
          .insert(dadosColaborador)

        if (error) throw error
      }

      setDialogAberto(false)
      carregarDados()
    } catch (error: unknown) {
      const err = error as { code?: string }
      console.error('Erro ao salvar:', error)
      if (err?.code === '23505') {
        alert('Esta matrícula já está cadastrada')
      } else {
        alert('Erro ao salvar colaborador')
      }
    }
  }

  const abrirConfirmAlternar = (id: string, ativoAtual: boolean) => {
    setAlternarPayload({ id, ativoAtual })
    setConfirmAlternarOpen(true)
  }

  const executarAlternarStatus = async () => {
    if (!alternarPayload) return
    try {
      const { error } = await supabase
        .from('colaboradores')
        .update({ ativo: !alternarPayload.ativoAtual })
        .eq('id', alternarPayload.id)

      if (error) throw error
      carregarDados()
      setAlternarPayload(null)
    } catch (error) {
      console.error('Erro ao alterar status:', error)
      alert('Erro ao alterar status')
    }
  }

  const alternarStatus = async (id: string, ativoAtual: boolean) => {
    abrirConfirmAlternar(id, ativoAtual)
  }

  // Delete colaborador
  const abrirConfirmDeleteColab = (id: string) => {
    setColaboradorParaDeletar(id)
    setConfirmDeleteColabOpen(true)
  }

  const executarDeleteColab = async () => {
    if (!colaboradorParaDeletar) return
    try {
      const { error } = await supabase
        .from('colaboradores')
        .delete()
        .eq('id', colaboradorParaDeletar)
      if (error) throw error
      carregarDados()
    } catch (error) {
      console.error('Erro ao excluir colaborador:', error)
      alert('Erro ao excluir colaborador. Pode haver dados vinculados.')
    } finally {
      setColaboradorParaDeletar(null)
    }
  }

  // Delete filial
  const abrirConfirmDeleteFilial = (id: string) => {
    setFilialParaDeletar(id)
    setConfirmDeleteFilialOpen(true)
  }

  const executarDeleteFilial = async () => {
    if (!filialParaDeletar) return
    try {
      const { error } = await supabase
        .from('filiais')
        .delete()
        .eq('id', filialParaDeletar)
      if (error) throw error
      carregarFiliais()
    } catch (error) {
      console.error('Erro ao excluir filial:', error)
      alert('Erro ao excluir filial. Pode haver colaboradores vinculados.')
    } finally {
      setFilialParaDeletar(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cadastros</h1>
        <p className="text-muted-foreground">
          Colaboradores e filiais
        </p>
      </div>

      <Tabs defaultValue="colaboradores" className="space-y-4">
        <TabsList>
          <TabsTrigger value="colaboradores">Colaboradores</TabsTrigger>
          <TabsTrigger value="filiais">Filiais</TabsTrigger>
        </TabsList>

        <TabsContent value="colaboradores" className="space-y-4">
          <div className="flex flex-wrap gap-2 justify-between items-center">
            <div className="flex gap-2">
              <Button onClick={abrirNovo} className="bg-green-600 hover:bg-green-700">
                <UserPlus className="w-4 h-4 mr-2" />
                Novo Colaborador
              </Button>
              <Button variant="outline" onClick={exportarColaboradores}>
                <Download className="w-4 h-4 mr-2" />
                Exportar lista
              </Button>
              <Button variant="outline" onClick={() => inputFileRef.current?.click()}>
                <Upload className="w-4 h-4 mr-2" />
                Importar (XLSX)
              </Button>
              <input ref={inputFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={importarColaboradores} />
            </div>
          </div>

          {/* Tabela Colaboradores */}
          <Card>
            <CardHeader>
              <CardTitle>Lista de Colaboradores</CardTitle>
              <CardDescription>
                {colaboradores.length} colaborador(es) cadastrado(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Matrícula</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Filial</TableHead>
                      <TableHead>Função</TableHead>
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
                    ) : colaboradores.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Nenhum colaborador cadastrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      colaboradores.map((colaborador) => (
                        <TableRow key={colaborador.id}>
                          <TableCell className="font-mono">{colaborador.matricula}</TableCell>
                          <TableCell className="font-medium">{colaborador.nome}</TableCell>
                          <TableCell className="text-xs">{colaborador.filiais?.nome}</TableCell>
                          <TableCell>{colaborador.funcao}</TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => alternarStatus(colaborador.id, colaborador.ativo)}
                            >
                              <Badge variant={colaborador.ativo ? 'default' : 'secondary'}>
                                {colaborador.ativo ? 'Ativo' : 'Inativo'}
                              </Badge>
                            </Button>
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => abrirEdicao(colaborador)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => abrirConfirmDeleteColab(colaborador.id)}
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

          {/* Dialog */}
          <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
            {dialogAberto && (
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{modoEdicao ? 'Editar' : 'Novo'} Colaborador</DialogTitle>
                  <DialogDescription>
                    Preencha os dados do colaborador
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label>Matrícula *</Label>
                    <Input
                      value={matricula}
                      onChange={(e) => setMatricula(e.target.value)}
                      placeholder="Ex: 12345"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nome Completo *</Label>
                    <Input
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Ex: João Silva"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Filial *</Label>
                    <Select value={filialSelecionada} onValueChange={setFilialSelecionada}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {filiais.map(f => (
                          <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Função *</Label>
                    <Select value={funcao} onValueChange={setFuncao}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Separador">Separador</SelectItem>
                        <SelectItem value="Conferente">Conferente</SelectItem>
                        <SelectItem value="Supervisor">Supervisor</SelectItem>
                        <SelectItem value="Líder">Líder</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogAberto(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={() => setConfirmSalvarColabOpen(true)} className="bg-green-600 hover:bg-green-700">
                    Salvar
                  </Button>
                </DialogFooter>
              </DialogContent>
            )}
          </Dialog>

        </TabsContent>

        <TabsContent value="filiais" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={abrirNovaFilial} className="bg-green-600 hover:bg-green-700">
              <Building2 className="w-4 h-4 mr-2" />
              Nova Filial
            </Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Filiais</CardTitle>
              <CardDescription>{filiaisLista.length} filial(is)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filiaisLista.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          Nenhuma filial cadastrada
                        </TableCell>
                      </TableRow>
                    ) : (
                      filiaisLista.map((f) => (
                        <TableRow key={f.id}>
                          <TableCell className="font-mono">{f.codigo}</TableCell>
                          <TableCell className="font-medium">{f.nome}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={f.ativo ? 'default' : 'secondary'}>{f.ativo ? 'Ativo' : 'Inativo'}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center gap-1">
                              <Button size="sm" variant="ghost" onClick={() => abrirEdicaoFilial(f)}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => abrirConfirmDeleteFilial(f.id)}
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

          <Dialog open={dialogFilialAberto} onOpenChange={setDialogFilialAberto}>
            {dialogFilialAberto && (
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{filialEditando ? 'Editar' : 'Nova'} Filial</DialogTitle>
                  <DialogDescription>Código e nome da filial</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label>Código *</Label>
                    <Input value={filialCodigo} onChange={(e) => setFilialCodigo(e.target.value)} placeholder="Ex: CD01" disabled={!!filialEditando} />
                  </div>
                  <div className="space-y-2">
                    <Label>Nome *</Label>
                    <Input value={filialNome} onChange={(e) => setFilialNome(e.target.value)} placeholder="Ex: Filial Centro" />
                  </div>
                  {filialEditando && (
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="filialAtivo" checked={filialAtivo} onChange={(e) => setFilialAtivo(e.target.checked)} className="w-4 h-4" />
                      <Label htmlFor="filialAtivo">Ativo</Label>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogFilialAberto(false)}>Cancelar</Button>
                  <Button onClick={() => setConfirmSalvarFilialOpen(true)} className="bg-green-600 hover:bg-green-700">Salvar</Button>
                </DialogFooter>
              </DialogContent>
            )}
          </Dialog>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirmSalvarColabOpen}
        onOpenChange={setConfirmSalvarColabOpen}
        title={modoEdicao ? 'Deseja realmente alterar?' : 'Deseja realmente salvar?'}
        message={modoEdicao ? 'As alterações serão aplicadas a este colaborador.' : 'O novo colaborador será cadastrado.'}
        onConfirm={salvar}
        confirmLabel="Sim"
        cancelLabel="Não"
      />
      <ConfirmDialog
        open={confirmSalvarFilialOpen}
        onOpenChange={setConfirmSalvarFilialOpen}
        title={filialEditando ? 'Deseja realmente alterar?' : 'Deseja realmente salvar?'}
        message={filialEditando ? 'As alterações serão aplicadas a esta filial.' : 'A nova filial será cadastrada.'}
        onConfirm={salvarFilial}
        confirmLabel="Sim"
        cancelLabel="Não"
      />
      <ConfirmDialog
        open={confirmAlternarOpen}
        onOpenChange={(open) => { setConfirmAlternarOpen(open); if (!open) setAlternarPayload(null) }}
        title="Deseja realmente alterar?"
        message={alternarPayload ? (alternarPayload.ativoAtual ? 'O colaborador será desativado.' : 'O colaborador será ativado.') : ''}
        onConfirm={executarAlternarStatus}
        confirmLabel="Sim"
        cancelLabel="Não"
      />
      <ConfirmDialog
        open={confirmDeleteColabOpen}
        onOpenChange={(open) => { setConfirmDeleteColabOpen(open); if (!open) setColaboradorParaDeletar(null) }}
        title="Excluir Colaborador?"
        message="Esta ação não pode ser desfeita. O colaborador será removido permanentemente."
        onConfirm={executarDeleteColab}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
      />
      <ConfirmDialog
        open={confirmDeleteFilialOpen}
        onOpenChange={(open) => { setConfirmDeleteFilialOpen(open); if (!open) setFilialParaDeletar(null) }}
        title="Excluir Filial?"
        message="Esta ação não pode ser desfeita. A filial será removida permanentemente."
        onConfirm={executarDeleteFilial}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
      />
    </div>
  )
}
