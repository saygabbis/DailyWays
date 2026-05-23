# Whiteboard

Arquitetura em camadas para o canvas dos Spaces.

## Pastas

| Pasta | Conteúdo |
|-------|----------|
| `canvas/` | `CanvasShell` (ex-CanvasEngine), layers e overlays |
| `interaction/` | Viewport, atalhos, snap, transform, hooks de input |
| `core/` | Lógica pura: histórico, páginas, ops, geometria, align |
| `nodes/` | `registry.js` + tipos em `nodes/types/` |
| `panels/` | Toolbar, inspector, context menu |
| `shared/` | Constantes e helpers partilhados |
| `legacy/` | Componentes antigos não usados (remover quando confirmado) |

## Stores

- `whiteboardDocumentStore` — nós, conectores, histórico, collab hydrate
- `whiteboardSelectionStore` — seleção, ferramenta, edição, clipboard UI
- `whiteboardStore` — fachada `useWhiteboardStore` (compatibilidade)

## Collab

- `WhiteboardCollabSync` montado em `SpaceView` (fora do canvas)
- `useCollabNodeApi()` — ramo único online/offline para mutações
- Presença reutiliza `useCollabPresence` do Board

## Novo tipo de nó

1. Criar `nodes/types/MeuNode.jsx` (usar `BaseNode` + `useEditableNodeField` se for texto)
2. Registar em `nodes/registry.js`
3. Opcional: entrada em `shared/constants.js` se for ferramenta de criação
