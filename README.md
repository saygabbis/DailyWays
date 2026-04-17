# DailyWays

DailyWays é um app de produtividade visual construído com React + Vite + Supabase.

O projeto combina:
- boards estilo kanban,
- listas e tarefas,
- subtarefas,
- smart views como My Day, Planned e Important,
- compartilhamento de boards,
- realtime entre abas/usuários,
- base em evolução para task detail rico com comentários, anexos, activity e assignees.

## Stack principal

- React 19
- Vite 7
- Supabase
- date-fns
- lucide-react
- @hello-pangea/dnd

## Scripts

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Estrutura principal

- `src/components/` — UI do app
- `src/context/` — estado global e providers
- `src/services/` — integração com Supabase e serviços de domínio
- `src/utils/` — utilitários compartilhados
- `supabase/migrations/` — migrations SQL do banco

## Fluxos centrais atuais

### Boards

O app usa boards com listas e cards, persistidos no Supabase.

Arquivo principal:
- `src/services/boardService.js`

### Estado global

O estado global do app fica em:
- `src/context/AppContext.jsx`

Ele coordena:
- boards,
- grupos,
- spaces,
- persistência otimista,
- realtime,
- erros de save,
- seleção,
- filtros e helpers de consulta.

### Task Detail

O modal de detalhe da task fica em:
- `src/components/TaskDetail/TaskDetailModal.jsx`

Hoje ele já suporta a base estrutural de:
- título,
- descrição,
- prioridade,
- due date,
- start date,
- all day,
- recorrência,
- labels,
- cor,
- subtasks.

## Evolução recente implementada

Foi concluída a fundação para a nova geração de task do DailyWays.

### Pacote 1A — fundação estrutural

Implementado:
- expansão do schema de `cards`
- expansão do schema de `subtasks`
- atualização da RPC `upsert_board_full`
- atualização de `boardService`
- alinhamento do `AppContext`
- alinhamento do `TaskDetailModal`
- criação da base temporal central em `src/utils/cardDateTime.js`
- primeiros consumidores dessa base temporal no board, planned e dashboard

Migrations:
- `supabase/migrations/20260417120000_task_foundation_pack_1a.sql`

### Pacote 1B — fundação colaborativa

Implementado:
- helpers SQL por card
- tabela `card_attachments`
- tabela `card_comments`
- tabela `card_activity_logs`
- tabela `card_assignees`
- bucket `task-attachments`
- policies iniciais de storage
- publication realtime para as novas tabelas

Migrations:
- `supabase/migrations/20260417140000_task_collaboration_foundation.sql`

## Utilitários temporais

Arquivo:
- `src/utils/cardDateTime.js`

Essa base centraliza:
- parse seguro de datas da task
- formatação
- overdue
- due today
- due tomorrow
- due this week
- bucket temporal
- chave diária da timeline

## Banco / Supabase

A pasta de migrations fica em:
- `supabase/migrations/`

### Importante

As migrations novas foram criadas localmente, mas ainda precisam ser aplicadas no projeto Supabase remoto.

Arquivos para executar:
- `supabase/migrations/20260417120000_task_foundation_pack_1a.sql`
- `supabase/migrations/20260417140000_task_collaboration_foundation.sql`

## Como aplicar no Supabase

### Opção 1 — SQL Editor

Executar no SQL Editor do projeto Supabase, em ordem:

1. `20260417120000_task_foundation_pack_1a.sql`
2. `20260417140000_task_collaboration_foundation.sql`

### Opção 2 — Supabase CLI

Se a CLI estiver autenticada:

```bash
npx supabase login
npx supabase db push
```

## Status atual do projeto

Hoje o projeto já está preparado estruturalmente para suportar:
- due date + start date,
- all day,
- recurrence rule,
- cover attachment id,
- subtasks mais ricas,
- attachments,
- comments,
- activity logs,
- assignees,
- realtime das novas entidades.

O que ainda falta é a camada de serviço e UI real desses novos domínios.

## Próximos passos recomendados

### Imediato

- aplicar as novas migrations no Supabase
- validar o banco remoto
- confirmar storage bucket e policies
- validar realtime das novas tabelas

### Próxima fase de produto

Implementar no frontend:
- `attachmentService`
- `commentService`
- `activityService`
- `assigneeService`
- hooks específicos do Task Detail
- seções reais de attachments/comments/activity/assignees no modal

## Build

A build foi validada com:

```bash
npm run build
```

Resultado:
- build OK
- warnings apenas de chunking/imports dinâmicos já existentes
