# PickProd — Sistema de Gestão de Produtividade de Separação

**Slogan:** *Cada pedido conta*

Sistema web para controle de produtividade de colaboradores em operações de separação de pedidos, cálculo de bônus por desempenho (Kg/h, Vol/h, Plt/h), aplicação de descontos (erros, faltas, advertências, atestados) e fechamento mensal com relatórios em PDF, HTML, planilha e compartilhamento via WhatsApp.

---

## Índice

- [Objetivos e escopo](#objetivos-e-escopo)
- [Stack e requisitos](#stack-e-requisitos)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Fluxo geral e telas](#fluxo-geral-e-telas)
- [Autenticação e permissões](#autenticação-e-permissões)
- [Funcionalidades por módulo](#funcionalidades-por-módulo)
- [Modelo de dados e regras de cálculo](#modelo-de-dados-e-regras-de-cálculo)
- [PWA e deploy](#pwa-e-deploy)
- [Configuração e uso](#configuração-e-uso)

---

## Objetivos e escopo

- **Objetivo:** Medir e remunerar a produtividade de separadores por métricas objetivas (peso/hora, volume/hora, paletes/hora), com descontos por erros e por eventos (faltas, férias, advertências, suspensões, atestados), e gerar fechamento mensal e relatórios.
- **Público:** Operações logísticas (CDs) com múltiplas filiais e colaboradores; usuários admin (gestão total) e colaborador (visão restrita à própria filial quando configurado).
- **Entregas:** Dashboard com KPIs e gráficos, upload de dados de carga (Excel), gestão de produtividade por carga, cadastro de descontos, tela de resultado/fechamento com cálculo de bônus e meta, relatórios (PDF, HTML, XLSX, CSV, WhatsApp) e PWA instalável.

---

## Stack e requisitos

| Item | Tecnologia |
|------|------------|
| Framework | Next.js 16 (App Router) |
| Linguagem | TypeScript |
| UI | Tailwind CSS v4, Shadcn UI (Radix), Lucide Icons |
| Backend / DB | Supabase (PostgreSQL + Auth) |
| Planilhas | XLSX (leitura upload), ExcelJS (export XLSX) |
| PDF | jsPDF + jspdf-autotable |
| Gráficos | Recharts |
| Formulários | React Hook Form, Zod |
| Deploy | Vercel (ou qualquer host Node) |

- **Node.js** 18+  
- **npm** ou **pnpm**

---

## Estrutura do projeto

```
produtividade/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root: metadata PWA, theme, Toaster
│   │   ├── page.tsx                # Redirect → /login
│   │   ├── login/page.tsx          # Login (email/senha + Supabase Auth)
│   │   ├── cadastro/page.tsx       # Cadastro de novo usuário
│   │   ├── temporaria/page.tsx     # Tela para usuário tipo "novo" (aguardando aprovação)
│   │   ├── global-error.tsx        # Página de erro global
│   │   └── (dashboard)/             # Rotas protegidas (sidebar)
│   │       ├── layout.tsx          # Layout: Sidebar
│   │       ├── dashboard/page.tsx   # Dashboard (KPIs + gráficos)
│   │       ├── upload/page.tsx     # Upload Excel → dados_produtividade
│   │       ├── produtividade/page.tsx  # Tabela cargas: colaborador, horários, erros
│   │       ├── descontos/page.tsx  # CRUD descontos por colaborador/mês
│   │       ├── resultado/page.tsx # Fechamento: calcular + tabela resultado
│   │       ├── relatorios/page.tsx # Relatórios PDF/HTML/XLSX/CSV/WhatsApp
│   │       ├── cadastros/page.tsx  # Colaboradores + Filiais
│   │       └── configuracoes/page.tsx # Usuários, regras de bônus, meta (admin)
│   ├── components/
│   │   ├── layout/sidebar.tsx      # Navegação, usuário, tema claro/escuro
│   │   ├── pwa-register.tsx        # Registro do Service Worker (produção)
│   │   ├── FilterToggle.tsx        # Filtros colapsáveis
│   │   ├── ui/                     # Shadcn (Button, Card, Table, Dialog, etc.)
│   │   └── confirm-dialog.tsx      # Modal confirmação Sim/Não
│   ├── lib/
│   │   ├── supabase/               # client, server, middleware (session)
│   │   ├── calculos.ts             # Produtividade bruta, erros, final, meta
│   │   ├── relatorios.ts           # fetchReportData, exportCSV, FechamentoLinha
│   │   ├── dashboard-filters.ts    # Períodos, datas, RPC params
│   │   ├── relatorios/
│   │   │   ├── pdfGenerator.ts     # Relatório PDF
│   │   │   ├── htmlGenerator.ts    # Relatório HTML
│   │   │   ├── xlsxGenerator.ts    # Relatório XLSX
│   │   │   └── whatsappGenerator.ts # Mensagem WhatsApp + copiar
│   │   └── utils.ts                # cn, etc.
│   └── types/
│       └── database.ts             # Filial, Colaborador, Usuario, DadosProdutividade, Desconto, Fechamento, Configuracao, Regras
├── public/
│   ├── manifest.webmanifest        # PWA: nome, ícones, theme_color, display
│   ├── sw.js                       # Service Worker (cache estático)
│   ├── backgroundpickprod2.png     # Background da identidade visual
│   ├── pickprodlogo.png
│   └── AppImages/                  # Ícones PWA (android/, ios/, windows11/)
├── dados/                          # Referências (AppImages, documentos)
├── middleware.ts                   # Proteção de rotas + sessão Supabase
├── .env.example
├── vercel.json
└── package.json
```

---

## Fluxo geral e telas

1. **Acesso**  
   Raiz (`/`) redireciona para `/login`.

2. **Login** (`/login`)  
   Email e senha validados na tabela `usuarios` e no Supabase Auth; usuário inativo é deslogado; tipo `novo` vai para `/temporaria`; demais vão para `/dashboard`.

3. **Cadastro** (`/cadastro`)  
   Criação de usuário (email/senha) e registro no Auth; usuário criado com tipo `novo` até admin alterar em Configurações.

4. **Temporária** (`/temporaria`)  
   Apenas para tipo `novo`: mensagem de aguardar liberação; admin em Configurações altera tipo para `colaborador` ou `admin` e opcionalmente vincula filial.

5. **Dashboard** (`/dashboard`)  
   KPIs (produtividade total, % meta, cargas, pedidos, kg, volume, paletes, tempo médio), filtros por período/filial/colaborador/cliente, gráficos (evolução temporal, produtividade por colaborador/filial, top clientes, descontos, top 3 erros).

6. **Upload** (`/upload`)  
   Envio de planilha Excel com colunas obrigatórias (Filial, Carga, Data Carga, Peso Líquido, Cliente, etc.); preview e validação; inserção em `dados_produtividade` com id único por carga.

7. **Produtividade** (`/produtividade`)  
   Listagem de cargas (paginada, 50 por página), filtros (filial, colaborador, datas, cliente, erros, Kg/Vol/Plt/h); edição inline: colaborador, hora inicial/final, erros separação/entregas, observação; cálculo automático de tempo, Kg/hs, Vol/hs, Plt/hs.

8. **Descontos** (`/descontos`)  
   Cadastro por colaborador/mês/ano: falta injustificada, férias, advertência, suspensão, atestado (dias); percentual total calculado conforme regras; observação opcional; listagem com filtros e paginação (100 por página).

9. **Resultado** (`/resultado`)  
   Seleção de mês/ano; botão “Calcular Fechamento”: agrupa `dados_produtividade` por colaborador/filial/mês, busca descontos, aplica regras de bônus (Kg/Vol/Plt) e descontos (erros + outros), persiste em `fechamento`; tabela com produtividade bruta, % erros, % descontos, produtividade final, meta, % atingimento e cores (gradiente por desempenho).

10. **Relatórios** (`/relatorios`)  
    Filtros: mês/ano, tipo (completo, produtividade, descontos, resultado), filial, colaborador, busca; exportação: **PDF**, **HTML** (nova aba), **XLSX**, **CSV**; **WhatsApp**: seleção de colaborador, preview da mensagem (resumo com erros detalhados, descontos, atingimento da meta, matrícula real), envio por link ou cópia para colar.

11. **Cadastros** (`/cadastros`)  
    CRUD colaboradores (matrícula, nome, filial, função, ativo) e filiais (código, nome, ativo); importação/exportação Excel de colaboradores.

12. **Configurações** (`/configuracoes`) — **Admin**  
    Gestão de usuários (nome, email, tipo, filial, ativo, senha); configuração de **regras de bônus** (faixas Kg/h, Vol/h, Plt/h e percentuais 50%/30%/20%) e **meta** (valor em R$) na tabela `configuracoes`.

---

## Autenticação e permissões

- **Supabase Auth** mantém a sessão; a tabela `usuarios` armazena: `id` (mesmo do Auth), `nome`, `email`, `senha` (hash alinhado ao Auth), `tipo`, `id_filial`, `ativo`.
- **Middleware** (`src/middleware.ts` + `lib/supabase/middleware.ts`): renova sessão, redireciona não autenticados para `/login`, usuário inativo é deslogado, tipo `novo` só acessa `/temporaria`, **Configurações** só para `admin`; colaborador pode ter `id_filial` fixo (filtros travados por filial onde aplicável).
- **Tipos:** `novo` (pendente), `colaborador` (operações + cadastros, possível restrição por filial), `admin` (inclui Configurações e gestão de usuários).
- **RLS:** Políticas no Supabase por tabela (filiais, colaboradores, usuarios, dados_produtividade, descontos, fechamento, configuracoes) conforme tipo de usuário e, quando aplicável, filial.

---

## Funcionalidades por módulo

### Dashboard
- Períodos: Hoje, Ontem, Últimos 7/15 dias, Mês atual/anterior, Trimestre, Semestre, Ano.
- Filtros: filial, colaborador(es), cliente, busca livre.
- KPIs: produtividade total (R$), % atingimento meta, cargas, pedidos, kg, volume, paletes, tempo médio.
- Gráficos: evolução (kg/volume/paletes por data), produtividade por colaborador/filial, top clientes por peso, descontos por colaborador (período mensal+), top 3 por erros.

### Upload
- Colunas obrigatórias validadas (Filial, Carga, Data Carga, Peso Líquido, Cliente, etc.); variantes de encoding no nome da coluna.
- Data no Excel: serial ou string DD/MM/YYYY / YYYY-MM-DD; normalização para YYYY-MM-DD.
- ID único por carga (`id_carga_cliente`); inserção em lote em `dados_produtividade` com mapeamento de filial por nome.

### Produtividade
- Tabela por carga com: data, filial, carga, cliente, colaborador, hora inicial/final, tempo, peso, volume, paletes, Kg/hs, Vol/hs, Plt/hs, erros separação/entregas, observação.
- Edição inline com confirmação (Sim/Não); colaborador via select (colaboradores ativos da filial).
- Filtros avançados (incluindo faixas numéricas para erros e métricas).

### Descontos
- Um registro por colaborador/mês/ano; campos: falta injustificada (qtd), férias (sim/não), advertência (qtd), suspensão (qtd), atestado (dias), observação.
- Percentual total calculado no front (regras fixas: falta 100%, férias 100%, advertência 50% cada, suspensão 100% cada, atestado por faixa de dias); teto 100%.

### Resultado (Fechamento)
- Cálculo por colaborador/filial/mês: totais de peso, volume, paletes, tempo, erros a partir de `dados_produtividade`; busca desconto em `descontos`; regras de bônus e meta em `configuracoes`; aplicação de percentual de erros e de descontos; gravação em `fechamento` (upsert por chave natural).

### Relatórios
- **PDF/HTML/XLSX/CSV:** baseados em `fechamento` (fetchReportData) com filtros de período e tipo.
- **WhatsApp:** texto formatado com emojis (String.fromCodePoint), seções: resultado produtividade, filial/mês, colaborador (nome + **matrícula real** da tabela colaboradores), produção, produtividade (Kg/Vol/Plt/h), **erros detalhados** (por data: erros separação; erros entregas + observação), valores, **resumo descontos** (tipos + % + observação), resultado final com **atingimento da meta em %**; opção de abrir link wa.me ou copiar texto.

### Cadastros
- Colaboradores: matrícula, nome, filial, função, ativo; import/export Excel.
- Filiais: código, nome, ativo; apenas admin (ou conforme RLS).

### Configurações (Admin)
- Usuários: listagem, edição (nome, email, tipo, filial, ativo, senha), confirmação antes de salvar/excluir.
- Regras de bônus: faixas Kg/h, Vol/h, Plt/h com valor (R$) e percentuais das métricas (50/30/20); meta em R$.
- Persistência em `configuracoes` (chaves: `regras_kg_hora`, `regras_vol_hora`, `regras_plt_hora`, `percentuais_metricas`, `meta_colaborador`).

---

## Modelo de dados e regras de cálculo

### Tabelas principais
- **filiais** — id, codigo, nome, ativo
- **colaboradores** — id, matricula, nome, id_filial, funcao, ativo
- **usuarios** — id (Auth), nome, email, senha, tipo, id_filial, ativo
- **dados_produtividade** — cargas: id_carga_cliente, id_filial, id_colaborador, data_carga, peso_liquido, volume, paletes, tempo, kg_hs, vol_hs, plt_hs, erro_separacao, erro_entregas, observacao, cliente, nota_fiscal, etc.
- **descontos** — id_colaborador, id_filial, mes, ano, falta_injustificada, ferias, advertencia, suspensao, atestado_dias, percentual_total, observacao
- **fechamento** — id_colaborador, id_filial, id_desconto, mes, ano, totais (peso, volume, paletes, tempo), kg_hs, vol_hs, plt_hs, erro_separacao_total, erro_entregas_total, percentual_erros, valor_kg_hs, valor_vol_hs, valor_plt_hs, produtividade_bruta, percentual_descontos, valor_descontos, produtividade_final, meta, percentual_atingimento
- **configuracoes** — chave, valor (JSON), descricao

### Regras de bônus (exemplo típico)
- **Pesos:** Kg/h 50%, Vol/h 30%, Plt/h 20%.
- Faixas (exemplo): Kg/h 950→100, 1000→150, 1100→200, 1300→250, 1400→300 (R$); Vol/h e Plt/h em tabelas análogas em `configuracoes`.
- Produtividade bruta = soma dos valores ponderados das três métricas.

### Erros e descontos
- **Erros:** 1% por erro (separação + entregas); percentual aplicado sobre produtividade bruta; máximo 100%.
- **Descontos (outros):** percentual do desconto (faltas, férias, advertências, etc.) aplicado sobre produtividade bruta; valor_descontos e percentual_descontos no fechamento.
- **Produtividade final** = bruta − desconto_erros − desconto_outros (mín. 0).
- **Meta:** valor fixo (ex.: R$ 300); **atingimento** = (produtividade_final / meta) × 100%.

---

## PWA e deploy

- **Manifest:** `public/manifest.webmanifest` — name, short_name, display standalone, theme_color e background_color (#1a3d1a), ícones em `public/AppImages/android/` e referências para iOS/Windows.
- **Service Worker:** `public/sw.js` — cache de versão para `/`, manifest, imagens de identidade; não faz cache de `/_next/` nem `/api/`; registrado apenas em produção pelo componente `PwaRegister`.
- **Layout root:** metadata (manifest, icons, appleWebApp), viewport com themeColor; ícones e tema alinhados ao background/logo (ex.: backgroundpickprod2.png).
- **Deploy:** Build `npm run build`, start `npm start`; Vercel com `vercel.json` (framework nextjs, buildCommand, installCommand). Variáveis: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (e chaves de API se necessário).

---

## Configuração e uso

### Variáveis de ambiente
Copie `.env.example` para `.env.local` e preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon
```

### Comandos
```bash
npm install
npm run dev    # http://localhost:3000
npm run build
npm start      # produção
npm run lint
```

### Fluxo sugerido de uso
1. **Login** com usuário admin.
2. **Cadastros:** criar filiais e colaboradores (matrícula, nome, filial, função).
3. **Configurações:** ajustar regras de bônus e meta; criar/editar usuários (tipos, filial).
4. **Upload:** importar Excel com dados de cargas do mês.
5. **Produtividade:** atribuir colaborador, horários e erros (e observação) por carga.
6. **Descontos:** lançar faltas, férias, advertências, atestados por colaborador/mês.
7. **Resultado:** escolher mês/ano e clicar em “Calcular Fechamento”.
8. **Dashboard:** acompanhar KPIs e gráficos por período e filtros.
9. **Relatórios:** exportar PDF/HTML/XLSX/CSV ou enviar/copiar mensagem WhatsApp por colaborador.

---

**PickProd** — Sistema de gestão de produtividade de separação (grupo Docemel).  
Documentação técnica para desenvolvedores e operação.
