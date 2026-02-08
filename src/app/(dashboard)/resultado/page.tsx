'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Calculator, RefreshCw, TrendingUp, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import {
  calcularProdutividadeBruta,
  calcularPercentualErros,
  calcularProdutividadeFinal,
  calcularPercentualAtingimento,
  obterCorProdutividade,
  type RegrasCalculo
} from '@/lib/calculos'
import { getDatasPorMesAno, toISODate } from '@/lib/dashboard-filters'
import type { Fechamento } from '@/types/database'

interface FechamentoExtendido extends Fechamento {
  colaborador_nome?: string
  colaborador_matricula?: string
  filial_nome?: string
}

export default function ResultadoPage() {
  const [fechamentos, setFechamentos] = useState<FechamentoExtendido[]>([])
  const [loading, setLoading] = useState(true)
  const [calculando, setCalculando] = useState(false)
  const [regrasCalculo, setRegrasCalculo] = useState<RegrasCalculo | null>(null)
  
  const [mesSelecionado, setMesSelecionado] = useState('')
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear())
  
  const supabase = createClient()

  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ]

  useEffect(() => {
    // Definir mês atual
    const mesAtual = meses[new Date().getMonth()]
    setMesSelecionado(mesAtual)
  }, [])

  useEffect(() => {
    if (mesSelecionado) {
      carregarRegrasCalculo()
      carregarFechamentos()
    }
  }, [mesSelecionado, anoSelecionado])

  const carregarRegrasCalculo = async () => {
    try {
      const { data } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', [
          'regras_kg_hora',
          'regras_vol_hora',
          'regras_plt_hora',
          'percentuais_metricas'
        ])

      if (data) {
        const raw: Record<string, unknown> = {}
        data.forEach(config => {
          raw[config.chave] = config.valor
        })
        const normalizarFaixasKg = (arr: unknown[]): { kg_hora: number; valor: number }[] =>
          (arr || []).map((r: unknown) => ({
            kg_hora: Number((r as { kg_hora?: number })?.kg_hora ?? 0),
            valor: Number((r as { valor?: number })?.valor ?? 0),
          }))
        const normalizarFaixasVol = (arr: unknown[]): { vol_hora: number; valor: number }[] =>
          (arr || []).map((r: unknown) => ({
            vol_hora: Number((r as { vol_hora?: number })?.vol_hora ?? 0),
            valor: Number((r as { valor?: number })?.valor ?? 0),
          }))
        const normalizarFaixasPlt = (arr: unknown[]): { plt_hora: number; valor: number }[] =>
          (arr || []).map((r: unknown) => ({
            plt_hora: Number((r as { plt_hora?: number })?.plt_hora ?? 0),
            valor: Number((r as { valor?: number })?.valor ?? 0),
          }))
        const pm = (raw.percentuais_metricas as { kg_hora?: number; vol_hora?: number; plt_hora?: number }) ?? {}
        const toPct = (v: unknown): number => {
          const n = Number(v ?? 0)
          return n >= 1 ? n / 100 : n
        }
        const regras: RegrasCalculo = {
          regras_kg_hora: Array.isArray(raw.regras_kg_hora) ? normalizarFaixasKg(raw.regras_kg_hora) : [],
          regras_vol_hora: Array.isArray(raw.regras_vol_hora) ? normalizarFaixasVol(raw.regras_vol_hora) : [],
          regras_plt_hora: Array.isArray(raw.regras_plt_hora) ? normalizarFaixasPlt(raw.regras_plt_hora) : [],
          percentuais_metricas: {
            kg_hora: toPct(pm.kg_hora),
            vol_hora: toPct(pm.vol_hora),
            plt_hora: toPct(pm.plt_hora),
          },
        }
        setRegrasCalculo(regras)
      }
    } catch (error) {
      console.error('Erro ao carregar regras:', error)
    }
  }

  const carregarFechamentos = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('fechamento')
        .select(`
          *,
          colaboradores (nome, matricula),
          filiais (nome)
        `)
        .eq('mes', mesSelecionado)
        .eq('ano', anoSelecionado)
        .order('produtividade_final', { ascending: false })

      if (data) {
        const fechamentosFormatados = data.map(f => ({
          ...f,
          colaborador_nome: f.colaboradores?.nome,
          colaborador_matricula: f.colaboradores?.matricula,
          filial_nome: f.filiais?.nome,
          valor_kg_hs: Number(f.valor_kg_hs) || 0,
          valor_vol_hs: Number(f.valor_vol_hs) || 0,
          valor_plt_hs: Number(f.valor_plt_hs) || 0,
          produtividade_bruta: Number(f.produtividade_bruta) || 0,
          produtividade_final: Number(f.produtividade_final) ?? 0,
        }))
        setFechamentos(fechamentosFormatados)
      }
    } catch (error) {
      console.error('Erro ao carregar fechamentos:', error)
    } finally {
      setLoading(false)
    }
  }

  const calcularFechamento = async () => {
    if (!regrasCalculo) {
      toast.error('Regras de cálculo não carregadas. Tente recarregar a página.')
      return
    }
    const faixasOk =
      Array.isArray(regrasCalculo.regras_kg_hora) && regrasCalculo.regras_kg_hora.length > 0 &&
      Array.isArray(regrasCalculo.regras_vol_hora) && regrasCalculo.regras_vol_hora.length > 0 &&
      Array.isArray(regrasCalculo.regras_plt_hora) && regrasCalculo.regras_plt_hora.length > 0
    if (!faixasOk) {
      toast.error('Configure as faixas de pagamento em Configurações antes de calcular o fechamento.')
      return
    }

    if (!confirm(`Calcular fechamento para ${mesSelecionado}/${anoSelecionado}? Isso irá recalcular todos os dados.`)) {
      return
    }

    setCalculando(true)

    try {
      // 1. Buscar todos os colaboradores ativos
      const { data: colaboradores } = await supabase
        .from('colaboradores')
        .select('*')
        .eq('ativo', true)

      if (!colaboradores) return

      const { dataInicio, dataFim } = getDatasPorMesAno(mesSelecionado, anoSelecionado)
      const dataInicioISO = toISODate(dataInicio)
      const dataFimISO = toISODate(dataFim)

      let fechamentosGravados = 0

      // 2. Para cada colaborador, calcular seu fechamento
      for (const colaborador of colaboradores) {
        // Buscar dados de produtividade do mês/ano por data_carga (mes na tabela está NULL)
        const { data: dadosProducao } = await supabase
          .from('dados_produtividade')
          .select('*')
          .eq('id_colaborador', colaborador.id)
          .gte('data_carga', dataInicioISO)
          .lte('data_carga', dataFimISO)

        if (!dadosProducao || dadosProducao.length === 0) continue

        // Totalizar dados
        const pesoLiquidoTotal = dadosProducao.reduce((sum, d) => sum + (d.peso_liquido || 0), 0)
        const volumeTotal = dadosProducao.reduce((sum, d) => sum + (d.qtd_venda || 0), 0)
        const paletesTotal = dadosProducao.reduce((sum, d) => sum + (d.paletes || 0), 0)
        const tempoTotal = dadosProducao.reduce((sum, d) => sum + (d.tempo || 0), 0)
        const erroSeparacaoTotal = dadosProducao.reduce((sum, d) => sum + (d.erro_separacao || 0), 0)
        const erroEntregasTotal = dadosProducao.reduce((sum, d) => sum + (d.erro_entregas || 0), 0)

        // Calcular métricas de produtividade
        const kgHs = tempoTotal > 0 ? pesoLiquidoTotal / tempoTotal : 0
        const volHs = tempoTotal > 0 ? volumeTotal / tempoTotal : 0
        const pltHs = tempoTotal > 0 ? paletesTotal / tempoTotal : 0

        // Calcular produtividade bruta
        const {
          valor_kg_hs,
          valor_vol_hs,
          valor_plt_hs,
          produtividade_bruta
        } = calcularProdutividadeBruta(kgHs, volHs, pltHs, regrasCalculo)

        // Calcular percentual de erros
        const percentualErros = calcularPercentualErros(erroSeparacaoTotal, erroEntregasTotal)

        // Buscar descontos do colaborador
        const { data: desconto } = await supabase
          .from('descontos')
          .select('*')
          .eq('id_colaborador', colaborador.id)
          .eq('mes', mesSelecionado)
          .eq('ano', anoSelecionado)
          .single()

        const percentualDescontos = desconto?.percentual_total || 0

        // Calcular produtividade final
        const {
          valor_desconto_erros,
          valor_desconto_outros,
          produtividade_final
        } = calcularProdutividadeFinal(produtividade_bruta, percentualErros, percentualDescontos)

        // Calcular atingimento
        const meta = 300
        const percentualAtingimento = calcularPercentualAtingimento(produtividade_final, meta)

        // Salvar ou atualizar fechamento
        const dadosFechamento = {
          id_colaborador: colaborador.id,
          id_filial: colaborador.id_filial,
          id_desconto: desconto?.id || null,
          mes: mesSelecionado,
          ano: anoSelecionado,
          peso_liquido_total: pesoLiquidoTotal,
          volume_total: volumeTotal,
          paletes_total: paletesTotal,
          tempo_total: tempoTotal,
          kg_hs: kgHs,
          vol_hs: volHs,
          plt_hs: pltHs,
          erro_separacao_total: erroSeparacaoTotal,
          erro_entregas_total: erroEntregasTotal,
          percentual_erros: percentualErros * 100,
          valor_kg_hs,
          valor_vol_hs,
          valor_plt_hs,
          produtividade_bruta,
          percentual_descontos: percentualDescontos,
          valor_descontos: valor_desconto_outros,
          produtividade_final,
          meta,
          percentual_atingimento: percentualAtingimento
        }

        // Verificar se já existe fechamento
        const { data: fechamentoExistente } = await supabase
          .from('fechamento')
          .select('id')
          .eq('id_colaborador', colaborador.id)
          .eq('mes', mesSelecionado)
          .eq('ano', anoSelecionado)
          .single()

        if (fechamentoExistente) {
          const { error: updateError } = await supabase
            .from('fechamento')
            .update(dadosFechamento)
            .eq('id', fechamentoExistente.id)
          if (updateError) {
            console.error('Erro ao atualizar fechamento:', updateError)
            toast.error(`Erro ao atualizar fechamento: ${updateError.message}`)
            return
          }
        } else {
          const { error: insertError } = await supabase
            .from('fechamento')
            .insert(dadosFechamento)
          if (insertError) {
            console.error('Erro ao inserir fechamento:', insertError)
            toast.error(`Erro ao inserir fechamento: ${insertError.message}`)
            return
          }
        }
        fechamentosGravados += 1
      }

      toast.success(
        fechamentosGravados > 0
          ? `Fechamento calculado: ${fechamentosGravados} colaborador(es) processado(s).`
          : 'Nenhum dado de produtividade no período. Nenhum fechamento gravado.'
      )
      carregarFechamentos()
    } catch (error) {
      console.error('Erro ao calcular fechamento:', error)
      toast.error('Erro ao calcular fechamento')
    } finally {
      setCalculando(false)
    }
  }

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor)
  }

  const formatarNumero = (valor: number, decimais: number = 2) => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: decimais,
      maximumFractionDigits: decimais
    }).format(valor)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Resultado e Fechamento</h1>
          <p className="text-muted-foreground">
            Visualize os resultados e calcule o fechamento mensal
          </p>
        </div>
        <Button
          onClick={calcularFechamento}
          disabled={calculando}
          className="bg-green-600 hover:bg-green-700"
        >
          {calculando ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Calculando...
            </>
          ) : (
            <>
              <Calculator className="w-4 h-4 mr-2" />
              Calcular Fechamento
            </>
          )}
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Mês</Label>
              <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o mês" />
                </SelectTrigger>
                <SelectContent>
                  {meses.map(m => (
                    <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ano</Label>
              <Select value={String(anoSelecionado)} onValueChange={(v) => setAnoSelecionado(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2026">2026</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela Fechamento */}
      <Card>
        <CardHeader>
          <CardTitle>Dados de Fechamento</CardTitle>
          <CardDescription>
            Totalizadores por colaborador para {mesSelecionado}/{anoSelecionado}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Matrícula</TableHead>
                  <TableHead className="text-right">Peso Total (kg)</TableHead>
                  <TableHead className="text-right">Volume Total</TableHead>
                  <TableHead className="text-right">Paletes Total</TableHead>
                  <TableHead className="text-right">Tempo (h)</TableHead>
                  <TableHead className="text-right">Kg/Hs</TableHead>
                  <TableHead className="text-right">Vol/Hs</TableHead>
                  <TableHead className="text-right">Plt/Hs</TableHead>
                  <TableHead className="text-center">Erros</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : fechamentos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <AlertTriangle className="w-8 h-8 text-amber-500" />
                        <p>Nenhum fechamento encontrado para este período</p>
                        <p className="text-sm">Clique em "Calcular Fechamento" para processar os dados</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  fechamentos.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.colaborador_nome}</TableCell>
                      <TableCell>{f.colaborador_matricula}</TableCell>
                      <TableCell className="text-right">{formatarNumero(f.peso_liquido_total)}</TableCell>
                      <TableCell className="text-right">{formatarNumero(f.volume_total, 0)}</TableCell>
                      <TableCell className="text-right">{formatarNumero(f.paletes_total)}</TableCell>
                      <TableCell className="text-right">{formatarNumero(f.tempo_total)}</TableCell>
                      <TableCell className="text-right font-medium">{formatarNumero(f.kg_hs)}</TableCell>
                      <TableCell className="text-right font-medium">{formatarNumero(f.vol_hs)}</TableCell>
                      <TableCell className="text-right font-medium">{formatarNumero(f.plt_hs)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">
                          Sep: {f.erro_separacao_total} | Ent: {f.erro_entregas_total}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Tabela Resultado */}
      <Card>
        <CardHeader>
          <CardTitle>Resultado Final</CardTitle>
          <CardDescription>
            Cálculo de produtividade e descontos aplicados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Filial</TableHead>
                  <TableHead className="text-right">Vlr Kg/Hs</TableHead>
                  <TableHead className="text-right">Vlr Vol/Hs</TableHead>
                  <TableHead className="text-right">Vlr Plt/Hs</TableHead>
                  <TableHead className="text-right">Prod. Bruta</TableHead>
                  <TableHead className="text-center">% Erros</TableHead>
                  <TableHead className="text-center">% Descontos</TableHead>
                  <TableHead className="text-right">Prod. Final</TableHead>
                  <TableHead>Meta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : fechamentos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      Nenhum resultado disponível
                    </TableCell>
                  </TableRow>
                ) : (
                  fechamentos.map((f) => {
                    const corProdutividade = obterCorProdutividade(f.produtividade_final, f.meta)
                    return (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">{f.colaborador_nome}</TableCell>
                        <TableCell className="text-xs">{f.filial_nome}</TableCell>
                        <TableCell className="text-right">{formatarMoeda(f.valor_kg_hs)}</TableCell>
                        <TableCell className="text-right">{formatarMoeda(f.valor_vol_hs)}</TableCell>
                        <TableCell className="text-right">{formatarMoeda(f.valor_plt_hs)}</TableCell>
                        <TableCell className="text-right font-medium">{formatarMoeda(f.produtividade_bruta)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={f.percentual_erros > 5 ? 'destructive' : 'secondary'}>
                            {formatarNumero(f.percentual_erros, 1)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={f.percentual_descontos > 50 ? 'destructive' : 'secondary'}>
                            {formatarNumero(f.percentual_descontos, 0)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div
                            className="inline-block px-3 py-1 rounded-md font-bold text-white"
                            style={{ backgroundColor: corProdutividade }}
                          >
                            {formatarMoeda(f.produtividade_final)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span>Meta: {formatarMoeda(f.meta)}</span>
                              <span className="font-medium">{formatarNumero(f.percentual_atingimento, 0)}%</span>
                            </div>
                            <Progress value={Math.min(f.percentual_atingimento, 100)} className="h-2" />
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
