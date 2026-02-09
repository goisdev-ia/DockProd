export type TipoUsuario = 'novo' | 'colaborador' | 'admin' | 'gestor'

export interface Filial {
  id: string
  codigo: string
  nome: string
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface Colaborador {
  id: string
  matricula: string
  nome: string
  id_filial: string
  funcao: string
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface Usuario {
  id: string
  nome: string
  email: string
  senha: string
  id_filial: string | null
  tipo: TipoUsuario
  ativo: boolean
  avatar_url?: string | null
  created_at: string
  updated_at: string
}

export interface DadosProdutividade {
  id: string
  id_carga_cliente: string
  id_filial: string
  id_colaborador: string | null
  filial: string
  ordem_frete: string | null
  data_frete: string | null
  carga: string
  seq_carga: string | null
  data_carga: string
  nota_fiscal: string
  item_nf: string | null
  qtd_venda: number | null
  familia: string | null
  codigo_produto: string | null
  produto: string | null
  valor_frete: number | null
  peso_bruto: number | null
  peso_liquido: number | null
  percentual: number | null
  grupo_veiculo: string | null
  codigo_veiculo: string | null
  rota: string | null
  rede: string | null
  cliente: string
  cidade_cliente: string | null
  uf: string | null
  cod_cliente: string | null
  colaborador: string | null
  hora_inicial: string | null
  hora_final: string | null
  tempo: number | null
  kg_hs: number | null
  vol_hs: number | null
  plt_hs: number | null
  erro_separacao: number
  erro_entregas: number
  observacao: string | null
  paletes: number | null
  mes: string | null
  created_at: string
  updated_at: string
}

export interface Desconto {
  id: string
  id_colaborador: string
  id_filial: string
  mes: string
  ano: number
  falta_injustificada: number
  ferias: boolean
  advertencia: number
  suspensao: number
  atestado_dias: number
  percentual_total: number
  observacao: string | null
  created_at: string
  updated_at: string
}

export interface Fechamento {
  id: string
  id_colaborador: string
  id_filial: string
  id_desconto: string | null
  mes: string
  ano: number
  peso_liquido_total: number
  volume_total: number
  paletes_total: number
  tempo_total: number
  kg_hs: number
  vol_hs: number
  plt_hs: number
  erro_separacao_total: number
  erro_entregas_total: number
  percentual_erros: number
  valor_kg_hs: number
  valor_vol_hs: number
  valor_plt_hs: number
  produtividade_bruta: number
  percentual_descontos: number
  valor_descontos: number
  produtividade_final: number
  meta: number
  percentual_atingimento: number
  created_at: string
  updated_at: string
}

export interface Configuracao {
  id: string
  chave: string
  valor: unknown
  descricao: string | null
  created_at: string
  updated_at: string
}

export interface RegraKgHora {
  kg_hora: number
  valor: number
}

export interface RegraVolHora {
  vol_hora: number
  valor: number
}

export interface RegraPltHora {
  plt_hora: number
  valor: number
}

export interface RegrasDescontos {
  erro_separacao_percent: number
  erro_entregas_percent: number
  ferias_percent: number
  falta_injustificada_percent: number
  advertencia_percent: number
  suspensao_percent: number
  atestado: Array<{
    ate_dias?: number
    acima_dias?: number
    percent: number
  }>
}
