'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollText, Loader2, ChevronLeft, ChevronRight, Filter } from 'lucide-react'

const PAGE_SIZE = 50

interface LogRow {
  id: string
  created_at: string
  nome_usuario: string | null
  filial_nome: string | null
  id_carga_cliente: string | null
  acao: string
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [paginaAtual, setPaginaAtual] = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')
  const [filtroAcao, setFiltroAcao] = useState('')
  const [filtroUsuario, setFiltroUsuario] = useState('')
  const [filtroIdCargaCliente, setFiltroIdCargaCliente] = useState('')
  const [filtroFilial, setFiltroFilial] = useState('')
  const [filtrosVisiveis, setFiltrosVisiveis] = useState(false)

  const supabase = createClient()

  const carregarLogs = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('logs_acao')
        .select('id, created_at, nome_usuario, filial_nome, id_carga_cliente, acao', { count: 'exact' })
        .order('created_at', { ascending: false })

      if (filtroDataInicio) {
        query = query.gte('created_at', `${filtroDataInicio}T00:00:00.000Z`)
      }
      if (filtroDataFim) {
        query = query.lte('created_at', `${filtroDataFim}T23:59:59.999Z`)
      }
      if (filtroAcao.trim()) {
        query = query.ilike('acao', `%${filtroAcao.trim()}%`)
      }
      if (filtroUsuario.trim()) {
        query = query.ilike('nome_usuario', `%${filtroUsuario.trim()}%`)
      }
      if (filtroIdCargaCliente.trim()) {
        query = query.ilike('id_carga_cliente', `%${filtroIdCargaCliente.trim()}%`)
      }
      if (filtroFilial.trim()) {
        query = query.ilike('filial_nome', `%${filtroFilial.trim()}%`)
      }

      const from = (paginaAtual - 1) * PAGE_SIZE
      const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1)

      if (error) throw error
      setLogs((data ?? []) as LogRow[])
      setTotalPaginas(Math.ceil((count ?? 0) / PAGE_SIZE))
    } catch (e) {
      console.error(e)
      setLogs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarLogs()
  }, [paginaAtual])

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <ScrollText className="h-8 w-8" />
              Logs e Histórico
            </h1>
            <p className="text-muted-foreground">
              Registro de ações realizadas no sistema (apenas admin)
            </p>
          </div>
          <Button
            variant={filtrosVisiveis ? "default" : "outline"}
            onClick={() => setFiltrosVisiveis(!filtrosVisiveis)}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            {filtrosVisiveis ? 'Ocultar Filtros' : 'Mostrar Filtros'}
          </Button>
        </div>
      </div>

      {filtrosVisiveis && (
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>Filtrar por período ou texto da ação</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Data início</Label>
                <Input
                  type="date"
                  value={filtroDataInicio}
                  onChange={(e) => setFiltroDataInicio(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Data fim</Label>
                <Input
                  type="date"
                  value={filtroDataFim}
                  onChange={(e) => setFiltroDataFim(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Ação (contém)</Label>
                <Input
                  placeholder="Ex: produtividade, upload..."
                  value={filtroAcao}
                  onChange={(e) => setFiltroAcao(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Usuário</Label>
                <Input
                  placeholder="Nome do usuário"
                  value={filtroUsuario}
                  onChange={(e) => setFiltroUsuario(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>ID Carga Cliente</Label>
                <Input
                  placeholder="Ex: 12345"
                  value={filtroIdCargaCliente}
                  onChange={(e) => setFiltroIdCargaCliente(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Filial</Label>
                <Input
                  placeholder="Nome da filial"
                  value={filtroFilial}
                  onChange={(e) => setFiltroFilial(e.target.value)}
                />
              </div>
              <div className="flex items-end col-span-1 md:col-span-3">
                <Button onClick={() => { setPaginaAtual(1); carregarLogs(); }} className="w-full md:w-auto">
                  Aplicar Filtros
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Registro de Ações</CardTitle>
          <CardDescription>
            Data e hora, usuário, filial e ação realizada
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data e hora</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Filial</TableHead>
                  <TableHead>ID Carga Cliente</TableHead>
                  <TableHead>Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhum log encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {new Date(row.created_at).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell>{row.nome_usuario ?? '—'}</TableCell>
                      <TableCell>{row.filial_nome ?? '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{row.id_carga_cliente ?? '—'}</TableCell>
                      <TableCell>{row.acao}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Página {paginaAtual} de {totalPaginas}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
                  disabled={paginaAtual === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}
                  disabled={paginaAtual === totalPaginas}
                >
                  Próxima
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
