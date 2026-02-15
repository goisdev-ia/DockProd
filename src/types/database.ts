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
  id_filial: string | null
  filial: string | null
  funcao: string | null
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

/** DockProd: recebimento de doca */
export interface Recebimento {
  id: string
  id_filial: string | null
  filial: string | null
  fornecedor: string | null
  motorista: string | null
  coleta: string | null
  item: string | null
  seq: string | null
  cd_prod: string | null
  produto: string | null
  nota_fiscal: string | null
  dta_receb: string | null
  usuario_recebto: string | null
  und: number | null
  qtd_recebida: number | null
  qtd_caixas_recebidas: number | null
  peso_liquido_recebido: number | null
  id_coleta_recebimento: string | null
  observacao: string | null
  created_at: string
  updated_at: string
}

/** DockProd: tempo por coleta */
export interface Tempo {
  id: string
  id_filial: string | null
  empresa: string | null
  filial: string | null
  ordem_coleta: string | null
  inicio_recebimento: string | null
  final_recebimento: string | null
  tempo_recebimento: string | null
  id_coleta_recebimento: string | null
  created_at: string
  updated_at: string
}

/** DockProd: resultado por colaborador (bônus calculado por filial + descontos) */
export interface Resultado {
  id: string
  id_colaborador: string | null
  id_filial: string | null
  filial: string | null
  mes: string | null
  funcao: string | null
  acuracidade: number | null
  checklist: number | null
  plt_hs: number | null
  perda: number | null
  bonus: number | null
  falta_inj: number
  advert: number
  suspensao_ferias: number
  atestado: number
  desconto: number
  filtro: number
  bonus_final: number | null
  created_at: string
  updated_at: string
}

/** PickProd (legacy): dados de produtividade por carga */
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
  id_colaborador: string | null
  id_filial: string | null
  colaborador: string | null
  data_desconto: string | null
  mes_desconto: string | null
  falta_injustificada: number
  ferias: number
  advertencia: number
  suspensao: number
  atestado: number
  percentual_total: number | null
  valor_desconto_total: number | null
  observacao: string | null
  created_at: string
  updated_at: string
}

/** DockProd: fechamento mensal por colaborador (campos digitacionais: acuracidade, checklist, perda) */
export interface Fechamento {
  id: string
  id_colaborador: string | null
  id_filial: string | null
  id_desconto: string | null
  mes: string | null
  ano: number | null
  peso_liquido_total: number
  volume_total: number
  paletes_total: number
  tempo_total: number
  kg_hs: number | null
  vol_hs: number | null
  plt_hs: number | null
  acuracidade: number | null
  checklist: number | null
  perda: number | null
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
