import { TEXT, LIVE_DRAFT_MAX } from './textLimits.js';
import { LIMIT_ERROR } from './errorCodes.js';

/**
 * @returns {{ ok: true, value: string } | { ok: false, code: string, field?: string, max?: number, min?: number }}
 */
export function validateText(value, maxLen, field) {
  const s = value == null ? '' : String(value);
  if (s.length > maxLen) {
    return { ok: false, code: LIMIT_ERROR.TEXT_TOO_LONG, field, max: maxLen };
  }
  return { ok: true, value: s };
}

export function trimToMax(value, maxLen) {
  const s = value == null ? '' : String(value);
  return s.length <= maxLen ? s : s.slice(0, maxLen);
}

export function validateCardTitle(value) {
  return validateText(value, TEXT.cardTitle, 'cardTitle');
}

export function validateListTitle(value) {
  return validateText(value, TEXT.listTitle, 'listTitle');
}

export function validateBoardTitle(value) {
  return validateText(value, TEXT.boardTitle, 'boardTitle');
}

export function validateCardDescription(value) {
  return validateText(value, TEXT.cardDescription, 'description');
}

export function validateCardComment(value) {
  return validateText(value, TEXT.cardComment, 'comment');
}

export function validateChatMessage(value) {
  return validateText(value, TEXT.chatMessage, 'chat');
}

export function validateLabelName(value) {
  return validateText(value, TEXT.labelName, 'labelName');
}

export function validateProfileName(value) {
  return validateText(value, TEXT.profileName, 'profileName');
}

export function validateProfileBio(value) {
  return validateText(value, TEXT.profileBio, 'profileBio');
}

export function validateUsername(value) {
  const s = (value ?? '').trim();
  if (s.length < TEXT.usernameMin || s.length > TEXT.usernameMax) {
    return {
      ok: false,
      code: LIMIT_ERROR.USERNAME_LENGTH,
      min: TEXT.usernameMin,
      max: TEXT.usernameMax,
    };
  }
  return { ok: true, value: s };
}

export function validateLinkUrl(value) {
  return validateText(value, TEXT.linkUrl, 'linkUrl');
}

export function validateLinkLabel(value) {
  return validateText(value, TEXT.linkLabel, 'linkLabel');
}

export function validateWhiteboardNodeText(value) {
  return validateText(value, TEXT.whiteboardNodeText, 'whiteboardText');
}

export function validateLiveDraftField(key, value) {
  if (value == null) return { ok: true, value: null };
  const max = LIVE_DRAFT_MAX[key];
  if (max == null) return { ok: true, value: String(value) };
  const r = validateText(value, max, key);
  if (!r.ok) return r;
  return { ok: true, value: r.value };
}
