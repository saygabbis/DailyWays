# Redesign, correções e segurança: outubro de 2026

Continuação da [vistoria](VISTORIA-2026-10.md). Base: `2e1250c`. Tudo em commits pequenos na `main`, cada um com lint 0/0, `npm test` e build verdes.
**Nada disso está no ar ainda: falta o deploy na VPS** (passos no fim), e o site continua com a versão antiga até lá.

## Estado dos testes

| | Resultado |
|---|---|
| `npm run lint` | 0 erros, 0 avisos |
| `npm test` | 75 vitest (front + SQL/segurança em PGlite) + 4 protocolo + 19 servidor |
| `npm run test:e2e` | 16/16: Supabase falso + collab real + 2 navegadores |
| `npm run build` | ok |

**Testado de verdade:** tudo acima, mais capturas de todas as telas (desktop e celular, escuro e claro) com `node e2e/screens.mjs`.
**Não testado:** contra o Supabase de produção (o `.env.local` aponta para produção, então não rodei o app local com ele); as configurações do Supabase Auth (se e-mail não confirmado entra); login social com a CSP aplicada; o Storage real (`createSignedUrls`, upload de miniatura): só no Storage emulado.

## Sincronização e banco (o urgente)

- **Alterações de várias pessoas sumindo:** as edições eram localizadas pelo `listId` (se outra pessoa movia o card, a edição se perdia); o LEAVE passava na frente das ops na fila; o snapshot ficava velho depois de reconectar; o token expirava no meio do flush; o board novo corria contra o join; o `.in()` com muitas ids estourava a URL e perdia subtarefas. Tudo corrigido, com teste de integração e E2E.
- **Ações quase simultâneas:** fila única por socket, deduplicação por `opId`, outbox no cliente com rebase das pendentes sobre o confirmado.
- **"Muitas alterações" em loop e saves lentos:** edições seguidas do mesmo item viram uma op só, e a `upsert_board_full` v3 só grava o que mudou (`IS DISTINCT FROM`); o E2E confere que linhas sem mudança não são reescritas.
- **IDOR e compartilhamento:** a RPC recusa ids de outro board; quem não é dono não muda pasta/posição do dono (trigger `boards_guard_owner_fields`).
- "Sincronizar boards" mais rápido: o Realtime recarrega só o board afetado (antes todos, a cada linha) e as consultas saem em lote.

## Segurança

Pentest com 14 ataques reproduzidos e bloqueados num espelho PGlite (detalhes em [SEGURANCA-2026-10.md](SEGURANCA-2026-10.md)): convites aceitos depois de vencer ou com papel inventado, convidado se promovendo a dono, contatos/solicitações/mensagens editáveis por quem não devia, presença pública, busca de contatos com curinga, login por username sem limite (agora `login_email_for` com 8 tentativas por 15 min), links `javascript:` em subtarefas e anexos, buckets sem limite de tamanho e tipo. CSP aplicada (não só "report") e HSTS.

## Bugs das notas do board "Objetivos"

| Bug | O que era / o que mudou |
|---|---|
| Mouse de outra pessoa teletransporta ao rolar | o cursor remoto não era republicado no scroll |
| Rolagem automática na borda ao arrastar, posição errada ao arrastar de lado, card pego rápido não segue | DnD refeito com dnd-kit: a prévia segue o ponteiro e rola sozinho em contêiner aninhado (board na horizontal, lista na vertical), o que o hello-pangea não suportava |
| Cor do card piscando / valor velho voltando | a op remota era aplicada por cima do estado local; agora o cliente guarda o estado confirmado pelo servidor e reaplica as pendentes por cima |
| Capa não aparecia / capa automática ao anexar | a gravação direta na tabela era sobrescrita pelo flush do servidor; agora uma escrita só, a 1ª imagem anexada vira capa, URLs das capas em lote (antes 2 requisições e um canal Realtime por card) |
| Board novo sem listas | o servidor carregava o board vazio e o flush apagava as listas padrão; agora tudo é inserido em lote e o collab só carrega depois |
| Ctrl+Z / Ctrl+Y / Shift+Z quebrados no Space | o undo do board disparava junto; AltGr e `e.code` tratados |
| Engarrafamento de desempenho | Space: componentes assinavam o store inteiro (re-render a cada quadro de pan), câmera fazia dispatch global e ia ao banco a cada movimento |

