# Teste de segurança: outubro de 2026

Teste autorizado pela dona do app. **Nada foi alterado nem lido de dados pessoais em produção**: o
banco de produção só foi consultado em modo leitura (definições de funções, políticas e
contagens). Cada ataque foi reproduzido num **espelho** do banco (Postgres embutido, PGlite) com as
funções e políticas copiadas de produção, rodando como o papel `authenticated`/`anon`, igual a uma
chamada pela API.

- Espelho: `e2e/schema.sql` + `supabase/tests/securityMirror.sql`
- Ataques: `supabase/tests/security.test.js` (roda no `npm test`)
  - **antes** das migrations, o teste exige que cada ataque funcione, para provar que o espelho reproduz a falha;
  - **depois**, exige que seja bloqueado e que o uso normal continue funcionando.

## O que foi encontrado

| # | Gravidade | Falha | Correção |
|---|---|---|---|
| 1 | **Crítica** | Convidado editava o próprio convite (board e papel) e, ao aceitar, virava membro de **qualquer** board, até como `owner` | Trigger: convidado só recusa ou esconde; `accept_*` respeita a validade e só dá editor/leitor |
| 2 | **Crítica** | Com qualquer convite (pendente **ou já aceito**) para um board, inseria/alterava `board_members` desse board com qualquer usuário e papel. Também: quem foi removido voltava sozinho | Policies dos convidados removidas; entrar só por `accept_board_invitation` |
| 3 | Alta | IDOR na `upsert_board_full`: editor do board A mandava ids de cards/listas do board B e os roubava, renomeava ou apagava subtarefas | Ids de outro board recusados; mover card exige escrita nos dois (migration `20261024190000`) |
| 4 | Alta | Editor de board/space trocava `owner_id` para si e virava dono | Trigger: `owner_id` imutável pela API |
| 5 | Alta | Editor/admin apagava o board inteiro do dono | DELETE só para o dono; os outros "saem" |
| 6 | Alta | Qualquer um se colocava como "contato" de qualquer pessoa e lia o perfil completo dela | `contacts` sem INSERT pela API; só nasce de pedido aceito |
| 7 | Alta | Quem recebia um pedido de contato trocava o remetente e criava contato com quem não pediu | Trigger: só muda o status (pendente → aceito/recusado) |
| 8 | Alta | `get_email_by_username` sem login devolvia o e-mail de qualquer username | Removida. Login por username usa `login_email_for(username, senha)`, que só devolve o e-mail se a senha bater, com bloqueio após 8 erros em 15 min. Recuperar senha: pelo e-mail |
| 9 | Média | Leitor de space apagava comentários e assets | Policies separadas: leitura para membros, escrita/remoção para editores |
| 10 | Média | Reação em mensagem de conversa da qual você não participa | Checa participação; emoji com até 16 caracteres |
| 11 | Média | "Visto por último" de qualquer usuário legível (ignorava a opção de privacidade) | Só a própria linha; online dos outros só por `is_user_online()` |
| 12 | Média | Busca de contatos com `%` e limite sem teto listava todos os usuários | Curingas tratados como texto; máximo de 20 resultados |
| 13 | Média | Buckets sem limite de tamanho; chat aceitava qualquer tipo de arquivo (HTML, SVG…) | Limites iguais aos do app; chat só aceita imagens; HTML/JS/executáveis recusados no upload |
| 14 | Média | Collab: o cliente escolhia o nome e a foto da própria presença (aparecia no cursor como outra pessoa) e, sem nome, o servidor mostrava aos outros o começo do e-mail | Nome, foto e cor vêm sempre do perfil |
| 15 | Média | Collab: uma op na sala do board A podia mirar o board B (mudava o estado local de quem estava na sala) e `UPDATE_BOARD` trocava `lists`/`id` inteiros | Op de outro board recusada; `UPDATE_BOARD` só muda título, emoji e cor |
| 16 | Baixa | Links `javascript:`/`data:` em subtarefas, anexos, nós do Space e chat | Só http(s) vira link (front, RPC e CHECK no banco) |
| 17 | Baixa | CSP só em modo aviso e sem HSTS | CSP **aplicada** (ganha o Supabase/collab do `.env`), HSTS, `form-action`, `media-src` para o rádio. `DW_CSP_REPORT_ONLY=1` volta ao modo aviso |

Suspeitas que **não** eram exploráveis, conferidas no espelho:

- mover a própria mensagem para outra conversa;
- mover o próprio comentário para um card de outro board.

O Postgres exige que a linha atualizada continue visível pela política de SELECT, e ela deixa de ser. As travas novas ficam como defesa extra.

## Conferido e ok

- **RLS ligada** em todas as tabelas.
- **Anônimo** não executa função nenhuma, exceto:
  - login/cadastro (`login_email_for`, `check_username_available`);
  - helpers de RLS, que sem sessão sempre respondem "não".
- **Storage**:
  - `task-attachments` com tipos e tamanho limitados, acesso pelo card;
  - `space-assets` pelo space;
  - `chat-attachments` pela conversa;
  - `avatars` só na pasta do próprio usuário.
- **Collab-server**:
  - JWT verificado por JWKS;
  - acesso por sala conferido no banco com o token do usuário;
  - limite de ops por usuário e por IP;
  - `dev:prank` só para a lista de devs e desligado por padrão em produção.
- **XSS**:
  - React escapa texto;
  - não há `dangerouslySetInnerHTML` nem `innerHTML` no front;
  - React 19 também bloqueia `javascript:` em `href`.
- **Arquivos expostos**: `/.env`, `/.git/config` e o `debug-*.log` não são servidos; o site devolve o `index.html`.

## O que não deu para testar

- **Configuração do Supabase Auth**:
  - confirmação de e-mail obrigatória;
  - limites de taxa do login;
  - provedores OAuth.

  O conector não expõe isso. Confira no painel: Authentication → Providers / Rate Limits. Se alguém conseguir entrar com e-mail **não confirmado**, as policies de convite por e-mail confiam nesse e-mail.
- Ataques de **negação de serviço** no collab-server e no Supabase. Não foram feitos de propósito.
- **Login social** com a CSP aplicada. O redirecionamento do OAuth é navegação e não é bloqueado pela CSP, mas vale entrar uma vez com o Google depois do deploy.

## Como aplicar

No SQL Editor, **em ordem**, junto com o deploy (o app novo funciona com ou sem elas, mas o login por
username do app antigo para de funcionar depois da `20261024210000`):

1. `supabase/migrations/20261024200000_upsert_board_full_day_category.sql`
2. `supabase/migrations/20261024210000_security_pentest_fixes.sql`

A `20261024190000` já está aplicada em produção.
