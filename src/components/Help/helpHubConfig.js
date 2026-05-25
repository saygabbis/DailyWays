/** Conteúdo da central de ajuda (? flutuante). */

export const HELP_SECTIONS = [
    {
        id: 'shortcuts',
        emoji: '⌨️',
        title: 'Atalhos',
        subtitle: 'Trabalhe mais rápido',
        items: [
            { keys: ['Ctrl', 'K'], label: 'Busca global' },
            { keys: ['Tab'], label: 'Abrir / fechar sidebar' },
            { keys: ['Esc'], label: 'Fechar modais e menus' },
            { keys: ['Ctrl', 'Z'], label: 'Desfazer (board)' },
            { keys: ['Ctrl', 'Y'], label: 'Refazer (board)' },
            { keys: ['Ctrl', 'Shift', 'Z'], label: 'Refazer (board)' },
            { keys: ['Ctrl', 'C'], label: 'Copiar cards (no board)' },
            { keys: ['Ctrl', 'X'], label: 'Recortar cards' },
            { keys: ['Ctrl', 'V'], label: 'Colar cards' },
            { keys: ['Ctrl', 'D'], label: 'Duplicar cards selecionados' },
            { keys: ['Delete'], label: 'Apagar cards selecionados (Ctrl+Z restaura)' },
            { keys: ['Shift', 'Delete'], label: 'Eliminar permanentemente (sem restaurar)' },
        ],
    },
    {
        id: 'tips',
        emoji: '💡',
        title: 'Dicas',
        subtitle: 'Fluxo e foco',
        bullets: [
            'Use o Diário para missões do dia — o hub mostra só o que importa agora.',
            'Marque tarefas como Importante ou Planejado para vê-las nas vistas inteligentes.',
            'No board, arraste a toolbar pelo ícone de pontos se ela tapar algo.',
            'Convites de board chegam no sino — aceite sem sair do que está fazendo.',
            'O Pomodoro no Diário liga foco à tarefa e soma segundos de concentração.',
        ],
    },
    {
        id: 'curiosities',
        emoji: '✨',
        title: 'Curiosidades',
        subtitle: 'Por trás do DailyWays',
        bullets: [
            'Boards compartilhados sincronizam em tempo real com presença online na toolbar.',
            'O Diário guarda streak e XP de progresso diário no Supabase.',
            'Categorias emocionais nas tarefas do dia ajudam a equilibrar energia e obrigações.',
            'Notas de reflexão ficam no diário pessoal — separadas dos cards do board.',
        ],
    },
    {
        id: 'troubleshoot',
        emoji: '🔧',
        title: 'Resolver problemas',
        subtitle: 'Quando algo falha',
        bullets: [
            {
                q: 'Convite não aparece?',
                a: 'Confira o sino no header e se o e-mail do convite é o da conta logada. Atualize a página se precisar.',
            },
            {
                q: 'Board não atualiza para outro usuário?',
                a: 'Verifique conexão e se ambos estão no mesmo board. A barra de colaboração mostra quem está online.',
            },
            {
                q: 'Toolbar sumiu ou está no lugar errado?',
                a: 'Menu do perfil → Mostrar Toolbar. Arraste pelo handle; ao ocultar e mostrar, ela volta à posição padrão.',
            },
            {
                q: 'Badge do Diário não some?',
                a: 'Conclua ou mova a tarefa para lista de concluídos — badges contam só tarefas ativas.',
            },
            {
                q: 'Alterações não salvaram?',
                a: 'Procure o indicador de salvamento na toolbar do board ou o botão flutuante de sync.',
            },
        ],
    },
    {
        id: 'faq',
        emoji: '❓',
        title: 'FAQ',
        subtitle: 'Perguntas frequentes',
        faqs: [
            {
                q: 'O que é o Diário?',
                a: 'É o hub do seu dia: foco, missões por categoria, progresso e reflexão — sem o ruído de um board inteiro.',
            },
            {
                q: 'Posso usar sem board?',
                a: 'Sim. Geral, Importante, Planejado e Diário funcionam com cards agregados dos seus boards.',
            },
            {
                q: 'Quem pode editar um board compartilhado?',
                a: 'Depende do convite: Editor altera cards; Leitor só visualiza.',
            },
            {
                q: 'Onde fica a reflexão do dia?',
                a: 'Na aba Diário, no bloco de reflexão — o widget ? aqui é a central de ajuda, não o editor.',
            },
        ],
    },
    {
        id: 'reflection',
        emoji: '📝',
        title: 'Reflexão do dia',
        subtitle: 'No Diário',
        bullets: [
            'Abra a aba Diário na sidebar para escrever sua reflexão com prompts sugeridos.',
            'O texto salva automaticamente na sua conta.',
            'Use quando quiser fechar o dia — sem pressa nem notificação.',
        ],
        cta: { label: 'Ir para o Diário', view: 'myday' },
    },
];

export function getHelpSection(id) {
    return HELP_SECTIONS.find((s) => s.id === id) ?? null;
}
