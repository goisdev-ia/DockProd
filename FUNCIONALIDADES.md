# Documentação das Funcionalidades - PickProd

Este documento descreve as principais funcionalidades da aplicação PickProd, um sistema de gestão de produtividade para operações de logística e separação.

## 1. Dashboard (Visão Geral)
O Dashboard é a tela principal onde os gestores podem visualizar o desempenho da operação em tempo real ou por períodos específicos.

- **Indicadores de Desempenho (KPIs):**
  - **Total R$ Produtividade:** Soma total de bônus calculados para os colaboradores.
  - **% Atingimento:** Percentual da meta atingida em relação ao realizado.
  - **Total de Cargas:** Quantidade total de cargas processadas.
  - **Total de Pedidos:** Quantidade total de notas fiscais separadas.
  - **Tonelagem (KG):** Peso total separado.
  - **Volume:** Quantidade total de itens/caixas.
  - **Paletes:** Estimativa de paletes baseada no peso líquido (Peso / 550kg).
  - **Tempo Médio:** Tempo médio de separação por carga.

- **Gráficos e Análises:**
  - **Evolução Temporal:** Gráfico de área mostrando a produtividade ao longo do tempo.
  - **Performance por Colaborador/Filial:** Gráficos de barras e radar comparando resultados financeiros e volumes.
  - **Top Clientes:** Identificação dos clientes com maior volume de peso.
  - **Rankings (Top 3):** Tabelas rápidas com os melhores desempenhos em diversas métricas (cargas, pedidos, tonelagem, etc.).

---

## 2. Upload de Dados
Funcionalidade para importação massiva de dados provenientes de sistemas externos (BI/ERP).

- **Processamento de Excel:** Suporte para arquivos `.xlsx` com detecção automática de colunas (Filial, Carga, Data, Peso, Cliente, etc.).
- **Validação Automática:** O sistema verifica se as filiais existem no cadastro e se os campos obrigatórios estão presentes.
- **Preview de Dados:** Permite visualizar os registros extraídos do arquivo antes de confirmar a gravação no banco de dados.
- **Prevenção de Duplicidade:** O sistema evita a inserção de registros com a mesma chave de identificação (Carga-Cliente).

---

## 3. Gestão de Produtividade
Tela para o controle operacional detalhado de cada carga.

- **Atribuição de Colaboradores:** Permite vincular um colaborador específico a uma carga ou nota fiscal.
- **Controle de Tempo:** Registro de hora inicial e final para cálculo automático do tempo de separação e métricas de eficiência (Kg/h, Vol/h, Plt/h).
- **Registro de Erros:** Campo para informar erros de separação ou entregas, que podem impactar nos cálculos de bônus.
- **Observações:** Campo de texto livre para anotações operacionais importantes.
- **Edição e Exclusão:** Gestão completa dos registros importados.

---

## 4. Gestão de Descontos
Módulo para gerenciar ocorrências que impactam no bônus de produtividade mensal.

- **Regras de Cálculo Automático:**
  - **Faltas Injustificadas:** Aplica 100% de desconto no bônus do mês.
  - **Férias:** Aplica 100% de desconto (proporcional ao período).
  - **Advertências:** Cada advertência aplica 50% de desconto.
  - **Suspensões:** Cada suspensão aplica 100% de desconto.
  - **Atestados:** Escala progressiva de desconto (Até 2d: 25%, 3-5d: 50%, 6-7d: 70%, +7d: 100%).
- **Histórico Mensal:** Registro por colaborador, mês e ano para auditoria e fechamento.

---

## 5. Cadastros (Configurações)
Gestão das entidades base do sistema.

- **Colaboradores:**
  - Cadastro de matrícula, nome, função (Separador, Conferente, Supervisor, Líder) e filial.
  - Controle de status (Ativo/Inativo).
  - Importação e exportação via Excel.
- **Filiais:**
  - Cadastro de código e nome das unidades operacionais.
  - Controle de ativação de filiais.

---

## 6. Relatórios e Resultados (Em desenvolvimento)
Módulos destinados à exportação de dados consolidados para pagamento e análise de performance histórica.
