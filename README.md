# DailyWays 🚀
---

## 📖 Visão geral

**DailyWays** é um aplicativo de produtividade visual construído com **React 19**, **Vite 7** e **Supabase**. Ele combina **boards estilo kanban**, **listas**, **tarefas**, **subtarefas**, **visualizações inteligentes** (My Day, Planned, Important) e **colaboração em tempo real** entre abas/usuários.

A arquitetura evolui para suportar um **detalhe de tarefa avançado** com comentários, anexos, histórico de atividades e designadores.

---

## 🛠️ Stack principal

- **Frontend**: React 19, Vite 7, Tailwind (custom CSS), date‑fns, lucide‑react, @hello‑pangea/dnd
- **Backend**: Supabase (PostgreSQL), SQL migrations, Realtime
- **Utilities**: date‑fns, custom utils in `src/utils/`

---
## 📡 Servidor e Pacote Compartilhado (Collab)

Para viabilizar **colaboração em tempo real** e **sincronização de estado** (como mover cards e listas instantaneamente entre usuários), o DailyWays utiliza uma arquitetura separada em monorepo para a camada de colaboração:

### 1. Servidor (`server/collab-server/`)
Uma aplicação Node/Express dedicada a conexões WebSocket via **Socket.io**.
- **Autenticação Segura:** Valida tokens JWT do Supabase via biblioteca `jose`.
- **Rooms por Contexto:** Gerencia canais isolados para `board:` e `space:`, garantindo que eventos só sejam emitidos para os usuários no mesmo projeto.
- **Processamento de Operações:** Recebe operações do tipo `op:submit`, valida permissões, salva estado via RPC no Supabase e faz broadcast via `op:applied`.
- **Presença:** Sincroniza estado de usuários conectados na sala (quem está online, cursores, etc).

### 2. Pacote de Protocolo (`packages/collab-protocol/`)
Biblioteca npm interna (`@dailyways/collab-protocol`) compartilhada tanto pelo frontend (React) quanto pelo backend (Node.js).
- **Tipagem e Contrato Único:** Evita divergência de nomenclaturas de eventos entre front e back.
- **Constantes Essenciais:** Centraliza constantes de eventos do servidor (`room:join`, `op:submit`, `op:applied`) e validação dos tipos de actions suportadas para boards (ex: `MOVE_CARD`, `ADD_SUBTASK`).
- **Helpers de Room:** Fornece utilitários para gerar IDs de canais (`roomIdForBoard`, `roomIdForSpace`).
- **Validação:** Contém a lógica (`applyField.js`, `boardApply.js`, `validate.js`) para garantir que os payloads que trafegam na rede são válidos e bem formatados.

Essa divisão garante uma evolução escalável: se um novo evento colaborativo for necessário, basta declará-lo no `collab-protocol`, e ele estará automaticamente tipado e disponível no cliente e no servidor.



## 📂 Estrutura de diretórios

```text
packages/
└─ collab-protocol/     # Protocolo de comunicação compartilhado (tipos, eventos)

server/
└─ collab-server/       # Servidor Node.js/Socket.io para realtime e persistência

src/
├─ components/          # UI do app (boards, task detail, smart views)
├─ context/             # Estado global e providers (AppContext)
├─ services/            # Integração com Supabase (boardService, …)
├─ utils/               # Funções auxiliares (ex.: cardDateTime.js)
└─ index.jsx            # Entrada da aplicação (React 19)

supabase/
└─ migrations/          # Scripts SQL de migração e definição de banco
```

---

## 📦 Scripts úteis

O projeto utiliza *workspaces* do npm para gerenciar o frontend, backend colaborativo e pacotes compartilhados.

```bash
npm install          # Instala dependências de todos os workspaces

# Desenvolvimento
npm run dev          # Inicia o dev server do frontend (Vite)
npm run dev:collab   # Inicia o dev server do backend colaborativo (Node.js) com watch
npm run dev:all      # Inicia frontend e backend colaborativo simultaneamente

# Produção & Build
npm run build        # Build de produção do frontend
npm run preview      # Serve a build do frontend localmente
npm run start:collab # Inicia o servidor Node.js do backend em modo produção
npm run start:vps    # Script de inicialização para deploy em VPS

# Testes e Qualidade
npm run lint         # Executa o linter (ESLint)
npm run test         # Executa os testes do protocolo e do servidor colaborativo
```

---

## 📈 Fluxos centrais atuais

### Boards
- Persistidos no Supabase via `src/services/boardService.js`
- Estado global em `src/context/AppContext.jsx`
  - Gerencia boards, grupos, spaces, persistência otimista, realtime, filtros e helpers.

### Task Detail
- Modal em `src/components/TaskDetail/TaskDetailModal.jsx`
- Suporta título, descrição, prioridade, datas, recorrência, labels, cor, subtarefas, etc.

---

## 🗄️ Banco de Dados & Migrations

Todas as alterações estruturais do banco de dados estão versionadas na pasta `supabase/migrations/`.

### Como aplicar migrations no Supabase

A forma recomendada de manter seu banco de dados atualizado é utilizando a **Supabase CLI**.

1. Faça o login na CLI (caso ainda não esteja autenticado):
   ```bash
   npx supabase login
   ```
2. Aplique as migrations pendentes:
   ```bash
   npx supabase db push
   ```

> **Alternativa Manual:** Caso prefira não usar a CLI, você pode copiar o conteúdo dos arquivos SQL da pasta `supabase/migrations/` e executá-los na ordem correta (data mais antiga para a mais recente) diretamente no **SQL Editor** do painel web do Supabase.

---

## 🚀 Próximos passos recomendados

### Imediato
- Aplicar migrations no Supabase.
- Validar storage bucket e policies.
- Verificar realtime das novas tabelas.

### Fase de Produto
- Implementar serviços front‑end:
  - `attachmentService`
  - `commentService`
  - `activityService`
  - `assigneeService`
- Integrar hooks específicos no **Task Detail**.
- Exibir seções reais de attachments, comments, activity e assignees no modal.

---

## 🤝 Contribuição

Contribuições são bem‑vindas! Por favor, abra uma *issue* antes de submeter um *pull request*.

1. Fork o repositório.
2. Crie uma branch `feature/descricao`.
3. Implemente e escreva testes quando necessário.
4. Submeta o PR.

---

## 📄 Licença

Este projeto está licenciado sob a licença MIT – veja o arquivo `LICENSE` para detalhes.

---

*Este README foi atualizado para fornecer uma visão clara, estética premium e instruções completas para desenvolvedores e usuários.*
