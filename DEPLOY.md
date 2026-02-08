# Deploy na Vercel

## Pré-requisitos

- Conta na [Vercel](https://vercel.com)
- Projeto Supabase com URL e chave anon (veja `.env.example`)

## Passos

### 1. Conectar o repositório

- Acesse [vercel.com/new](https://vercel.com/new)
- Importe o repositório Git (GitHub, GitLab ou Bitbucket)
- A Vercel detecta automaticamente Next.js pelo `package.json` e `next.config.ts`

### 2. Variáveis de ambiente

No painel do projeto na Vercel:

- **Settings** → **Environment Variables**
- Adicione:

| Nome | Valor | Ambientes |
|------|--------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://seu-projeto.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sua chave anon do Supabase | Production, Preview, Development |

Valores em **Production** são usados no deploy em produção; **Preview** em PRs; **Development** no `vercel dev`.

### 3. Deploy

- **Deploy** → **Redeploy** (ou faça push na branch conectada)
- A Vercel usa o `vercel.json` e o Next.js para rodar `npm run build` e servir a aplicação

### 4. Domínio (opcional)

- **Settings** → **Domains** para adicionar um domínio próprio ou subdomínio `*.vercel.app`

## Arquivos de configuração

- **`vercel.json`** – framework Next.js e comandos de build (já configurado)
- **`.env.example`** – modelo das variáveis; **não** commite `.env.local` (já está no `.gitignore`)

## Build local (testar antes do deploy)

```bash
npm install
npm run build
npm run start
```

Se o build passar localmente, o deploy na Vercel tende a funcionar da mesma forma.
