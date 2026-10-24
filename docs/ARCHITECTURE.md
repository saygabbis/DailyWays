# Arquitetura do DailyWays

Visão de como as peças se encaixam. Para rodar o projeto, veja o [README](../README.md); para o banco, [SUPABASE_SETUP.md](SUPABASE_SETUP.md); para a VPS, [deploy/VPS-COLLAB.md](../deploy/VPS-COLLAB.md).

## Peças

```text
Navegador (React 19 + Vite)  ──HTTPS──▶  Supabase (Postgres + RLS, Auth, Storage, Realtime)
        │                                        ▲
        └──WebSocket (/socket.io)──▶  collab-server (Node + Socket.io)  ──service role──┘
```

- **Front** (`src/`): SPA em React 19. Fala com o Supabase direto (auth, leitura, fallback de escrita) e com o collab-server por Socket.io quando a colaboração está ligada.
- **collab-server** (`server/collab-server/`): mantém uma "sala" por board/space em memória, valida e aplica as operações (`op:submit` → `op:applied`), sincroniza presença e grava no Supabase em lote (flush a cada `COLLAB_FLUSH_MS`).
- **Pacotes compartilhados** (`packages/`):
  - `@dailyways/collab-protocol`: nomes de eventos, ids de sala, validação e aplicação das ops de board. Front e servidor aplicam a MESMA função, então o resultado é idêntico nos dois lados.
  - `@dailyways/limits`: limites de texto, arquivo e contagem, usados pela UI e pelo servidor. As mensagens em PT-BR da UI ficam em `src/limits/messages.js`.

## Quem grava o board (a regra mais importante)

A RPC `upsert_board_full` substitui o board inteiro: o que não está no payload é apagado. Por isso só pode haver UM escritor por vez. A decisão fica em `src/collab/board/sync/persistAuthority.js`, que tem teste:

| Situação | Quem persiste |
|---|---|
| Collab ligado, socket conectado e sala do board pronta | **collab-server** (o navegador não grava) |
| Collab desligado, sem socket ou fora da sala | **navegador** (fallback via `useBoardPersistence`) |

Se o collab cair, depois de alguns segundos o board abre em modo fallback em vez de ficar preso em "Sincronizando…".

## Front: organização de `src/`

```text
src/
├─ main.jsx               # Providers (Theme → Auth → Toast → Collab → App → ContextMenu → Pomodoro → Rádio) + ErrorBoundary raiz
├─ App.jsx                # Shell: layout, roteamento por estado, modais globais
├─ app/                   # Hooks do shell: navegação, DnD global, efeitos, menu global, reset de senha, títulos
├─ context/               # Estado global
│  ├─ AppContext.jsx      #   provider de boards/grupos/spaces (orquestra os módulos abaixo)
│  ├─ app/                #   appReducer, appDefaults, useBoardPersistence, useBoardsRealtime, useInitialBoardsLoad
│  ├─ i18n/               #   traduções
│  └─ use*.js             #   hooks de acesso (useApp, useAuth, useTheme/useI18n, useToast, usePomodoro, useRadio)
├─ collab/                # Tudo de colaboração em tempo real
│  ├─ core/               #   socket, provider, config, useCollab
│  ├─ board/              #   sync (sessão, fingerprint, autoridade de persistência), ops, presença, histórico, UI de cursores
│  ├─ space/              #   o mesmo para o whiteboard (Spaces)
│  ├─ shared/             #   presença/sessão comuns
│  └─ task-modal/         #   rascunho ao vivo do modal de tarefa
├─ components/            # UI por domínio (Board, TaskDetail, Sidebar, Whiteboard, Settings, Chat, …)
│  ├─ Board/hooks/        #   lógica do BoardView (drag remoto, panning, fim do DnD, toolbar, atalhos)
│  ├─ TaskDetail/hooks/   #   domínios do card (anexos, comentários, atividade, responsáveis)
│  ├─ Settings/panels/    #   um arquivo por aba de Configurações
│  └─ Whiteboard/         #   canvas/ (CanvasShell + hooks), core/ (ops puras), interaction/, nodes/, panels/
├─ services/              # Acesso ao Supabase (boardService, boardMappers, boardSharingService, chat, contatos…)
├─ stores/                # Stores zustand (seleção, whiteboard, conclusões das smart views)
├─ hooks/                 # Hooks reutilizáveis (useLatestRef, useElementRect, notificações, diário, undo…)
├─ utils/                 # Funções puras (datas do card, cores, URLs, uuid…)
├─ limits/                # Mensagens de limite da UI
├─ dev/                   # Menu DEV (Ctrl+Shift+4, só contas dev)
└─ __tests__/             # Testes vitest do front
```

