# DailyWays — Implementação, melhorias, alterações e próximos passos

Este documento resume tudo que foi feito nesta etapa, o que foi melhorado, o que mudou no projeto, o que precisa ser feito agora e o que vem a seguir.

---

# 1. Objetivo desta etapa

O foco desta entrega foi construir a fundação correta para o novo modelo de task do DailyWays.

A meta foi sair de um modelo mais simples de card para uma base capaz de suportar:
- datas melhores,
- task detail mais rico,
- recorrência,
- anexos,
- comentários,
- activity log,
- atribuídos,
- crescimento consistente da arquitetura.

Essa etapa cobriu principalmente:
- Pacote 1A
- Pacote 1B

---

# 2. O que foi feito

## 2.1. Fundação estrutural da task

Foi criada a migration:
- `supabase/migrations/20260417120000_task_foundation_pack_1a.sql`

Ela adiciona no schema de `cards`:
- `start_date`
- `is_all_day`
- `recurrence_rule`
- `cover_attachment_id`
- `updated_at`

Ela adiciona no schema de `subtasks`:
- `position`
- `link_url`
- `link_label`
- `created_at`
- `updated_at`

Também foram adicionados:
- checks de prioridade
- checks de recorrência
- índice para ordenação de subtasks

---

## 2.2. Atualização da RPC estrutural

A função:
- `public.upsert_board_full(jsonb)`

foi atualizada para persistir corretamente os novos campos estruturais de:
- card
- subtask

Isso foi necessário porque a UI já começava a trabalhar com campos como `startDate`, mas o backend estrutural ainda não os salvava de forma consistente.

---

## 2.3. Atualização do boardService

Arquivo alterado:
- `src/services/boardService.js`

Principais mudanças:
- atualização do shape documentado do board/card/subtask
- `cardToRow()` expandido
- `rowToCard()` expandido
- `subtaskToRow()` expandido
- selects de fetch atualizados para novos campos
- payload da RPC atualizado
- subtasks agora mantêm metadados estruturais melhores

Resultado:
- frontend e banco passaram a falar o mesmo contrato estrutural

---

## 2.4. Atualização do AppContext

Arquivo alterado:
- `src/context/AppContext.jsx`

Principais mudanças:
- `createDefaultBoards()` atualizado para o novo shape
- `ADD_CARD` atualizado com novos campos estruturais
- `ADD_SUBTASK` atualizado com shape mais rico
- `getPlannedCards()` ampliado para considerar `dueDate` ou `startDate`

Resultado:
- o estado global ficou coerente com o modelo novo
- a camada estrutural continuou enxuta
- comments/attachments/activity/assignees não foram jogados dentro do reducer global

---

## 2.5. Atualização do Task Detail

Arquivo alterado:
- `src/components/TaskDetail/TaskDetailModal.jsx`

Principais mudanças:
- alinhamento de `recurrence` para `recurrenceRule`
- suporte explícito a `isAllDay`
- persistência de `startDate`
- persistência de `updatedAt`
- ajustes no autosave para os novos campos

Resultado:
- o modal de detalhe já está aderente à nova base estrutural

---

## 2.6. Nova base temporal central

Arquivo criado:
- `src/utils/cardDateTime.js`

Helpers adicionados:
- `parseCardDate()`
- `formatCardDate()`
- `formatCardDateTime()`
- `isCardOverdue()`
- `isCardDueToday()`
- `isCardDueTomorrow()`
- `isCardDueThisWeek()`
- `getCardTemporalBucket()`
- `getCardTimelineDayKey()`

Resultado:
- a lógica de data deixou de ficar espalhada
- o projeto passou a ter uma fonte única de verdade para regras temporais da task

---

## 2.7. Atualização de consumidores da lógica temporal

Arquivos alterados:
- `src/components/Board/BoardCard.jsx`
- `src/components/SmartViews/PlannedView.jsx`
- `src/components/Dashboard/DashboardView.jsx`

Melhorias:
- `BoardCard` passou a usar helpers centrais para prazo e formatação
- `PlannedView` deixou de depender de comparação crua de string de data
- `DashboardView` ganhou métricas temporais mais úteis

Resultado:
- comportamento temporal mais consistente
- base melhor para evolução posterior

---

## 2.8. Fundação colaborativa da task

Foi criada a migration:
- `supabase/migrations/20260417140000_task_collaboration_foundation.sql`

Ela adiciona:

### Helpers SQL
- `public.can_access_card(uuid)`
- `public.can_edit_card_content(uuid)`
- `public.can_moderate_card_comments(uuid)`

### Tabelas novas
- `public.card_attachments`
- `public.card_comments`
- `public.card_activity_logs`
- `public.card_assignees`

### Regras novas
- índices principais por card
- RLS inicial nas novas tabelas
- moderação de comentários para owner/admin
- validação de assignee como membro do board
- FK de `cards.cover_attachment_id` para `card_attachments.id`

### Storage
- bucket `task-attachments`
- policies de leitura/escrita/update/delete

### Realtime
As novas tabelas foram adicionadas à publication `supabase_realtime`:
- `card_attachments`
- `card_comments`
- `card_activity_logs`
- `card_assignees`

Resultado:
- o banco ficou preparado para o novo domínio colaborativo da task

---

# 3. O que foi melhorado

## Arquitetura

Foi corrigido um desalinhamento importante entre UI e persistência.

Antes:
- a UI já começava a expor campos novos
- o banco e os serviços ainda não sustentavam isso corretamente

