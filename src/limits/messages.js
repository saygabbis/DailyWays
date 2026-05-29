import { TEXT, COUNT, LIMIT_ERROR, formatMaxFileSize } from '@dailyways/limits';

export function textTooLong(fieldLabel, max) {
  return `${fieldLabel} deve ter no máximo ${max} caracteres.`;
}

export function fileTooLarge(specKey) {
  return `O arquivo excede o limite de ${formatMaxFileSize(specKey)}.`;
}

export function fileTypeNotAllowed() {
  return 'Tipo de arquivo não permitido.';
}

export function countLimitReached(what, max) {
  return `Limite atingido: no máximo ${max} ${what}.`;
}

/** Mensagens pré-formatadas por campo (UI / toasts). */
export const LIMIT_MSG = {
  cardTitle: textTooLong('Título', TEXT.cardTitle),
  listTitle: textTooLong('Título da lista', TEXT.listTitle),
  boardTitle: textTooLong('Título do board', TEXT.boardTitle),
  subtaskTitle: textTooLong('Subtarefa', TEXT.subtaskTitle),
  description: textTooLong('Descrição', TEXT.cardDescription),
  comment: textTooLong('Comentário', TEXT.cardComment),
  chat: textTooLong('Mensagem', TEXT.chatMessage),
  labelName: textTooLong('Nome da etiqueta', TEXT.labelName),
  profileName: textTooLong('Nome', TEXT.profileName),
  profileBio: textTooLong('Bio', TEXT.profileBio),
  username: `Username deve ter entre ${TEXT.usernameMin} e ${TEXT.usernameMax} caracteres.`,
  linkUrl: textTooLong('URL', TEXT.linkUrl),
  linkLabel: textTooLong('Nome do link', TEXT.linkLabel),
  whiteboardText: textTooLong('Texto', TEXT.whiteboardNodeText),
  labelsBoard: countLimitReached('etiquetas no board', COUNT.labelsPerBoard),
  labelsCard: countLimitReached('etiquetas no card', COUNT.labelsPerCard),
  subtasks: countLimitReached('subtarefas', COUNT.subtasksPerCard),
  attachments: countLimitReached('anexos', COUNT.attachmentsPerCard),
  lists: countLimitReached('listas', COUNT.listsPerBoard),
  cards: countLimitReached('cards na lista', COUNT.cardsPerList),
  nodes: countLimitReached('elementos no space', COUNT.whiteboardNodesPerSpace),
};

const TEXT_FIELD_LABELS = {
  cardTitle: 'Título',
  listTitle: 'Título da lista',
  boardTitle: 'Título do board',
  subtaskTitle: 'Subtarefa',
  description: 'Descrição',
  comment: 'Comentário',
  chat: 'Mensagem',
  labelName: 'Nome da etiqueta',
  profileName: 'Nome',
  profileBio: 'Bio',
  linkUrl: 'URL',
  linkLabel: 'Nome do link',
  whiteboardText: 'Texto',
};

/**
 * Converte resultado de validação do pacote @dailyways/limits em texto para o utilizador.
 * @param {{ ok?: boolean, code?: string, field?: string, max?: number, min?: number, specKey?: string } | { code: string, field?: string }} result
 */
export function resolveLimitError(result) {
  if (!result) return 'Limite excedido.';
  if (result.ok === true) return '';

  const code = result.code;
  if (!code) return 'Limite excedido.';

  switch (code) {
    case LIMIT_ERROR.TEXT_TOO_LONG: {
      if (result.field && LIMIT_MSG[result.field]) return LIMIT_MSG[result.field];
      const label = TEXT_FIELD_LABELS[result.field] ?? result.field ?? 'Campo';
      return textTooLong(label, result.max ?? 0);
    }
    case LIMIT_ERROR.USERNAME_LENGTH:
      return LIMIT_MSG.username;
    case LIMIT_ERROR.FILE_TOO_LARGE:
      return fileTooLarge(result.specKey);
    case LIMIT_ERROR.FILE_TYPE_NOT_ALLOWED:
      return fileTypeNotAllowed();
    case LIMIT_ERROR.INVALID_FILE:
      return 'Arquivo inválido.';
    case LIMIT_ERROR.INVALID_CONFIG:
      return 'Configuração de limite inválida.';
    case LIMIT_ERROR.COUNT_LIMIT:
      if (result.field && LIMIT_MSG[result.field]) return LIMIT_MSG[result.field];
      return 'Limite de quantidade atingido.';
    default:
      return 'Limite excedido.';
  }
}