### Convenções

- **Componente grande vira hook por responsabilidade.** O componente orquestra e os hooks (`useXxx(ctx)`) ficam ao lado, em `hooks/`. Exemplos: `CanvasShell` → 10 hooks; `BoardView` → 5.
- **Hook de contexto em arquivo próprio** (`context/useApp.js` etc.). Um arquivo `.jsx` exporta só componentes, o que mantém o fast refresh funcionando.
- **Ref "valor mais recente"**: `useLatestRef(valor)`. Não atribuir `ref.current` durante o render.
- **Ler o DOM no render**: `useElementRect(ref)` (useSyncExternalStore). Não usar `ref.current.getBoundingClientRect()` direto.
- **Estado que espelha props** (formulário que reabre, campo que segue o nó selecionado): ajuste no render com o padrão "estado anterior", não `useEffect` + `setState`.
- **Effect com setState só para sistema externo** (fetch, socket, medição de layout). Nesses casos a supressão do lint fica na linha, com o motivo.
- **Lint é zero.** `npm run lint` não pode ter erro nem aviso; as regras do React Compiler estão ligadas.

## Whiteboard (Spaces)

- `core/`: operações puras sobre nós (criar, alinhar, frames, guias, histórico, camadas, páginas). Não dependem de React.
- `interaction/`: viewport (pan/zoom), seleção, snap, transformações e hooks de interação.
- `canvas/`: `CanvasShell.jsx` e os hooks dele (criação, uploads, clipboard, pointer down/gestos, resize/rotate, ações de seleção, drag, menu de contexto) e os overlays (réguas, seleção, handles).
- `stores/whiteboard*.js`: estado em zustand. O collab aplica patches via `collab/space/ops/useCollabPatch`.

## Servidor collab

```text
server/collab-server/src/
├─ index.js              # Express + Socket.io
├─ auth/                 # verificação do JWT do Supabase (jose), acesso dev
├─ config/               # carga e validação do .env
├─ db/                   # cliente Supabase (service role) e persistência
├─ services/             # salas (roomManager/roomRuntime), adaptadores board/space, aplicação e flush de ops, ids de op
└─ socket/               # handlers e rate limit (por usuário e por IP)
```

O contador de pessoas por sala é um conjunto de sockets, então entrar ou sair duas vezes não desbalanceia. Há testes em `roomManager.test.js` e `roomRuntime.test.js`.

## Banco (Supabase)

- O schema é versionado em `supabase/migrations/` (aplicar em ordem).
- **RLS** em todas as tabelas. As políticas usam `(select auth.uid())`, que é avaliado uma vez por consulta e não por linha.
- **Funções SECURITY DEFINER** são fechadas para `anon`, exceto o fluxo de login/cadastro e os helpers de RLS. O `search_path` é fixo.
- **Índices** em todas as FKs e nos caminhos quentes (carga de board, RLS, chat).
- Scripts de apoio: `npm run db:validate-migrations` e `npm run db:idempotent-migrations`.

## Testes

- `npm test` roda o vitest do front (`src/__tests__`) e os testes `node:test` do protocolo e do servidor.
- Não há teste end-to-end versionado. Os testes de fumaça da vistoria usaram Playwright com Supabase mockado; veja [VISTORIA-2026-10.md](VISTORIA-2026-10.md).
