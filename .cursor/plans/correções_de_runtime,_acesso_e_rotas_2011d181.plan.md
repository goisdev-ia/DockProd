---
name: Correções de Runtime, Acesso e Rotas
overview: Corrigir erro de Select no gerenciamento de usuários, implementar controle de acesso por filial (RBAC) no Supabase e frontend, e ajustar redirecionamento da tela de cadastro.
todos:
  - id: fix-select-error
    content: Corrigir erro de Select.Item com valor vazio em ConfiguracoesPage
    status: pending
  - id: implement-rls-filial
    content: Implementar RLS por filial no Supabase para tabelas críticas
    status: pending
  - id: restrict-dashboard-filial
    content: Restringir filtros do Dashboard por filial para colaboradores
    status: pending
  - id: fix-cadastro-redirect
    content: Ajustar middleware para permitir acesso à tela de cadastro
    status: pending
isProject: false
---

### 1. Correção de Erro Runtime no Select de Usuários

- Alterar o valor vazio no `SelectItem` da filial em `src/app/(dashboard)/configuracoes/page.tsx` para um valor não vazio (ex: `"nenhuma"`).
- Ajustar o estado inicial e a lógica de salvamento para tratar esse valor como `null` no banco de dados.

### 2. Controle de Acesso por Filial (RBAC)

- **Supabase (RLS)**: Atualizar as políticas de segurança das tabelas `dados_produtividade`, `descontos`, `fechamento` e `colaboradores` para que usuários do tipo `colaborador` só possam ler/escrever dados da sua própria filial (`id_filial`).
- **Frontend (Dashboard)**: 
  - Buscar os dados do usuário logado (tipo e filial).
  - Se for `colaborador`, fixar a `filialSelecionada` para a filial do usuário e desabilitar o seletor de filiais.
  - Garantir que todas as chamadas RPC e queries incluam o filtro de filial corretamente.

### 3. Ajuste de Navegação na Tela de Cadastro

- Modificar o middleware em `src/lib/supabase/middleware.ts` para permitir o acesso à rota `/cadastro` mesmo que o usuário esteja autenticado, ou ajustar a lógica de redirecionamento para ser mais específica (ex: apenas redirecionar `/login` se já logado).

### 4. Validação e Testes

- Verificar se a edição de usuários funciona sem erros.
- Testar o acesso com um usuário `colaborador` e confirmar que ele só vê dados da sua filial.
- Testar o acesso à tela de cadastro.

