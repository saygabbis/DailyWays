# Prompt para a próxima sessão do Claude Code

> Cole tudo abaixo da linha no novo Claude Code, junto com as 5 imagens: Visão Geral, Diário, Importante, Planejado e a montagem "board Objetivos + Space".

---

Fala em português do Brasil, por favor.

Projeto: **DailyWays** (React 19 + Vite 7, servidor collab Node + Socket.io em `server/collab-server`, pacotes `packages/collab-protocol` e `packages/limits`, Supabase). Repositório: https://github.com/saygabbis/DailyWays (branch `main`). Antes de mexer, leia `docs/ARCHITECTURE.md` e `docs/VISTORIA-2026-10.md`.

## Regras (valem para tudo)
- Nunca commitar `.env`, `.env.local` nem segredos do Supabase.
- Deploy na VPS (pull lá e reiniciar a screen `DailyWays`) só com o meu OK.
- Não mexer em `E:\PROJETOS\CURSOR\DailyWays`. Na VPS, o usuário kzer0: não mexe nas coisas dele.
- Rodar lint (`npm run lint`, precisa ficar em 0 erros e 0 avisos), testes (`npm test`) e build a cada etapa.
- Antes de entregar, fazer revisão crítica do próprio diff.
- Dizer com honestidade o que testou e o que não deu para testar. **Cuidado: o `.env.local` aponta para o Supabase de produção**, então teste manual local mexe em dados reais. Usar usuário e board de teste. Para testes de UI, usar o build com Supabase falso: `VITE_SUPABASE_URL=http://127.0.0.1:9 VITE_SUPABASE_ANON_KEY=fake` + Playwright com respostas mockadas.
- Nada de regra rígida onde dá para ser dinâmico.
- Commits pequenos, por etapa. Pode subir na `main` quando a etapa estiver verde.
- Mudança no banco: escrever a migration em `supabase/migrations/` e me passar o SQL para eu rodar no SQL Editor. Antes, conferir o estado atual com consultas só de leitura.

## Primeiro: checar se o que já foi feito está ok (rápido)
1. `npm ci && npm run lint && npm test && npm run build`: tudo verde.
2. Revisar o último commit `b151c26` (`fix(sync): servidor collab vira o único escritor…`):
   - `server/collab-server/src/socket/socketHandlers.js`: novo evento `board:op` (`CLIENT_EVENTS.BOARD_OP`), com fila por socket, cache de permissão de 30 s e `refreshIdleBoardRoom`.
   - `server/collab-server/src/db/persistence.js` (flush do Spaces): esvazia a fila antes do await e devolve tudo se der erro.
   - `server/collab-server/src/services/flushBoard.js`: `dirty=false` antes do await, volta a `true` no erro.
   - `server/collab-server/src/services/roomManager.js`: retry de flush com backoff; `getOrLoad` com `finally`.
   - `src/collab/core/collabClient.js`: `isOwnOp`/`submitBoardOp`; WebSocket em produção (`VITE_COLLAB_POLLING_ONLY=1` força polling).
   - `src/collab/board/ops/BoardCollabContext.jsx`: ramo `offRoom` usa `submitOffRoomAction`, sem salvar o board inteiro pelo navegador.
   - `src/collab/board/sync/BoardCollabBridge.jsx` e `src/collab/core/CollabProviderRoot.jsx`: filtram eco por `opId`, não por usuário.
   - `src/context/app/useBoardsRealtime.js` + `markBoardLocalEdit`: refetch mantém a versão local de board editado há menos de 4 s.
   - `src/hooks/useSmartViewCardCompletion.js`: só faz `flushBoardPersist` sem collab.
3. **Ainda NÃO testado de verdade** (precisa de collab-server rodando + Supabase de teste):
   - duas abas no mesmo board;
   - editar de fora da sala (Importante, Diário) com outra pessoa dentro do board;
   - derrubar o collab e conferir o fallback.
   
   Teste isso, ou escreva testes de integração do servidor com um mock do Supabase.
4. Confirmar que o nginx da VPS faz upgrade de WebSocket (`deploy/nginx-connection-upgrade.conf`). Se não fizer, o socket.io continua em polling sozinho, sem quebrar.

