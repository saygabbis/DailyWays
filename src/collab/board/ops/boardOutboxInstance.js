import { createBoardOutbox } from './boardOutbox.js';

/** Uma fila por aba: BoardCollabContext (envio), BoardCollabBridge (op:applied) e BoardCollabSync (join). */
export const boardOutbox = createBoardOutbox();
