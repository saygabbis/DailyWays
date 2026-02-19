# Configuração do Supabase (DailyWays)

1. Crie um projeto em [Supabase Dashboard](https://supabase.com/dashboard).
2. Em **Project Settings > API**: copie **Project URL** e **anon public** para `.env.local`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. **Authentication > URL Configuration** (obrigatório para OAuth):
   - **Site URL**: use a URL do seu app (ex.: `http://localhost:5173` em dev ou `https://seudominio.com` em produção).
   - **Redirect URLs**: adicione a mesma URL (ex.: `http://localhost:5173` ou `http://localhost:5173/**`). Sem isso, o login social redireciona mas pode dar `server_error` ao voltar.
4. Em **Authentication > Providers**:
   - Ative **Email** e marque **Confirm email**.
   - Ative **Google**, **GitHub** e **Azure** (Microsoft); configure Client ID/Secret de cada um.
5. Em **Authentication > Settings** (ou **Authentication > Providers**):
   - Habilite **Enable Custom SMTP** se quiser enviar emails de confirmação por seu próprio SMTP (opcional).
   - Ative **MFA** (TOTP) e **Identity linking** (ou **Manual linking** / link de identidades OAuth). Sem isso, os botões «Vincular» nas Configurações do app mostrarão erro.

   **E-mails de confirmação não chegam?** Com o SMTP padrão do Supabase, os e-mails podem ir para **spam** ou ter limite de envio. Use **Custom SMTP** (veja seção abaixo).

---

### Custom SMTP com Gmail (pessoal ou conta do projeto)

Você **pode usar seu e-mail pessoal** (ex.: gaffonsoxx@gmail.com) ou criar uma conta só para o app (ex.: dailyways@gmail.com). O Gmail exige **senha de app** (não use a senha normal da conta).

1. **Conta Gmail**
   - Use a que preferir: pessoal (gaffonsoxx@gmail.com) ou nova (dailyways@gmail.com). Uma conta dedicada evita misturar e-mails do app com o pessoal e facilita trocar depois.

2. **Ativar verificação em 2 etapas**
   - Google Account → Segurança → Verificação em duas etapas → Ativar.

3. **Criar senha de app**
   - Google Account → Segurança → Verificação em duas etapas (já ativa) → **Senhas de app** (ou acesse [Senhas de app](https://myaccount.google.com/apppasswords)).
   - Selecione “Outro (nome personalizado)”, digite ex.: `DailyWays Supabase`.
   - Clique em **Gerar**. Copie a senha de 16 caracteres (ex.: `abcd efgh ijkl mnop`) — use **sem espaços** ao colar no Supabase.

4. **Preencher no Supabase**
   - **Authentication** → **Settings** (ou **Providers** → role até **Custom SMTP**).
   - Ative **Enable Custom SMTP**.
   - Preencha:
     - **Sender email**: o Gmail que você escolheu (ex.: `gaffonsoxx@gmail.com` ou `dailyways@gmail.com`).
     - **Sender name**: ex. `DailyWays`.
     - **Host**: `smtp.gmail.com`
     - **Port**: `587`
     - **Username**: o mesmo e-mail do Sender (ex.: `gaffonsoxx@gmail.com`).
     - **Password**: a **senha de app** de 16 caracteres (sem espaços).
   - Salve. Os e-mails de confirmação passam a sair por esse Gmail e o limite do SMTP padrão do Supabase deixa de valer para esses envios.

6. **Banco de dados**: no painel Supabase, abra **SQL Editor** e execute, **nesta ordem**:
   - `supabase/migrations/20250218120000_initial_schema.sql` (tabelas, RLS, `get_email_by_username`);
   - `supabase/migrations/20250218130000_trigger_handle_new_user.sql` (cria profile automaticamente ao criar usuário);
   - `supabase/migrations/20250218140000_username_and_has_password.sql` (coluna `has_password`, username do signup no perfil, login por username case-insensitive). Se você já tem usuários, essa migration também corrige o username deles a partir do que foi enviado no cadastro (ex.: **saygabbis** em vez da parte do e-mail).

7. **Microsoft (Azure)** — checklist para evitar `server_error` / "Unable to exchange external code":
   - **Supabase**: **Authentication > Providers > Azure** — **Client ID** (Application (client) ID do Azure) e **Client secret** (o **Value** do secret, não o Secret ID; confira que não expirou).
   - **Supabase**: **Authentication > URL Configuration** — a URL do seu app (ex.: `http://localhost:5173`) deve estar em **Redirect URLs** (e **Site URL** em dev).
   - **Azure** (portal.azure.com) > **App registrations** > seu app:
     - **Authentication** > **Platform configurations** > **Web** (não SPA).
     - **Redirect URI**: adicione **exatamente** (sem espaços, sem barra no final): `https://<project-ref>.supabase.co/auth/v1/callback` (o `<project-ref>` está na URL do projeto Supabase, ex.: `https://abcdefghij.supabase.co` → ref é `abcdefghij`).
     - **Certificates & secrets**: use o **Value** do client secret (não o Secret ID) no Supabase; se criou um secret novo, use o valor assim que gerado (ele só aparece uma vez).
     - **API permissions** (opcional mas recomendado): Microsoft Graph > Delegated > `User.Read`, `email`, `openid`, `profile`.
   - Se ainda der erro: confira que no Azure a Redirect URI está **exatamente** igual à que o Supabase mostra no painel do provider Azure (copie/cole).

Depois disso, o app estará pronto para uso.

---

### Realtime — Sincronização entre abas / usuários

Para que o app sincronize automaticamente boards entre duas abas abertas simultaneamente (ou entre usuários diferentes com acesso ao mesmo board), as tabelas precisam fazer parte da publicação `supabase_realtime`.

**Opção A — via migration (recomendado)**

No **SQL Editor** do Supabase, execute:

```
supabase/migrations/20250219100000_realtime_publication.sql
```

O script usa blocos `DO/EXCEPTION` e é idempotente (pode ser re-executado sem erro).

**Opção B — pelo Dashboard**

1. Acesse **Database → Replication** no painel Supabase.
2. Em **"supabase_realtime"**, clique em **"0 tables"** (ou no número atual).
3. Ative os toggles para `boards`, `lists`, `cards` e `subtasks`.

> **Nota:** RLS continua aplicado ao Realtime — cada usuário só recebe eventos das linhas que tem permissão de ler.
