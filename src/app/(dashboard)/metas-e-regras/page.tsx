'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Target, Loader2, AlertCircle } from 'lucide-react'

interface RegrasDescontos {
  atestado?: { percent?: number; ate_dias?: number; acima_dias?: number }[]
  falta_injustificada_percent?: number
  advertencia_percent?: number
  ferias_percent?: number
  suspensao_percent?: number
  erro_separacao_percent?: number
  erro_entregas_percent?: number
}

export default function MetasERegrasPage() {
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [metaValor, setMetaValor] = useState<number>(300)
  const [regrasDescontos, setRegrasDescontos] = useState<RegrasDescontos | null>(null)
  const [percentuaisMetricas, setPercentuaisMetricas] = useState<{ kg_hora?: number; vol_hora?: number; plt_hora?: number } | null>(null)
  const [regrasKgHora, setRegrasKgHora] = useState<Array<{ kg_hora: number; valor: number }>>([])
  const [regrasVolHora, setRegrasVolHora] = useState<Array<{ vol_hora: number; valor: number }>>([])
  const [regrasPltHora, setRegrasPltHora] = useState<Array<{ plt_hora: number; valor: number }>>([])

  useEffect(() => {
    const supabase = createClient()
    const carregar = async () => {
      setLoading(true)
      setErro(null)
      try {
        const { data, error } = await supabase
          .from('configuracoes')
          .select('chave, valor')
          .in('chave', [
            'meta_colaborador',
            'regras_descontos',
            'percentuais_metricas',
            'regras_kg_hora',
            'regras_vol_hora',
            'regras_plt_hora',
          ])
        if (error) throw error
        const map = Object.fromEntries((data ?? []).map((r) => [r.chave, r.valor]))
        const meta = (map.meta_colaborador as { valor?: number })?.valor ?? 300
        setMetaValor(meta)
        setRegrasDescontos((map.regras_descontos as RegrasDescontos) ?? null)
        setPercentuaisMetricas((map.percentuais_metricas as { kg_hora?: number; vol_hora?: number; plt_hora?: number }) ?? null)
        setRegrasKgHora(Array.isArray(map.regras_kg_hora) ? (map.regras_kg_hora as Array<{ kg_hora: number; valor: number }>) : [])
        setRegrasVolHora(Array.isArray(map.regras_vol_hora) ? (map.regras_vol_hora as Array<{ vol_hora: number; valor: number }>) : [])
        setRegrasPltHora(Array.isArray(map.regras_plt_hora) ? (map.regras_plt_hora as Array<{ plt_hora: number; valor: number }>) : [])
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Erro ao carregar configurações')
      } finally {
        setLoading(false)
      }
    }
    carregar()
  }, [])

  const pct = (v: number | undefined) => (v != null ? Math.round(Number(v) * 100) : 0)

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
          <Target className="h-8 w-8" />
          Metas e Regras
        </h1>
        <p className="text-muted-foreground">
          Consulta das metas, indicadores e regras de cálculo de produtividade (somente visualização)
        </p>
      </div>

      {erro && (
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-2 pt-6">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-destructive">{erro}</p>
          </CardContent>
        </Card>
      )}

      {/* Sessão A — Metas & Indicadores (Produtividade) */}
      <Card>
        <CardHeader>
          <CardTitle>Metas e indicadores (produtividade)</CardTitle>
          <CardDescription>
            Peso de cada métrica no cálculo e faixas mínimas para bonificação
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Indicador</TableHead>
                <TableHead>Fórmula / regra</TableHead>
                <TableHead className="text-right">Peso / meta</TableHead>
                <TableHead>Observações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Kg/Hora</TableCell>
                <TableCell>Peso líquido ÷ tempo (h). Valor em R$ pela faixa atingida × peso.</TableCell>
                <TableCell className="text-right">{pct(percentuaisMetricas?.kg_hora)}%</TableCell>
                <TableCell>50% do bônus. Faixas: ver tabela de regras KG/Hora.</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Vol/Hora</TableCell>
                <TableCell>Volume ÷ tempo (h). Valor em R$ pela faixa × peso.</TableCell>
                <TableCell className="text-right">{pct(percentuaisMetricas?.vol_hora)}%</TableCell>
                <TableCell>30% do bônus.</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Plt/Hora</TableCell>
                <TableCell>Paletes ÷ tempo (h). Valor em R$ pela faixa × peso.</TableCell>
                <TableCell className="text-right">{pct(percentuaisMetricas?.plt_hora)}%</TableCell>
                <TableCell>20% do bônus.</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          {regrasKgHora.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">Faixas Kg/Hora</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kg/Hora mín.</TableHead>
                    <TableHead className="text-right">Valor R$</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {regrasKgHora.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{r.kg_hora}</TableCell>
                      <TableCell className="text-right">R$ {r.valor}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {regrasVolHora.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">Faixas Vol/Hora</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vol/Hora mín.</TableHead>
                    <TableHead className="text-right">Valor R$</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {regrasVolHora.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{r.vol_hora}</TableCell>
                      <TableCell className="text-right">R$ {r.valor}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {regrasPltHora.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">Faixas Plt/Hora</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plt/Hora mín.</TableHead>
                    <TableHead className="text-right">Valor R$</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {regrasPltHora.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{r.plt_hora}</TableCell>
                      <TableCell className="text-right">R$ {r.valor}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sessão B — Descontos (% por tipo) */}
      <Card>
        <CardHeader>
          <CardTitle>Descontos (% por tipo)</CardTitle>
          <CardDescription>
            Percentuais aplicados sobre a produtividade bruta conforme tipo de ocorrência
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo de desconto</TableHead>
                <TableHead className="text-right">Percentual (%)</TableHead>
                <TableHead>Como impacta no resultado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Atestado</TableCell>
                <TableCell className="text-right">Por faixa de dias (até 2, até 5, até 7, acima de 7)</TableCell>
                <TableCell>Reduz a produtividade final conforme dias de atestado.</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Falta injustificada</TableCell>
                <TableCell className="text-right">{pct(regrasDescontos?.falta_injustificada_percent)}%</TableCell>
                <TableCell>Desconto aplicado sobre a produtividade bruta.</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Advertência</TableCell>
                <TableCell className="text-right">{pct(regrasDescontos?.advertencia_percent)}% por unidade</TableCell>
                <TableCell>Percentual × quantidade de advertências.</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Férias</TableCell>
                <TableCell className="text-right">{pct(regrasDescontos?.ferias_percent)}%</TableCell>
                <TableCell>Desconto fixo quando há férias no período.</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Suspensão</TableCell>
                <TableCell className="text-right">{pct(regrasDescontos?.suspensao_percent)}% por unidade</TableCell>
                <TableCell>Percentual × quantidade de suspensões.</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Erros separação</TableCell>
                <TableCell className="text-right">{pct(regrasDescontos?.erro_separacao_percent)}% por erro</TableCell>
                <TableCell>Acumula sobre a produtividade (limite 100%).</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Erros entregas</TableCell>
                <TableCell className="text-right">{pct(regrasDescontos?.erro_entregas_percent)}% por erro</TableCell>
                <TableCell>Acumula sobre a produtividade (limite 100%).</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Sessão C — Meta total de atingimento (R$) */}
      <Card>
        <CardHeader>
          <CardTitle>Meta total de atingimento (R$)</CardTitle>
          <CardDescription>
            Valor máximo de bônus por colaborador no mês
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-green-700">R$ {metaValor.toLocaleString('pt-BR')}</span>
            <span className="text-muted-foreground">por colaborador</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            O atingimento é calculado como (Produtividade final ÷ Meta) × 100%. Acima de 100% o colaborador atinge a meta.
          </p>
        </CardContent>
      </Card>

      {/* Sessão D — Como funciona */}
      <Card>
        <CardHeader>
          <CardTitle>Como funciona o cálculo</CardTitle>
          <CardDescription>Passos objetivos usados no sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ul className="list-disc list-inside space-y-2">
            <li>
              <strong>Produtividade bruta:</strong> Para cada colaborador somam-se peso, volume e paletes no período; calculam-se Kg/Hs, Vol/Hs e Plt/Hs. Cada métrica entra nas faixas (regras) e gera um valor em R$. A produtividade bruta é a soma dos três valores ponderados pelos percentuais (50% kg, 30% vol, 20% plt).
            </li>
            <li>
              <strong>Descontos por erros:</strong> Cada erro de separação e de entrega aplica um percentual (configurável) sobre a produtividade. O total de descontos por erros é limitado a 100%.
            </li>
            <li>
              <strong>Descontos por tipo (faltas, atestado, etc.):</strong> Conforme os percentuais configurados por tipo (falta injustificada, férias, advertência, suspensão, atestado por dias), calcula-se um percentual total que é aplicado sobre a produtividade bruta.
            </li>
            <li>
              <strong>Resultado final:</strong> Produtividade bruta menos descontos por erros e menos descontos por tipo. O valor não pode ser negativo.
            </li>
            <li>
              <strong>Atingimento da meta:</strong> (Produtividade final ÷ Meta em R$) × 100%. Meta atual: R$ {metaValor.toLocaleString('pt-BR')}.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
