export const DAY_CATEGORIES = {
    essential: { id: 'essential', emoji: '⚡', label: 'Obrigatório', subtitle: 'trabalho, faculdade, contas' },
    creative: { id: 'creative', emoji: '🎨', label: 'Criativo', subtitle: 'portfólio, estudo, side projects' },
    self: { id: 'self', emoji: '💛', label: 'Você', subtitle: 'descanso, lazer, autocuidado' },
};

export const CATEGORY_ORDER = ['essential', 'creative', 'self'];

export const FOCUS_STREAK_MIN_SECONDS = 900; // 15 min

export const DEFAULT_FOCUS_MINUTES = 25;

export const MOTIVATIONAL_PHRASES = [
    'Hoje é um bom dia para avançar 1%',
    'Um passo de cada vez já é progresso',
    'Você não precisa fazer tudo — só o próximo passo',
    'Consistência leve vence pressão pesada',
    'Mesmo nos dias difíceis, você pode continuar',
    'Pequenos avanços somam grandes mudanças',
    'Descansar também faz parte do seu dia',
];

export const STREAK_ENCOURAGEMENT = 'Mesmo nos dias difíceis, você continuou';

export const REFLECTION_PROMPTS = [
    { id: 'feeling', label: 'Como você está se sentindo?', prefix: '**Como estou me sentindo:**\n\n' },
    { id: 'proud', label: 'O que te deixou orgulhosa hoje?', prefix: '**Orgulho de hoje:**\n\n' },
    { id: 'hard', label: 'O que foi difícil?', prefix: '**Foi difícil:**\n\n' },
];

export const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };

export const TIMEZONE_FALLBACK = 'America/Sao_Paulo';