## De onde continuar (estava no meio disto)
**Migration nova para `upsert_board_full`** (a função atual está em produção; pegar com `select pg_get_functiondef('public.upsert_board_full'::regproc)`):
- **Desempenho (o "engarrafamento")**:
  - Hoje cada save faz `ON CONFLICT DO UPDATE` em TODAS as listas, cards e subtasks, mesmo sem mudança. Isso gera centenas de eventos no Realtime, e cada cliente refaz `fetchBoards` de todos os boards.
  - Adicionar `WHERE (colunas) IS DISTINCT FROM (EXCLUDED.colunas)` em cada upsert, inclusive no `boards`, e não mexer em `updated_at` quando nada mudou.
- **Bug de compartilhamento**: quando um editor (não dono) salva, o `group_id` e o `position` do dono são sobrescritos e o board muda de pasta para o dono. Para não-dono, manter `group_id`/`position` atuais.
- **Segurança (IDOR)**:
  - IDs de listas, cards e subtasks do payload não são checados contra o board. Um editor do board A pode mandar o id de um card do board B e:
    - roubá-lo, porque `list_id = EXCLUDED.list_id`;
    - renomear listas de B;
    - apagar subtasks de cards de B.
  - Rejeitar ids que existam em board onde o usuário não tem escrita. Permitir mover entre boards em que ele é editor nos dois; antes, conferir como `src/components/Board/boardCardBulkOps.js` move cards para outro quadro.
- Depois disso: o `useBoardsRealtime` refaz `fetchBoards` de **todos** os boards a cada evento. Trocar por refetch só do board afetado, ou ignorar eventos de boards com sala collab ativa.

## O que eu pedi (tudo isso, no app inteiro)

### 1. Bugs e itens das minhas anotações (board "Objetivos - DailyWays", última imagem): corrigir todos e testar
**Corrigir:**
- O cursor de outra pessoa, quando ela rola a página, deve seguir normalmente na minha visão, sem teletransportar.
- Arrastar card para as bordas deve mover o scroll horizontal do board.
- Ao arrastar tarefa para os lados, o app reconhece a posição errada.
- Se pego a tarefa muito rápido, às vezes ela não fica correspondente ao mouse.
- Ao escolher a cor do card, às vezes ele pisca forte entre a cor anterior e a nova.
- "Muitas alterações de uma vez, aguarde um instante": alterações se sobrescrevendo, em loop infinito de salvar e receber o valor antigo.
- Capa não aparece nas tasks; deve ser definida automaticamente ao colocar o anexo.
- Ao criar um board novo, a sincronização buga e ele é criado sem as listas padrão.
- O app esquece com frequência as alterações em multi-user (**URGENTE**).
- Ctrl+Z, Ctrl+Y (e Shift+Z) e outros atalhos de teclado bugam no Spaces.
- Lentidão no "Sincronizar boards".
- **"Testando"** (considerar ainda abertos):
  - layout bugando muito em Compartilhar, ao sair e ao atualizar o estado do board (**URGENTE**);
  - salvamento muito lento no banco e fluxo engasgado, apagando alterações feitas rapidamente;
  - ações de vários usuários em tempos próximos colidindo;
  - engarrafamento, lag e problemas de desempenho ao salvar, mudar cor e mudar infos das tasks (**URGENTE**).

**Melhorar:**
- Visão Geral, Diário, Importante e Planejado.
- Navegação do Spaces no celular e navegação do celular em geral.
- Design dos cards abertos (detalhes do card).
- Poder selecionar as colunas também.
- Boards não sincronizando direito (entram lentamente ou não carregam).
- Permitir arrastar o chat mesmo estando dentro de uma conversa.
- Otimizar imagens no Spaces: imagens grandes travam o space. Gerar miniaturas, carregar sob demanda e limitar a resolução no canvas.

**Alterar:**
- "Minha Conta" ao clicar no perfil → "Meus Contatos".
- Deixar a parte "Outros" da navegação lateral fixa.

**Adicionar:**
- Botão de "papel" nas pastas dos boards para criar boards mais rápido.
- Histórico de grupos na área "Convites" das Configurações.
- Lista de amigos (facilitar adicionar amigos nos lugares).
- No Spaces:
  - desenhos vetoriais;
  - conectar coisas automaticamente;
  - exportar seleção, frame ou página como imagem.

