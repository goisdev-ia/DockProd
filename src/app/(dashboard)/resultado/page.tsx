'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Calculator, RefreshCw, TrendingUp, AlertTriangle } from 'lucide-react'
import { FilterToggle } from '@/components/FilterToggle'
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
import { registrarLog } from '@/lib/logs'
import type { Fechamento } from '@/types/database'

interface FechamentoExtendido extends Fechamento {
  colaborador_nome?: string
  colaborador_matricula?: string
  filial_nome?: string
}

export default function ResultadoPage() {
  const [fechamentos, setFechamentos] = useState<FechamentoExtendido[]>([])
  const [fechamentosFiltrados, setFechamentosFiltrados] = useState<FechamentoExtendido[]>([])
  const [loading, setLoading] = useState(true)
  const [calculando, setCalculando] = useState(false)
  const [regrasCalculo, setRegrasCalculo] = useState<RegrasCalculo | null>(null)
  
  const [mesSelecionado, setMesSelecionado] = useState('')
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear())
  
  // Filtros adicionais
  const [filtroColaborador, setFiltroColaborador] = useState('todos')
  const [filtroFilial, setFiltroFilial] = useState('todas')
  const [filtroBusca, setFiltroBusca] = useState('')
  const [filtroVlrKgHsMin, setFiltroVlrKgHsMin] = useState('')
  const [filtroVlrKgHsMax, setFiltroVlrKgHsMax] = useState('')
  const [filtroVlrVolHsMin, setFiltroVlrVolHsMin] = useState('')
  const [filtroVlrVolHsMax, setFiltroVlrVolHsMax] = useState('')
  const [filtroVlrPltHsMin, setFiltroVlrPltHsMin] = useState('')
  const [filtroVlrPltHsMax, setFiltroVlrPltHsMax] = useState('')
  const [filtroProdBrutaMin, setFiltroProdBrutaMin] = useState('')
  const [filtroProdBrutaMax, setFiltroProdBrutaMax] = useState('')
  const [filtroProdFinalMin, setFiltroProdFinalMin] = useState('')
  const [filtroProdFinalMax, setFiltroProdFinalMax] = useState('')
  const [filtroMetaMin, setFiltroMetaMin] = useState('')
  const [filtroMetaMax, setFiltroMetaMax] = useState('')
  const [filtroMatricula, setFiltroMatricula] = useState('')
  const [buscaDebounced, setBuscaDebounced] = useState('')
  const [matriculaDebounced, setMatriculaDebounced] = useState('')
  const [filtroVlrKgHsMinApplied, setFiltroVlrKgHsMinApplied] = useState('')
  const [filtroVlrKgHsMaxApplied, setFiltroVlrKgHsMaxApplied] = useState('')
  const [filtroVlrVolHsMinApplied, setFiltroVlrVolHsMinApplied] = useState('')
  const [filtroVlrVolHsMaxApplied, setFiltroVlrVolHsMaxApplied] = useState('')
  const [filtroVlrPltHsMinApplied, setFiltroVlrPltHsMinApplied] = useState('')
  const [filtroVlrPltHsMaxApplied, setFiltroVlrPltHsMaxApplied] = useState('')
  const [filtroProdBrutaMinApplied, setFiltroProdBrutaMinApplied] = useState('')
  const [filtroProdBrutaMaxApplied, setFiltroProdBrutaMaxApplied] = useState('')
  const [filtroProdFinalMinApplied, setFiltroProdFinalMinApplied] = useState('')
  const [filtroProdFinalMaxApplied, setFiltroProdFinalMaxApplied] = useState('')
  const [filtroMetaMinApplied, setFiltroMetaMinApplied] = useState('')
  const [filtroMetaMaxApplied, setFiltroMetaMaxApplied] = useState('')
  
  const [colaboradores, setColaboradores] = useState<any[]>([])
  const [filiais, setFiliais] = useState<any[]>([])
  const [usuarioLogado, setUsuarioLogado] = useState<{ tipo: string; id_filial: string | null } | null>(null)
  
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
    carregarUsuarioLogado()
  }, [])

  useEffect(() => {
    if (mesSelecionado) {
      carregarRegrasCalculo()
      carregarFechamentos()
      carregarColaboradores()
      carregarFiliais()
    }
  }, [mesSelecionado, anoSelecionado])

  const carregarUsuarioLogado = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      const { data: usuario } = await supabase
        .from('usuarios')
        .select('tipo, id_filial')
        .eq('id', user.id)
        .single()
      
      if (usuario) {
        setUsuarioLogado(usuario)
        
        // Se for colaborador, fixar a filial
        if (usuario.tipo === 'colaborador' && usuario.id_filial) {
          setFiltroFilial(usuario.id_filial)
        }
      }
    }
  }

  // Debounce para inputs de texto
  useEffect(() => {
    const timer = setTimeout(() => setBuscaDebounced(filtroBusca), 300)
    return () => clearTimeout(timer)
  }, [filtroBusca])

  useEffect(() => {
    const timer = setTimeout(() => setMatriculaDebounced(filtroMatricula), 300)
    return () => clearTimeout(timer)
  }, [filtroMatricula])

  useEffect(() => {
    const t = setTimeout(() => {
      setFiltroVlrKgHsMinApplied(filtroVlrKgHsMin)
      setFiltroVlrKgHsMaxApplied(filtroVlrKgHsMax)
      setFiltroVlrVolHsMinApplied(filtroVlrVolHsMin)
      setFiltroVlrVolHsMaxApplied(filtroVlrVolHsMax)
      setFiltroVlrPltHsMinApplied(filtroVlrPltHsMin)
      setFiltroVlrPltHsMaxApplied(filtroVlrPltHsMax)
      setFiltroProdBrutaMinApplied(filtroProdBrutaMin)
      setFiltroProdBrutaMaxApplied(filtroProdBrutaMax)
      setFiltroProdFinalMinApplied(filtroProdFinalMin)
      setFiltroProdFinalMaxApplied(filtroProdFinalMax)
      setFiltroMetaMinApplied(filtroMetaMin)
      setFiltroMetaMaxApplied(filtroMetaMax)
    }, 400)
    return () => clearTimeout(t)
  }, [filtroVlrKgHsMin, filtroVlrKgHsMax, filtroVlrVolHsMin, filtroVlrVolHsMax, filtroVlrPltHsMin, filtroVlrPltHsMax, filtroProdBrutaMin, filtroProdBrutaMax, filtroProdFinalMin, filtroProdFinalMax, filtroMetaMin, filtroMetaMax])

  // Aplicar filtros quando mudarem (usa valores aplicados/debounced nos numéricos)
  const aplicarFiltros = useCallback(() => {
    let filtrados = [...fechamentos]

    if (filtroColaborador && filtroColaborador !== 'todos') {
      filtrados = filtrados.filter(f => f.id_colaborador === filtroColaborador)
    }

    if (filtroFilial && filtroFilial !== 'todas') {
      filtrados = filtrados.filter(f => f.id_filial === filtroFilial)
    }

    if (buscaDebounced) {
      const busca = buscaDebounced.toLowerCase()
      filtrados = filtrados.filter(f =>
        f.colaborador_nome?.toLowerCase().includes(busca) ||
        f.filial_nome?.toLowerCase().includes(busca)
      )
    }

    if (filtroVlrKgHsMinApplied !== '') {
      const min = Number(filtroVlrKgHsMinApplied)
      filtrados = filtrados.filter(f => f.valor_kg_hs >= min)
    }

    if (filtroVlrKgHsMaxApplied !== '') {
      const max = Number(filtroVlrKgHsMaxApplied)
      filtrados = filtrados.filter(f => f.valor_kg_hs <= max)
    }

    if (filtroVlrVolHsMinApplied !== '') {
      const min = Number(filtroVlrVolHsMinApplied)
      filtrados = filtrados.filter(f => f.valor_vol_hs >= min)
    }

    if (filtroVlrVolHsMaxApplied !== '') {
      const max = Number(filtroVlrVolHsMaxApplied)
      filtrados = filtrados.filter(f => f.valor_vol_hs <= max)
    }

    if (filtroVlrPltHsMinApplied !== '') {
      const min = Number(filtroVlrPltHsMinApplied)
      filtrados = filtrados.filter(f => f.valor_plt_hs >= min)
    }

    if (filtroVlrPltHsMaxApplied !== '') {
      const max = Number(filtroVlrPltHsMaxApplied)
      filtrados = filtrados.filter(f => f.valor_plt_hs <= max)
    }

    if (filtroProdBrutaMinApplied !== '') {
      const min = Number(filtroProdBrutaMinApplied)
      filtrados = filtrados.filter(f => f.produtividade_bruta >= min)
    }

    if (filtroProdBrutaMaxApplied !== '') {
      const max = Number(filtroProdBrutaMaxApplied)
      filtrados = filtrados.filter(f => f.produtividade_bruta <= max)
    }

    if (filtroProdFinalMinApplied !== '') {
      const min = Number(filtroProdFinalMinApplied)
      filtrados = filtrados.filter(f => f.produtividade_final >= min)
    }

    if (filtroProdFinalMaxApplied !== '') {
      const max = Number(filtroProdFinalMaxApplied)
      filtrados = filtrados.filter(f => f.produtividade_final <= max)
    }

    if (filtroMetaMinApplied !== '') {
      const min = Number(filtroMetaMinApplied)
      filtrados = filtrados.filter(f => f.percentual_atingimento >= min)
    }

    if (filtroMetaMaxApplied !== '') {
      const max = Number(filtroMetaMaxApplied)
      filtrados = filtrados.filter(f => f.percentual_atingimento <= max)
    }

    if (matriculaDebounced) {
      const matricula = matriculaDebounced.toLowerCase()
      filtrados = filtrados.filter(f =>
        f.colaborador_matricula?.toLowerCase().includes(matricula)
      )
    }

    setFechamentosFiltrados(filtrados)
  }, [fechamentos, filtroColaborador, filtroFilial, buscaDebounced, matriculaDebounced, filtroVlrKgHsMinApplied, filtroVlrKgHsMaxApplied, filtroVlrVolHsMinApplied, filtroVlrVolHsMaxApplied, filtroVlrPltHsMinApplied, filtroVlrPltHsMaxApplied, filtroProdBrutaMinApplied, filtroProdBrutaMaxApplied, filtroProdFinalMinApplied, filtroProdFinalMaxApplied, filtroMetaMinApplied, filtroMetaMaxApplied])

  useEffect(() => {
    aplicarFiltros()
  }, [aplicarFiltros])

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

  const carregarColaboradores = async () => {
    const { data } = await supabase
      .from('colaboradores')
      .select('*')
      .eq('ativo', true)
      .order('nome')
    
    if (data) setColaboradores(data)
  }

  const carregarFiliais = async () => {
    const { data } = await supabase
      .from('filiais')
      .select('*')
      .eq('ativo', true)
    
    if (data) setFiliais(data)
  }

  const limparFiltros = () => {
    setFiltroColaborador('todos')
    setFiltroFilial('todas')
    setFiltroBusca('')
    setFiltroVlrKgHsMin('')
    setFiltroVlrKgHsMax('')
    setFiltroVlrVolHsMin('')
    setFiltroVlrVolHsMax('')
    setFiltroVlrPltHsMin('')
    setFiltroVlrPltHsMax('')
    setFiltroProdBrutaMin('')
    setFiltroProdBrutaMax('')
    setFiltroProdFinalMin('')
    setFiltroProdFinalMax('')
    setFiltroMetaMin('')
    setFiltroMetaMax('')
    setFiltroMatricula('')
    setFiltroVlrKgHsMinApplied('')
    setFiltroVlrKgHsMaxApplied('')
    setFiltroVlrVolHsMinApplied('')
    setFiltroVlrVolHsMaxApplied('')
    setFiltroVlrPltHsMinApplied('')
    setFiltroVlrPltHsMaxApplied('')
    setFiltroProdBrutaMinApplied('')
    setFiltroProdBrutaMaxApplied('')
    setFiltroProdFinalMinApplied('')
    setFiltroProdFinalMaxApplied('')
    setFiltroMetaMinApplied('')
    setFiltroMetaMaxApplied('')
  }

  const contarFiltrosAtivos = () => {
    let count = 0
    if (filtroColaborador !== 'todos') count++
    if (filtroFilial !== 'todas') count++
    if (filtroBusca) count++
    if (filtroVlrKgHsMin) count++
    if (filtroVlrKgHsMax) count++
    if (filtroVlrVolHsMin) count++
    if (filtroVlrVolHsMax) count++
    if (filtroVlrPltHsMin) count++
    if (filtroVlrPltHsMax) count++
    if (filtroProdBrutaMin) count++
    if (filtroProdBrutaMax) count++
    if (filtroProdFinalMin) count++
    if (filtroProdFinalMax) count++
    if (filtroMetaMin) count++
    if (filtroMetaMax) count++
    if (filtroMatricula) count++
    return count
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

        // Totalizar dados (agregar erros por id_carga_cliente para evitar duplicação)
        const pesoLiquidoTotal = dadosProducao.reduce((sum, d) => sum + (d.peso_liquido || 0), 0)
        const volumeTotal = dadosProducao.reduce((sum, d) => sum + (d.qtd_venda || 0), 0)
        const paletesTotal = dadosProducao.reduce((sum, d) => sum + (d.paletes || 0), 0)
        const tempoTotal = dadosProducao.reduce((sum, d) => sum + (d.tempo || 0), 0)
        const errosPorCarga = new Map<string, { sep: number; ent: number }>()
        for (const d of dadosProducao) {
          const key = String(d.id_carga_cliente ?? '')
          const cur = errosPorCarga.get(key) ?? { sep: 0, ent: 0 }
          errosPorCarga.set(key, {
            sep: Math.max(cur.sep, Number(d.erro_separacao ?? 0)),
            ent: Math.max(cur.ent, Number(d.erro_entregas ?? 0))
          })
        }
        const erroSeparacaoTotal = [...errosPorCarga.values()].reduce((s, c) => s + c.sep, 0)
        const erroEntregasTotal = [...errosPorCarga.values()].reduce((s, c) => s + c.ent, 0)

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

      if (fechamentosGravados > 0) {
        registrarLog(supabase, 'Calculou fechamento mensal')
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
      <FilterToggle
        filtrosAtivos={contarFiltrosAtivos()}
        onLimparFiltros={limparFiltros}
      >
          <div className="space-y-4">
            {/* Linha 1 - Período */}
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

            {/* Linha 2 - Colaborador/Filial/Busca */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Colaborador</Label>
                <Select value={filtroColaborador} onValueChange={setFiltroColaborador}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {colaboradores.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Filial</Label>
                <Select 
                  value={filtroFilial} 
                  onValueChange={setFiltroFilial}
                  disabled={usuarioLogado?.tipo === 'colaborador'}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    {usuarioLogado?.tipo === 'admin' && (
                      <SelectItem value="todas">Todas</SelectItem>
                    )}
                    {filiais.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {usuarioLogado?.tipo === 'colaborador' && (
                  <p className="text-xs text-muted-foreground">
                    Fixado para sua filial
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Busca</Label>
                <Input
                  placeholder="Buscar colaborador, filial..."
                  value={filtroBusca}
                  onChange={(e) => setFiltroBusca(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Matrícula</Label>
                <Input
                  placeholder="Filtrar por matrícula..."
                  value={filtroMatricula}
                  onChange={(e) => setFiltroMatricula(e.target.value)}
                />
              </div>
            </div>

            {/* Linha 3 - Valores */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Vlr Kg/Hs (R$)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filtroVlrKgHsMin}
                    onChange={(e) => setFiltroVlrKgHsMin(e.target.value)}
                    step="0.01"
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filtroVlrKgHsMax}
                    onChange={(e) => setFiltroVlrKgHsMax(e.target.value)}
                    step="0.01"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Vlr Vol/Hs (R$)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filtroVlrVolHsMin}
                    onChange={(e) => setFiltroVlrVolHsMin(e.target.value)}
                    step="0.01"
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filtroVlrVolHsMax}
                    onChange={(e) => setFiltroVlrVolHsMax(e.target.value)}
                    step="0.01"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Vlr Plt/Hs (R$)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filtroVlrPltHsMin}
                    onChange={(e) => setFiltroVlrPltHsMin(e.target.value)}
                    step="0.01"
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filtroVlrPltHsMax}
                    onChange={(e) => setFiltroVlrPltHsMax(e.target.value)}
                    step="0.01"
                  />
                </div>
              </div>
            </div>

            {/* Linha 4 - Produtividade e Meta */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Prod. Bruta (R$)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filtroProdBrutaMin}
                    onChange={(e) => setFiltroProdBrutaMin(e.target.value)}
                    step="0.01"
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filtroProdBrutaMax}
                    onChange={(e) => setFiltroProdBrutaMax(e.target.value)}
                    step="0.01"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Prod. Final (R$)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filtroProdFinalMin}
                    onChange={(e) => setFiltroProdFinalMin(e.target.value)}
                    step="0.01"
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filtroProdFinalMax}
                    onChange={(e) => setFiltroProdFinalMax(e.target.value)}
                    step="0.01"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Meta (%)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filtroMetaMin}
                    onChange={(e) => setFiltroMetaMin(e.target.value)}
                    step="1"
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filtroMetaMax}
                    onChange={(e) => setFiltroMetaMax(e.target.value)}
                    step="1"
                  />
                </div>
              </div>
            </div>
          </div>
      </FilterToggle>

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
                  fechamentosFiltrados.map((f) => (
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
                ) : fechamentosFiltrados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      Nenhum resultado disponível
                    </TableCell>
                  </TableRow>
                ) : (
                  fechamentosFiltrados.map((f) => {
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
