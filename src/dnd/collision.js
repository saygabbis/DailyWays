import { closestCenter, closestCorners, pointerWithin, rectIntersection } from '@dnd-kit/core';

/**
 * Detecção de colisão por tipo do item arrastado. Cada tipo só "enxerga" os alvos que fazem
 * sentido (uma lista nunca cai dentro de um card; um card na sidebar só vê as zonas e os boards).
 *
 *   card      → zona da sidebar / board da sidebar sob o ponteiro; senão, cards e listas
 *               (dentro da lista sob o ponteiro, o card mais próximo).
 *   list      → só listas, pelo centro mais próximo (eixo horizontal).
 *   nav-item  → pasta/raiz sob o ponteiro; senão o item mais próximo do mesmo tipo.
 *   nav-folder→ só pastas do mesmo tipo.
 */

const kindOf = (container) => container?.data?.current?.kind;

function only(args, predicate) {
  return { ...args, droppableContainers: args.droppableContainers.filter(predicate) };
}

function cardCollision(args) {
  // 1) Sidebar: soltar em "Diário/Importante/Planejado" ou em outro board
  const sidebarHit = pointerWithin(only(args, (c) => ['zone', 'nav-item'].includes(kindOf(c))
    && (kindOf(c) !== 'nav-item' || c.data.current.itemType === 'board')));
  if (sidebarHit.length) return sidebarHit;

  // 2) Lista sob o ponteiro → card mais próximo dentro dela (ou a própria lista, se vazia)
  const zoneHit = pointerWithin(only(args, (c) => kindOf(c) === 'list-zone'));
  if (zoneHit.length) {
    const listId = args.droppableContainers.find((c) => c.id === zoneHit[0].id)?.data.current.listId;
    const cardsHere = only(args, (c) => kindOf(c) === 'card' && c.data.current.listId === listId);
    if (cardsHere.droppableContainers.length) {
      const near = closestCenter(cardsHere);
      if (near.length) return near;
    }
    return zoneHit;
  }

  // 3) Fora de qualquer lista (entre colunas, no topo…): o mais próximo entre cards e listas
  return closestCorners(only(args, (c) => ['card', 'list-zone'].includes(kindOf(c))));
}

function listCollision(args) {
  return closestCenter(only(args, (c) => kindOf(c) === 'list'));
}

function navItemCollision(args) {
  const itemType = args.active.data.current?.itemType;
  const sameType = (c) => (c.data.current?.itemType ?? c.data.current?.groupType) === itemType;
  const containerHit = pointerWithin(only(args, (c) => ['nav-folder', 'nav-root'].includes(kindOf(c)) && sameType(c)));
  const items = only(args, (c) => kindOf(c) === 'nav-item' && sameType(c));
  const near = rectIntersection(items);
  if (near.length) return near;
  if (containerHit.length) return containerHit;
  return closestCenter(items);
}

function navFolderCollision(args) {
  const groupType = args.active.data.current?.groupType;
  return closestCenter(only(args, (c) => kindOf(c) === 'nav-folder' && c.data.current.groupType === groupType));
}

export function routedCollisionDetection(args) {
  switch (args.active.data.current?.kind) {
    case 'card': return cardCollision(args);
    case 'list': return listCollision(args);
    case 'nav-item': return navItemCollision(args);
    case 'nav-folder': return navFolderCollision(args);
    default: return closestCenter(args);
  }
}
