/** Estado inicial, paletas e o board de boas-vindas de um usuário novo. */
import { uuidv4 } from '../../utils/uuid';

export const LABEL_COLORS = [
    { id: 'red', name: 'Vermelho', color: '#ff6b6b' },
    { id: 'orange', name: 'Laranja', color: '#ffa06b' },
    { id: 'yellow', name: 'Amarelo', color: '#ffd93d' },
    { id: 'green', name: 'Verde', color: '#6bcb77' },
    { id: 'blue', name: 'Azul', color: '#4d96ff' },
    { id: 'purple', name: 'Roxo', color: '#9b59b6' },
    { id: 'pink', name: 'Rosa', color: '#ff6b9d' },
    { id: 'teal', name: 'Teal', color: '#2ec4b6' },
];

export const DEFAULT_BOARD_COLORS = [
    'linear-gradient(135deg, #7c3aed, #2563eb)',
    'linear-gradient(135deg, #ec4899, #f43f5e)',
    'linear-gradient(135deg, #06b6d4, #3b82f6)',
    'linear-gradient(135deg, #10b981, #059669)',
    'linear-gradient(135deg, #f59e0b, #ef4444)',
    'linear-gradient(135deg, #8b5cf6, #ec4899)',
    'linear-gradient(135deg, #14b8a6, #06b6d4)',
    'linear-gradient(135deg, #f97316, #fbbf24)',
    '#111827', // sólido escuro
    null,      // sem cor
];

export const initialState = {
    boards: [],
    groups: [],
    spaces: [],
    activeBoard: null,
    selectedItems: [],
    selectionType: null, // 'board' | 'space' | null
    searchQuery: '',
    filterPriority: 'all',
    filterLabel: 'all',
    labels: [...LABEL_COLORS],
    savingBoardIds: [],
    pendingBoardIds: [], // boards com debounce agendado mas ainda não enviados ao servidor
    // Erros de save: [{ boardId, boardTitle, boardSnapshot, error }]
    // Cada entrada representa um save falho aguardando acao do usuario (retry ou revert)
    saveErrors: [],
    isDraggingBulk: false,
    showBoardToolbar: JSON.parse(localStorage.getItem('dailyways_show_toolbar') ?? 'false'),
    /** Header profile dropdown aberto — BoardView desloca a toolbar para não ficar por baixo */
    profileMenuOpen: false,
    /** Erro ao carregar boards do Supabase (evita criar "Meu Primeiro Board" à toa) */
    boardsLoadError: null,
    confirmModal: {
        show: false,
        title: '',
        message: '',
        onConfirm: null,
        onCancel: null,
        type: 'danger',
        confirmLabel: 'Confirmar',
        cancelLabel: 'Cancelar',
        checkbox: null,
    }
};

export function createDefaultBoards() {
    const boardId = uuidv4();
    return [{
        id: boardId,
        title: 'Meu Primeiro Board',
        color: DEFAULT_BOARD_COLORS[0],
        emoji: '🚀',
        createdAt: new Date().toISOString(),
        lists: [
            {
                id: uuidv4(),
                title: 'A Fazer',
                color: null,
                isCompletionList: false,
                cards: [
                    {
                        id: uuidv4(),
                        title: 'Bem-vindo ao DailyWays! 🎉',
                        description: 'Arraste este card para "Em Progresso" para começar!',
                        labels: ['blue'],
                        priority: 'medium',
                        dueDate: null,
                        startDate: null,
                        isAllDay: true,
                        recurrenceRule: null,
                        coverAttachmentId: null,
                        myDay: true,
                        subtasks: [
                            { id: uuidv4(), title: 'Explorar o board', done: false, position: 0, linkUrl: null, linkLabel: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
                            { id: uuidv4(), title: 'Criar uma nova tarefa', done: false, position: 1, linkUrl: null, linkLabel: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
                            { id: uuidv4(), title: 'Experimentar drag & drop', done: false, position: 2, linkUrl: null, linkLabel: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
                        ],
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    },
                ],
            },
            {
                id: uuidv4(),
                title: 'Em Progresso',
                color: null,
                isCompletionList: false,
                cards: [],
            },
            {
                id: uuidv4(),
                title: 'Concluído',
                color: null,
                isCompletionList: true,
                cards: [],
            },
        ],
    }];
}
