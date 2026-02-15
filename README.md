# DockProd — Sistema de Gestão de Produtividade

**Slogan:** *Cada pedido conta*

Sistema web para controle de produtividade de colaboradores em operações de recebimento (docking), cálculo de bônus por desempenho (Kg/h, Vol/h, Plt/h), indicadores (acuracidade, checklist, perda), aplicação de descontos (faltas, férias, advertências, atestados) e fechamento mensal com relatórios em PDF, HTML, Excel, CSV e compartilhamento via WhatsApp.

---

## Índice

- [Objetivos e escopo](#objetivos-e-escopo)
- [Stack e requisitos](#stack-e-requisitos)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Fluxo geral e telas](#fluxo-geral-e-telas)
- [Autenticação e permissões](#autenticação-e-permissões)
- [Modelo de dados DockProd](#modelo-de-dados-dockprod)
- [Regras de cálculo](#regras-de-cálculo)
- [PWA e deploy](#pwa-e-deploy)
- [Configuração e uso](#configuração-e-uso)

---

## Objetivos e escopo

- **Objetivo:** Medir e remunerar a produtividade de colaboradores em operações de recebimento por métricas objetivas (peso/hora, volume/hora, paletes/hora) e indicadores (acuracidade, checklist, plt/hs, perda), com descontos por eventos (faltas, férias, advertências, suspensões, atestados), e gerar fechamento mensal e relatórios.
- **Público:** Operações logísticas (CDs) com múltiplas filiais e colaboradores; usuários admin (gestão total) e colaborador (visão restrita à própria filial quando configurado).
- **Entregas:** Dashboard com KPIs e gráficos, upload de dados (recebimentos + tempo), Dados por Coleta, cadastro de descontos, tela de resultado/fechamento com cálculo de bônus e meta, relatórios (PDF, HTML, XLSX, CSV, WhatsApp) e PWA instalável.

---

## Stack e requisitos

| Item | Tecnologia |
|------|------------|
| Framework | Next.js (App Router) |
| Linguagem | TypeScript |
| UI | Tailwind CSS, Shadcn UI (Radix), Lucide Icons |
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
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── login/page.tsx
│   │   ├── cadastro/page.tsx
│   │   ├── temporaria/page.tsx
│   │   └── (dashboard)/
│   │       ├── layout.tsx
│   │       ├── dashboard/page.tsx
│   │       ├── upload/page.tsx          # Upload recebimentos + tempo
│   │       ├── produtividade/page.tsx   # Dados por Coleta
│   │       ├── descontos/page.tsx
│   │       ├── resultado/page.tsx       # Calcular Fechamento
│   │       ├── relatorios/page.tsx
│   │       ├── cadastros/page.tsx
│   │       └── configuracoes/page.tsx
│   ├── components/
│   ├── lib/
│   │   ├── supabase/
│   │   ├── calculos.ts                  # Acuracidade, checklist, plt/hs, perda
│   │   ├── relatorios.ts                # fetchReportData, fetchReportDescontos, fetchReportResultados, fetchReportDadosPorColeta, fetchAllDadosProdutividade
│   │   └── relatorios/
│   │       ├── pdfGenerator.ts
│   │       ├── htmlGenerator.ts
│   │       ├── xlsxGenerator.ts
│   │       └── whatsappGenerator.ts
│   └── types/
│       └── database.ts
├── public/
│   ├── manifest.json
│   ├── logodockprod.png
│   └── backgroundockprod.png
├── .env.example
└── package.json
```

---

## Fluxo geral e telas

1. **Login** (`/login`) — Email e senha via Supabase Auth; usuário tipo `novo` vai para `/temporaria`.

2. **Upload** (`/upload`) — Envio de planilhas Excel: **recebimentos** (filial, fornecedor, coleta, dta_receb, qtd_caixas, peso_liquido, etc.) e **tempo** (ordem_coleta, inicio_recebimento, final_recebimento, tempo_recebimento).

3. **Produtividade** (`/produtividade`) — Visualização de **Dados por Coleta**: recebimentos agrupados por coleta com tempo, Kg/Hs, Vol/Hs, Plt/Hs, filtros por data e filial.

4. **Descontos** (`/descontos`) — Cadastro por colaborador/filial/mês (mes_desconto): falta injustificada, férias, advertência, suspensão, atestado (dias), observação.

5. **Resultado** (`/resultado`) — Seleção de mês/ano; botão **Calcular Fechamento**: consolida totalizadores, resultados (acuracidade, checklist, plt_hs, perda), aplica regras de bônus e descontos, persiste em `fechamento`.

6. **Relatórios** (`/relatorios`) — Exportação **PDF**, **HTML**, **XLSX**, **CSV** (dados alinhados ao modelo DockProd: Produtividade, Descontos, Resultados, Dados por Coleta); **Dados Gerais** (PDF/Excel) a partir de recebimentos + tempo; **WhatsApp** com resumo por colaborador.

7. **Cadastros** — Colaboradores e filiais.

8. **Configurações** (Admin) — Usuários, regras de bônus, meta.

---

## Autenticação e permissões

- **Supabase Auth** para sessão; tabela `usuarios`: id, nome, email, tipo, id_filial, ativo.
- **Tipos:** `novo`, `colaborador`, `admin`, `gestor`.
- **RLS** por tabela conforme tipo e filial.

---

## Modelo de dados DockProd

### Tabelas principais

| Tabela | Descrição |
|--------|-----------|
| **filiais** | id, codigo, nome, ativo |
| **colaboradores** | id, matricula, nome, id_filial, funcao, ativo |
| **usuarios** | id (Auth), nome, email, tipo, id_filial, ativo |
| **recebimentos** | id, id_filial, filial, fornecedor, coleta, dta_receb, usuario_recebto, qtd_caixas_recebidas, peso_liquido_recebido, id_coleta_recebimento, observacao |
| **tempo** | id, id_filial, ordem_coleta, id_coleta_recebimento, inicio_recebimento, final_recebimento, tempo_recebimento, peso_total, qtd_caixas_total, qtd_paletes, tempo_horas, kg_hs, vol_hs, plt_hs |
| **totalizadores** | id_filial, mes, ano, peso_liquido_total, qtd_caixas_total, paletes_total, tempo_total, kg_hs, vol_hs, plt_hs |
| **fechamento** | id_colaborador, id_filial, id_desconto, mes, ano, peso_liquido_total, volume_total, paletes_total, tempo_total, kg_hs, vol_hs, plt_hs, valor_kg_hs, valor_vol_hs, valor_plt_hs, produtividade_bruta, percentual_descontos, valor_descontos, produtividade_final, meta, percentual_atingimento |
| **resultados** | id_colaborador, id_filial, mes, acuracidade, checklist, plt_hs, perda, bonus, desconto, bonus_final |
| **descontos** | id_colaborador, id_filial, mes_desconto (date), falta_injustificada, ferias, advertencia, suspensao, atestado, percentual_total, observacao |
| **configuracoes** | chave, valor (JSON), descricao |

---

## Regras de cálculo

### Indicadores de bônus

- **Acuracidade:** ≥ 95% → valor fixo; < 95% → desconto proporcional.
- **Checklist:** ≥ 90% → valor fixo; < 90% → desconto proporcional.
- **Plt/Hs:** valor por faixa conforme filial (configuração por setor: recebimento ou estoque).
- **Perda:** ≤ 1,7% → valor fixo; > 1,7% → desconto (apenas setor estoque).

### Produtividade e meta

- **Produtividade bruta** = vlr_acuracidade + vlr_checklist + vlr_plt_hs + vlr_perda.
- **Meta** = R$ 250 (padrão).
- **Percentual descontos** = (valor_descontos / produtividade_bruta) × 100.
- **Produtividade final** = produtividade_bruta − valor_descontos (mín. 0).

### Descontos (faltas, férias, etc.)

- Falta injustificada: 100%.
- Férias: 100%.
- Advertência: 50% cada.
- Suspensão: 100% cada.
- Atestado: 25% (≤2 dias), 50% (3–5), 70% (6–7), 100% (>7).

---

## PWA e deploy

- **Manifest:** `public/manifest.json` — nome DockProd, ícones, theme_color.
- **Deploy:** `npm run build`, `npm start`; Vercel com variáveis `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

---

## Configuração e uso

### Variáveis de ambiente

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon
```

### Comandos

```bash
npm install
npm run dev    # http://localhost:3000
npm run build
npm start
npm run lint
```

### Fluxo sugerido

1. **Login** com usuário admin.
2. **Cadastros:** criar filiais e colaboradores.
3. **Upload:** importar Excel de **recebimentos** e **tempo**.
4. **Produtividade:** consultar Dados por Coleta.
5. **Descontos:** lançar faltas, férias, advertências, atestados por colaborador/mês.
6. **Resultado:** mês/ano → **Calcular Fechamento**.
7. **Relatórios:** exportar PDF/HTML/Excel/CSV ou enviar WhatsApp por colaborador.

---

**DockProd** — Sistema de gestão de produtividade de recebimento.  
Documentação técnica para desenvolvedores e operação.