Agora:
- existe uma base estrutural coerente
- o contrato entre frontend e backend está muito mais alinhado

## Temporalidade

A lógica de data/hora ficou mais confiável e centralizada.

## Escalabilidade do domínio de task

O projeto agora tem base para crescer com:
- anexos
- comentários
- activity
- assignees
- cover
- recorrência

sem precisar remendar o schema depois.

## Separação de responsabilidades

A arquitetura foi mantida mais saudável porque:
- `AppContext` continua estrutural
- o save estrutural continua via `upsert_board_full`
- domínios colaborativos ficaram preparados para services próprios

---

# 4. O que foi alterado

## Arquivos criados

- `src/utils/cardDateTime.js`
- `supabase/migrations/20260417120000_task_foundation_pack_1a.sql`
- `supabase/migrations/20260417140000_task_collaboration_foundation.sql`
- `IMPLEMENTACAO_E_PROXIMOS_PASSOS.md`

## Arquivos alterados

- `README.md`
- `src/services/boardService.js`
- `src/context/AppContext.jsx`
- `src/components/TaskDetail/TaskDetailModal.jsx`
- `src/components/Board/BoardCard.jsx`
- `src/components/SmartViews/PlannedView.jsx`
- `src/components/Dashboard/DashboardView.jsx`

---

# 5. O que foi validado

Foi rodada a build do projeto:

```bash
npm run build
```

Resultado:
- build OK
- sem erro de compilação
- apenas warnings já existentes de chunking/imports dinâmicos

---

# 6. O que falta fazer agora

## Prioridade imediata

### 6.1. Aplicar as migrations no Supabase

As migrations foram criadas localmente, mas ainda precisam ser executadas no banco remoto.

Executar em ordem:
- `supabase/migrations/20260417120000_task_foundation_pack_1a.sql`
- `supabase/migrations/20260417140000_task_collaboration_foundation.sql`

### 6.2. Validar o banco remoto

Após aplicar as migrations, validar:
- se as colunas novas existem em `cards`
- se as colunas novas existem em `subtasks`
- se as tabelas novas foram criadas corretamente
- se a FK de cover está válida
- se a publication realtime incluiu as novas tabelas
- se o bucket `task-attachments` está configurado
- se as policies de storage foram aceitas sem erro

### 6.3. Confirmar autenticação/CLI do Supabase

Foi tentado rodar:
- `npx supabase db push`

Mas falhou porque a CLI não estava autenticada.

Para concluir via CLI, será necessário:

```bash
npx supabase login
npx supabase db push
```

ou definir `SUPABASE_ACCESS_TOKEN`.

---

# 7. O que fazer a seguir

Depois da aplicação do banco, a próxima fase recomendada é a implementação dos domínios no frontend.

## 7.1. Criar services dedicados

Criar:
- `src/services/attachmentService.js`
- `src/services/commentService.js`
- `src/services/activityService.js`
- `src/services/assigneeService.js`

### attachmentService
Responsável por:
- listar anexos por card
- upload no storage
- inserir linha relacional
- remover attachment
- definir capa
- limpar capa
- subscribe realtime

### commentService
Responsável por:
- fetch comments
- criar comment
- editar
- soft delete
- subscribe realtime

### activityService
Responsável por:
- fetch logs
- criar logs
- subscribe realtime
- formatação básica de eventos

### assigneeService
Responsável por:
- fetch assignees
- fetch candidatos do board
- assign
- remove
- subscribe realtime

---

## 7.2. Criar hooks do Task Detail

Criar hooks como:
- `useCardAttachments`
- `useCardComments`
- `useCardActivity`
- `useCardAssignees`

Objetivo:
- carregar sob demanda
- não poluir o estado global
- isolar loading/error/realtime por domínio

---

## 7.3. Evoluir o Task Detail

Próximo bloco visual recomendado:
- attachments section
- comments section
- activity section
- assignee field
- cover block

A estrutura visual do `TaskDetailModal` ainda pode evoluir bastante depois disso.

---

## 7.4. Melhorar o componente de data/hora

Nesta etapa foi criada a base temporal, mas o campo ainda não é um editor completo de data + hora.

Próximo passo recomendado:
- criar um `TaskDateTimeField` real
- suportar hora de forma clara
- suportar toggle all-day com UX melhor
- depois integrar esse componente no TaskDetail

---

# 8. Ordem recomendada a partir daqui

## Ordem mais segura

1. aplicar migrations no Supabase
2. validar schema, storage e realtime
3. criar services de domínio
4. criar hooks de domínio
5. ligar UI do Task Detail aos novos domínios
6. evoluir layout do Task Detail
7. enriquecer BoardCard / Planned / Dashboard com os novos dados

---

# 9. Resultado estratégico desta etapa

Se resumir esta etapa em uma frase:

**A task do DailyWays deixou de ser apenas um card simples e passou a ter uma fundação real para virar o centro do produto.**

Essa foi a principal entrega.

---

# 10. Resumo executivo

## Foi feito
- fundação estrutural de task
- fundação colaborativa de task
- alinhamento frontend/backend
- centralização da lógica temporal
- preparação do banco para crescimento do produto

## Foi melhorado
- consistência do modelo
- confiabilidade temporal
- escalabilidade da arquitetura
- separação entre estrutura e domínios colaborativos

## Falta fazer agora
- aplicar migrations no Supabase
- validar banco remoto

## Falta fazer a seguir
- services
- hooks
- UI real de attachments/comments/activity/assignees
- evolução visual do Task Detail