### 2. Redesign completo de UI/UX (o app inteiro)
- Está tudo exagerado. Manter a essência e a estrutura (a estrutura é boa, a execução é péssima), mas fazer um redesign com outro layout e outra UI. **Prioridade: Visão Geral e Spaces**, mas é o app TODO:
  - sidebar, board, detalhes da tarefa, configurações, menus de clique direito e de expandir;
  - Diário, Importante, Planejado, Contatos, chat, notificações, login.
- **Menos informação por tela.** Hoje é contraintuitivo, com muita coisa duplicada ou em lugar ruim; falta pensar no usuário.
- **Sidebar**: exagerada, pouco intuitiva, pouco descritiva e fácil de confundir. Redesenhar.
- **Configurações**: tem coisa duplicada, fora do lugar e faltando. Reorganizar.
- **Contatos**: não é excesso, mas precisa reestruturar e redesenhar tudo, e está bem quebrado.
- **Remover o que é excesso sem objetivo**, por exemplo o **streak** (e o que mais você achar). **Os widgets (Modo Foco, Rádio) NÃO são excesso.**
- **Mobile e outros formatos**: adaptar tudo corretamente.
- **Acessibilidade**:
  - contraste, foco visível, navegação por teclado, ARIA, `prefers-reduced-motion`;
  - tamanhos de toque e leitores de tela.
- **Cores**: os temas são bons, mas há cores jogadas dentro deles que não combinam com a escolha. Tudo tem que derivar dos tokens do tema.
- **Animações**: eu AMO o estilo (animadinho, fluido, jelly, sweet, suave), mas hoje são bugadinhas, fogem um pouco ou faltam. Criar um sistema único de motion (tokens de duração e easing tipo spring) e aplicar de forma consistente.
- **Drag and drop do app INTEIRO**: é uma das coisas mais bugadas e está fora do padrão. Padronizar: boards, listas, cards, sidebar, Spaces e chat.
- **Tutoriais interativos / onboarding** para quem chega e para as funções principais.
- **Sincronização 100% rápida e instantânea**: UI otimista e nada de "valor velho voltando".

### 3. Novas funções
Adicionar novas funções em todas as categorias que você julgar boas, sem inchar a interface. Remover o que for excessivo.

### 4. Teste de cibersegurança
Teste de segurança completo do app (é meu, está autorizado): tentar invadir, achar e corrigir vulnerabilidades.
- **Cobrir:**
  - RLS de todas as tabelas, testando como `anon` e como usuário comum tentando ler e escrever dados de outros;
  - funções SECURITY DEFINER e o IDOR do `upsert_board_full` (acima);
  - buckets do Storage;
  - collab-server: autorização por sala/board/space, `board:op`, rate limit, presença, `dev:prank`;
  - XSS (descrições, títulos, chat, links de subtarefa, nós de texto do Spaces);
  - CSP e cabeçalhos;
  - fluxo de convite e de reset de senha;
  - upload de arquivos (tipo e tamanho);
  - vazamento de e-mail e id de usuários.
- **Não destruir dados de produção**: preferir consultas só de leitura e usuários de teste.
- Corrigir o que achar (código + migration) e documentar em `docs/` o que foi testado e o resultado.

### 5. Entrega
- Atualizar `docs/VISTORIA-2026-10.md` (ou criar um novo relatório) com antes/depois, o que foi testado e o que não deu.
- Subir na `main`.
- Lembrar dos passos da VPS sem executá-los:
  1. `git pull && npm ci`;
  2. reiniciar a screen `DailyWays` (`npm run start:vps` já faz o build);
  3. tirar `NODE_ENV=production` do `.env.local` da VPS;
  4. apagar `debug-ed15fe.log`;
  5. rodar as migrations novas no SQL Editor.

## Ordem sugerida
1. Check rápido acima.
2. Migration do `upsert_board_full` (desempenho + compartilhamento + IDOR).
3. Restante dos bugs de sync.
4. Pentest e correções.
5. Drag and drop.
6. Design system (tokens, cores, motion, acessibilidade, responsivo).
7. Redesign tela por tela (Visão Geral e Spaces primeiro).
8. Novas funções e onboarding.
9. Relatório e push.
