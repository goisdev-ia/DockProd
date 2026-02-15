'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Target, Loader2, AlertCircle, MapPin } from 'lucide-react'
import { META_PLT_HS_POR_FILIAL } from '@/lib/calculos'

interface RegrasDescontos {
  atestado?: { percent?: number; ate_dias?: number; acima_dias?: number }[]
  falta_injustificada_percent?: number
  advertencia_percent?: number
  ferias_percent?: number
  suspensao_percent?: number
  erro_separacao_percent?: number
  erro_entregas_percent?: number
}

interface FilialRow {
  id: string
  codigo: string
  nome: string
}

const META_ACURACIDADE = 95
const META_CHECKLIST = 90
const VALOR_ACURACIDADE = 100
const VALOR_CHECKLIST = 50
const VALOR_PLT_HS = 100
const VALOR_PERDA = 100
const META_PERDA = 1.7
const BONUS_MAXIMO = 250

const FUNCOES_ACURACIDADE_CHECKLIST = 'Aux. Exp/Receb, Conferente, Empilhador, Aux. de Estoque'
const FUNCOES_PLT_HS = 'Aux. Exp/Receb, Conferente, Empilhador'
const FUNCOES_PERDA = 'Somente Aux. de Estoque'

export default function MetasERegrasPage() {
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [regrasDescontos, setRegrasDescontos] = useState<RegrasDescontos | null>(null)
  const [filiais, setFiliais] = useState<FilialRow[]>([])

  useEffect(() => {
    const supabase = createClient()
    const carregar = async () => {
      setLoading(true)
      setErro(null)
      try {
        const [configRes, filiaisRes] = await Promise.all([
          supabase.from('configuracoes').select('chave, valor').eq('chave', 'regras_descontos'),
          supabase.from('filiais').select('id, codigo, nome').eq('ativo', true).order('codigo'),
        ])
        if (configRes.error) throw configRes.error
        if (filiaisRes.error) throw filiaisRes.error

        const configMap = Object.fromEntries((configRes.data ?? []).map((r) => [r.chave, r.valor]))
        setRegrasDescontos((configMap.regras_descontos as RegrasDescontos) ?? null)
        setFiliais((filiaisRes.data ?? []) as FilialRow[])
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Erro ao carregar configurações')
      } finally {
        setLoading(false)
      }
    }
    carregar()
  }, [])

  const pct = (v: number | undefined) => (v != null ? Math.round(Number(v) * 100) : 0)

  const getMetaPltHs = (codigo: string) => META_PLT_HS_POR_FILIAL[codigo] ?? 23

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

      {/* Sessão 1 — Metas e Indicadores (Produtividade) — por filial */}
      <Card>
        <CardHeader>
          <CardTitle>Metas e Indicadores (Produtividade)</CardTitle>
          <CardDescription>
            Metas mínimas para atingir, valor do bônus e funções elegíveis por indicador
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {filiais.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma filial cadastrada.</p>
          ) : (
            filiais.map((filial) => (
              <Card key={filial.id} className="border">
                <CardHeader className="py-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Filial {filial.codigo} – {filial.nome}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Indicador</TableHead>
                        <TableHead>Meta mínima para atingir</TableHead>
                        <TableHead className="text-right">Valor do bônus</TableHead>
                        <TableHead>Funções elegíveis</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">Acuracidade de Estoque</TableCell>
                        <TableCell>≥ {META_ACURACIDADE}% → Atinge meta</TableCell>
                        <TableCell className="text-right">R$ {VALOR_ACURACIDADE.toFixed(2).replace('.', ',')}</TableCell>
                        <TableCell>{FUNCOES_ACURACIDADE_CHECKLIST}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Checklist</TableCell>
                        <TableCell>≥ {META_CHECKLIST}% → Atinge meta</TableCell>
                        <TableCell className="text-right">R$ {VALOR_CHECKLIST.toFixed(2).replace('.', ',')}</TableCell>
                        <TableCell>{FUNCOES_ACURACIDADE_CHECKLIST}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Palete por Hora</TableCell>
                        <TableCell>{getMetaPltHs(filial.codigo)} paletes/hora → Atinge meta</TableCell>
                        <TableCell className="text-right">R$ {VALOR_PLT_HS.toFixed(2).replace('.', ',')}</TableCell>
                        <TableCell>{FUNCOES_PLT_HS}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Perda</TableCell>
                        <TableCell>≤ {META_PERDA.toFixed(2).replace('.', ',')}% → Atinge meta</TableCell>
                        <TableCell className="text-right">R$ {VALOR_PERDA.toFixed(2).replace('.', ',')}</TableCell>
                        <TableCell>{FUNCOES_PERDA}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                  <p className="text-sm font-medium mt-4 text-muted-foreground">
                    Bônus máximo por colaborador: R$ {BONUS_MAXIMO.toFixed(2).replace('.', ',')}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </CardContent>
      </Card>

      {/* Sessão 2 — Como funciona o cálculo */}
      <Card>
        <CardHeader>
          <CardTitle>Como funciona o cálculo</CardTitle>
          <CardDescription>Explicação didática do modelo de bonificação</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ul className="list-disc list-inside space-y-2">
            <li>
              <strong>Como cada indicador é avaliado:</strong> Cada indicador tem uma meta mínima. Se o colaborador atingir ou superar a meta no mês, ele recebe o valor em R$ correspondente.
            </li>
            <li>
              <strong>Bônus somatório:</strong> O bônus bruto é a soma dos valores de todas as metas atingidas (Acuracidade + Checklist + Palete/Hora ou Perda, conforme a função).
            </li>
            <li>
              <strong>Limite de R$ 250:</strong> O valor final de bônus por colaborador não pode ultrapassar R$ 250,00, mesmo que a soma das metas seja maior.
            </li>
            <li>
              <strong>Metas não atingidas:</strong> Cada meta só gera bônus se o percentual ou valor mínimo for atingido. Abaixo da meta, o valor daquele indicador é R$ 0,00.
            </li>
            <li>
              <strong>Avaliação mensal:</strong> As metas são avaliadas mensalmente com base nos dados de produtividade, acuracidade, checklist e perda do período.
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Sessão 3 — Descontos (% por tipo) */}
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

      {/* Sessão 4 — Meta total de atingimento (R$) */}
      <Card>
        <CardHeader>
          <CardTitle>Meta total de atingimento (R$)</CardTitle>
          <CardDescription>
            Valor máximo de bônus por colaborador no mês
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-green-700">R$ 250,00</span>
            <span className="text-muted-foreground">por colaborador</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            O atingimento é calculado como (Produtividade final ÷ Meta) × 100%. Acima de 100% o colaborador atinge a meta.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