Achados no caminho: o registro de nós mapeava `draw` em vez de `drawing` (todo desenho virava nota amarela); o texto das notas crescia ao afastar o zoom e vazava; no celular a coluna principal do card sumia; Shift+Backspace no título excluía o card; Ctrl+Z no texto desfazia o board; a prioridade "urgente" ia para o fim ao ordenar (`|| 4`).

## Redesign

- **Design system:** tokens `--dw-*` derivados do tema e da cor de destaque, um só sistema de movimento (spring/jelly/suave) que respeita "reduzir movimento", foco visível, texto sobre a cor de destaque com contraste calculado. Fontes carregadas sob demanda.
- **Sidebar:** mais limpa, "Hoje" (Diário, Importante, Planejado) aceita cards soltos, rodapé fixo com Foco/Rádio, Contatos, Configurações e Ajuda; "+" dentro de pasta cria board ali.
- **Header:** sem streak; busca compacta; conversas com contador; desfazer/refazer do board ao lado do título; menu da conta com "Meus contatos". Sem botões flutuantes por cima do conteúdo.
- **Celular:** barra inferior (Início, Diário, Importante, Planejado, Navegar), header que cabe, card em tela cheia com rolagem única.
- **Visão Geral:** saudação, "Foco de hoje" com concluir no lugar, próximos 7 dias, grade de boards e spaces, panorama de prioridades recolhível (saíram 6 indicadores + 10 painéis).
- **Card:** caminho (board › lista), Diário e menu ⋯ no topo, título em várias linhas, propriedades em linhas compactas, sem rodapé de excluir.
- **Board:** selecionar colunas (Ctrl+clique) para pintar, selecionar as tarefas ou excluir em grupo; barra de presença embaixo à direita.
- **Importante / Planejado / Diário:** sem banners gigantes nem streak; prioridade em português.
- **Configurações:** abas agrupadas (Conta, Colaboração, Preferências); a aba Contatos duplicada saiu (bloqueados foram para Privacidade); histórico de convites filtrável.
- **Contatos:** busca no topo, amigos em destaque, solicitações ao lado.

## Spaces

- Abre enquadrando o conteúdo; câmera lembrada por aparelho.
- Imagens: reduzidas para no máximo 2560 px (WebP quando compensa), miniatura de 512 px para quando aparecem pequenas, URLs assinadas em lote.
- **Caneta vetorial** com cor e espessura; traço suavizado que estica junto com o nó.
- **Conexão rápida:** "+" nos lados do nó selecionado cria um nó conectado; conectores terminam na borda.
- **Exportar PNG:** seleção, frame ou página (botão direito ou Ctrl+Shift+E).
- Celular: inspetor começa fechado, ferramentas acima da navegação.

## O que ficou para depois

- Layout dos modais de sair/compartilhar: não revisei a fundo nesta rodada (só o acesso pelo header).
- Tutorial interativo novo (o onboarding atual continua).
- Calendário mensal no Planejado (hoje é faixa de 14 dias + grupos).
- Desenho com pressão/borracha e conector arrastável a partir do "+".

## Banco: SQL para rodar no SQL Editor

Já aplicada: `20261024190000_upsert_board_full_diff_and_idor.sql`.
Faltam, nesta ordem, **junto com o deploy** (o login por username do cliente antigo para de funcionar depois da segunda):

1. `supabase/migrations/20261024200000_upsert_board_full_day_category.sql`
2. `supabase/migrations/20261024210000_security_pentest_fixes.sql`

## Deploy na VPS (só com o seu OK)

```bash
ssh -o BatchMode=yes vps 'cd /home/gabbis/Bots/DailyWays && git pull --ff-only && npm ci'
```

1. Rodar as duas migrations acima no SQL Editor.
2. No `.env.local` da VPS, tirar `NODE_ENV=production` (o `npm ci` precisa das devDependencies para o build).
3. Reiniciar a screen `DailyWays` (Ctrl+C, esperar sair, `npm run start:vps`).
4. Conferir `curl http://127.0.0.1:2529/health` e `https://dailyways.saygabbis.cloud/` com 200.
5. Pode apagar o `debug-ed15fe.log` que sobrou na pasta.
