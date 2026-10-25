# DailyWays

Aplicativo de produtividade visual: boards kanban, tarefas com subtarefas e recorrência, visões inteligentes (Meu Dia/Diário, Importante, Planejado), whiteboard infinito (Spaces), chat e contatos, com **colaboração em tempo real**.

**Stack:** React 19, Vite 7, zustand, dnd-kit, Supabase (Postgres + RLS, Auth, Storage, Realtime) e um servidor Node + Socket.io para o collab.

## Começando

Requisitos: Node 20.19+ (exigência do Vite 7) e um projeto Supabase.

```bash
npm install                 # instala front, servidor collab e pacotes (npm workspaces)
cp .env.example .env.local  # preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev                 # front em http://localhost:5174
```

Para usar a colaboração em tempo real localmente, crie `server/collab-server/.env` (modelo no fim do `.env.example`) e rode:

```bash
npm run dev:all             # front + collab-server juntos
```

Sem o collab-server o app continua funcionando: o navegador grava direto no Supabase (modo fallback).

> ⚠️ Se o `.env.local` aponta para o Supabase de produção, testar localmente mexe em dados reais. Use um usuário e boards de teste.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Dev server do front (Vite) |
| `npm run dev:collab` | Servidor collab com watch |
| `npm run dev:all` | Front e collab juntos |
| `npm run build` | Build de produção (`dist/`) |
| `npm run preview` | Serve o build, com os cabeçalhos de segurança de `public/_headers` |
| `npm run start:collab` | Servidor collab em produção |
| `npm run start:vps` | Build, testes do back, depois collab + preview na 5174 (usado na VPS) |
| `npm run lint` | ESLint (o projeto mantém zero erros e zero avisos) |
| `npm test` | vitest do front + testes do protocolo e do servidor |
| `npm run db:validate-migrations` | Confere as migrations SQL |
| `npm run db:idempotent-migrations` | Confere se as migrations podem rodar de novo sem erro |

Variáveis opcionais do build: `DW_SOURCEMAP=1` gera sourcemaps; `DW_CSP_REPORT_ONLY=1` deixa a CSP só avisando (por padrão ela é aplicada).

## Estrutura

```text
src/                    # front (React)
  app/                  #   hooks do shell do App
  context/              #   estado global (AppContext + módulos em context/app/)
  collab/               #   colaboração em tempo real (board, space, presença)
  components/           #   UI por domínio
  services/             #   acesso ao Supabase
  stores/ hooks/ utils/
server/collab-server/   # Node + Socket.io (salas, ops, presença, flush no Supabase)
packages/
  collab-protocol/      # eventos e aplicação de ops, compartilhados por front e servidor
  limits/               # limites de texto/arquivo/contagem, compartilhados
supabase/migrations/    # schema versionado
deploy/                 # nginx e guias da VPS
docs/                   # arquitetura, setup do Supabase, relatórios
```

Detalhes em **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**, incluindo a regra de quem persiste o board (servidor collab ou navegador).

## Banco de dados

As migrations em `supabase/migrations/` são aplicadas em ordem:

```bash
npx supabase login
npx supabase db push
```

Sem a CLI, rode os arquivos no **SQL Editor**, do mais antigo para o mais novo. A configuração de Auth, SMTP, Realtime e Storage está em [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md).

## Deploy

Na VPS, o app roda numa `screen` com `npm run start:vps`. O nginx manda `/` para o preview e `/socket.io/` para o collab. O guia completo está em [deploy/VPS-COLLAB.md](deploy/VPS-COLLAB.md); a segurança e a CSP, em [SECURITY.md](SECURITY.md).

```bash
git pull && npm ci   # depois reinicie a screen: o start:vps já faz o build
```

## Documentação

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): como as peças se encaixam e as convenções do código
- [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md): Auth, SMTP, Realtime e Storage
- [docs/VISTORIA-2026-10.md](docs/VISTORIA-2026-10.md): relatório da vistoria (antes/depois, testes, banco)
- [server/collab-server/README.md](server/collab-server/README.md): o servidor collab
- [SECURITY.md](SECURITY.md): cabeçalhos, CSP e boas práticas
