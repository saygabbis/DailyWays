# Vistoria DailyWays: outubro de 2026

Base: `9331356` (último commit antes da vistoria). Tudo foi feito em commits pequenos na `main`, e cada etapa passou por lint, `npm test` e build.
Nenhum `.env` ou segredo foi versionado. **Não houve deploy na VPS** (passos no fim).

## Números

| | Antes | Depois |
|---|---|---|
| Lint (`npm run lint`) | 293 erros, 62 avisos | **0 erros, 0 avisos**, com as regras do React Compiler ligadas |
| Testes (`npm test`) | 6 (só protocolo e servidor) | 33 (25 vitest do front, 4 do protocolo, 4 do servidor) |
| JS inicial | 1.383 kB (gzip 403 kB), tudo num arquivo | `index` 467 kB (gzip 136 kB), com as libs em chunks próprios |
| Whiteboard, Configurações, modal de tarefa… | no bundle inicial | carregam sob demanda |
| Sourcemap público | 5,5 MB servido em produção | não é gerado (`DW_SOURCEMAP=1` liga) |
| Código morto (knip) | 26 arquivos, cerca de 78 exports, 4 dependências | zero |

Arquivos que eram gigantes (linhas):

| Arquivo | Antes | Depois |
|---|---|---|
| `Whiteboard/canvas/CanvasShell.jsx` | 2.263 | 618 (+10 hooks em `canvas/hooks/`) |
| `Sidebar/Sidebar.jsx` (antes em `Layout/`) | 1.609 | 674 |
| `TaskDetail/TaskDetailModal.jsx` | 1.497 | 820 |
| `context/AppContext.jsx` | 1.426 | 361 (+5 módulos em `context/app/`) |
| `Settings/SettingsView.jsx` | 1.362 | 131 (+8 painéis) |
| `Board/BoardView.jsx` | 1.083 | 702 (+5 hooks) |
| `services/boardService.js` | 1.029 | 498 (+ `boardMappers`, `boardSharingService`) |
| `App.jsx` | 700 | 424 (+ `src/app/`) |

## Bugs corrigidos

1. **Persistência dupla, o mais grave.** Com a sala de collab ao vivo, o navegador também gravava o board inteiro pela `upsert_board_full`, que apaga o que não está no payload. Uma aba desatualizada podia apagar edições de outra pessoa. Agora uma regra única (`collab/board/sync/persistAuthority.js`, com teste) define que, com a sala ao vivo, só o servidor grava.
2. **BoardView**: havia um `return` antes de hooks.
3. **AppearanceFillSection**: havia um hook depois de `return`.
4. **BoardList**: chamava `setShowMenu` e `setShowListDetails`, que não existiam. Dava crash ao apagar lista.
5. **Sem ErrorBoundary.** Agora há um na raiz e outro nas views (reseta ao trocar de view ou board).
6. **Contador de pessoas por sala no servidor.** Desbalanceava no erro de join, na entrada por presença e no dev-prank. Virou um conjunto de sockets idempotente, com testes.
7. **Quebras de linha corrompidas** (`\r\r\n`) em 2 arquivos. O `.gitattributes` evita que volte.

Achados durante a vistoria:

- O board ficava preso em "Sincronizando…" quando o collab estava fora do ar. Agora entra em fallback em 4 s.
- **Limite de operações por IP do servidor era ignorado**: só o limite por usuário valia. Corrigido em `socket/rateLimit.js`.
- **Colar ou duplicar no whiteboard sem collab** quebrava (`addNode` indefinido). Corrigido.
- **Modal de tarefa** mostrava campos do card anterior ao trocar de card. Corrigido: o modal remonta por card.
- Em Configurações, o título de seção com botão ao lado ("Histórico" em Convites) ficava encavalado na descrição. Corrigido no CSS.
- `acceptInvitation` fazia 3 consultas extras ao Supabase só para debug. Removidas.
- **Toast**: o contexto mudava a cada toast e re-renderizava todos os consumidores, e dois toasts no mesmo milissegundo tinham a mesma key. Corrigido.
- Dependências de hooks erradas (callbacks e memos desatualizados) em dezenas de pontos.
- O `?.` foi preservado em todos os casos em que o lint sugeria removê-lo.

## Organização e arquitetura

- **AppContext** dividido em reducer, defaults, persistência, realtime e carga inicial. Os hooks de contexto (`useApp`, `useAuth`, `useTheme`…) passaram para arquivos próprios, e o fast refresh do Vite voltou a funcionar.
- **Componentes gigantes** quebrados em hooks por responsabilidade (tabela acima). Sidebar ganhou pasta própria; `BoardDetailsModal` foi para `Board/` e `SpaceDetailsModal` para `Spaces/`.
- **Regras do React Compiler zeradas:**
  - `refs`: refs de "valor mais recente" passaram para `useLatestRef`, e leituras do DOM no render para `useElementRect` (useSyncExternalStore).
  - `set-state-in-effect`: estado que espelha props é ajustado no render. Os effects que sincronizam com sistema externo (Supabase, socket, medição de DOM) ficaram com supressão na linha e o motivo escrito.
  - `preserve-manual-memoization`: `user?.id` virou `userId` estável, e o compiler volta a otimizar esses hooks.
