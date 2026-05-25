/** Mensagens amigáveis para erros de convite (RPC Supabase). */
export function formatInviteError(message) {
  const m = (message || '').toLowerCase();
  if (m.includes('não está cadastrado') || m.includes('nao esta cadastrado')) {
    return 'Esta pessoa não está cadastrada no DailyWays.';
  }
  if (m.includes('já é membro') || m.includes('ja e membro')) {
    return 'Esta pessoa já é membro.';
  }
  if (m.includes('convidar-te a ti mesmo') || m.includes('convidar-te')) {
    return 'Não podes convidar-te a ti mesmo.';
  }
  if (m.includes('somente o owner')) {
    return 'Só o dono pode enviar convites.';
  }
  return message || 'Erro ao enviar convite.';
}