- **Limpeza:**
  - Removidos:
    - arquivos e exports mortos;
    - as dependências `react-router-dom`, `uuid`, `concurrently` e `wait-on`;
    - `ecosystem.config.cjs`, `vercel.json` e `supabase/.temp`;
    - imports de CSS repetidos nos arquivos divididos;
    - os assets do template Vite (`react.svg`, `vite.svg`).
  - `src/limits` × `packages/limits`: não era duplicação. O pacote tem números e validação; `src/limits/messages.js` tem as mensagens da UI.
- **Docs:** README reescrito, com `docs/ARCHITECTURE.md` novo e `SUPABASE_SETUP.md` movido para `docs/`. O antigo `IMPLEMENTACAO_E_PROXIMOS_PASSOS.md` foi para `docs/historico/`: os "próximos passos" dele (services de anexos, comentários, atividade e responsáveis) já estão feitos.
- **Cabeçalhos de segurança:** o `vite preview` da VPS envia os de `public/_headers`. A CSP vai como *Report-Only* até ser ligada com `DW_CSP_ENFORCE=1`.
- `index.html` agora é `lang="pt-BR"`, e o pacote raiz chama `dailyways` (antes `app-tasks`).

## Banco (Supabase), aplicado em produção

Três migrations em `supabase/migrations/20261024*`:

1. **Permissões das funções.** As 57 funções SECURITY DEFINER eram executáveis por `anon`, inclusive uma que devolve id e e-mail de qualquer usuário. Agora ficam fechadas para quem não está logado, exceto login/cadastro e os helpers de RLS (consulta anônima volta vazia, não erro). O `search_path` é fixo.
2. **Índices** em todas as FKs (`cards.list_id`, `lists.board_id`, `board_members.user_id`, `messages.conversation_id`…) e nos caminhos quentes. Antes, toda checagem de RLS e todo load de board fazia seq scan.
3. **Limpeza das políticas RLS**, com a mesma regra de acesso e menos trabalho por linha:
   - políticas redundantes removidas;
   - `FOR ALL` dividido para não ser avaliado em toda leitura;
   - `auth.uid()` passou a ser avaliado uma vez por consulta.

   Resultado conferido no SQL Editor: 116 políticas, 1 ainda pública (só a leitura de avatar) e 0 sem `(select auth.uid())`. O backup das políticas antigas foi entregue à parte.

## O que foi testado e o que não deu

**Testado aqui:**

- Lint, `npm test`, build e knip em cada etapa.
- Testes unitários novos:
  - autoridade de persistência;
  - ErrorBoundary;
  - fingerprint de board;
  - limites e convites;
  - mapeadores de board;
  - gate de reset de senha;
  - títulos de view;
  - contador de salas do servidor.
- Testes de fumaça no Chromium headless contra o build de produção, com o **Supabase falso** (URL inválida e respostas mockadas, nada em produção):
  - **App:**
    - home e as views Diário, Importante, Planejado, Visão Geral e Contatos;
    - board em fallback, modal de tarefa e nova subtarefa;
    - menu de contexto da sidebar;
    - todas as abas de Configurações;
    - novo space e busca (Ctrl+K).
  - **Whiteboard:**
    - criar nota e texto;
    - colar (2 → 4 nós), desfazer e apagar seleção (→ 0);
    - réguas e caixa de seleção.
  - Nenhum erro de página e nenhum ErrorBoundary disparado.

**Não testado (precisa de você, com usuário e board de teste):**

- Nada contra o Supabase real nem com o collab-server real. Não foram testados:
  - colaboração ao vivo em duas abas;
  - cursores e presença;
  - reconexão;
  - whiteboard com dados reais;
  - chat e notificações em tempo real.
- O `.env.local` aponta para produção, então teste local mexe em dados reais.
- Um roteiro sugerido:
  1. Abrir o mesmo board em duas abas e editar nas duas.
  2. Derrubar o collab (Ctrl+C no `dev:collab`), editar e conferir que salvou.
  3. Subir o collab de novo.
  4. Repetir num Space.
- Login social com a CSP: confira os avisos no console antes de ligar `DW_CSP_ENFORCE=1`.
- O menu de contexto do canvas por clique direito não abre no Playwright, nem na versão antiga. É limitação do teste, mas vale conferir à mão.

## Deploy na VPS (não feito; só com o seu OK)

```bash
cd /home/gabbis/Bots/DailyWays
git pull
npm ci
# reiniciar a screen DailyWays: npm run start:vps (já faz o build e roda os testes do back)
```

Ajustes de infra pendentes:

1. Tirar `NODE_ENV=production` do `.env.local` da VPS. É isso que gera o aviso do Vite; o build já define o modo.
2. Apagar `debug-ed15fe.log` da pasta do projeto.
3. Opcional: os cabeçalhos de segurança também no nginx (bloco `add_header` no `SECURITY.md`).
