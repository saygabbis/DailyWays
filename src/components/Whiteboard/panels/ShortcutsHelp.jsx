import React from 'react';
import { X } from 'lucide-react';
import './ShortcutsHelp.css';

const SECTIONS = [
    {
        title: 'Edição',
        items: [
            ['Ctrl+Z', 'Desfazer'],
            ['Ctrl+Y / Ctrl+Shift+Z', 'Refazer'],
            ['Ctrl+C', 'Copiar'],
            ['Ctrl+X', 'Recortar'],
            ['Ctrl+V', 'Colar (deslocado)'],
            ['Ctrl+Shift+V', 'Colar no mesmo lugar'],
            ['Ctrl+D', 'Duplicar'],
            ['Ctrl+A', 'Selecionar tudo'],
            ['Delete', 'Apagar seleção'],
            ['Esc', 'Desselecionar / cancelar'],
        ],
    },
    {
        title: 'Camadas',
        items: [
            ['Ctrl+G', 'Agrupar (movem juntos)'],
            ['Ctrl+Shift+G', 'Desagrupar'],
            ['Shift+clique', 'Adicionar grupo à seleção'],
            ['Ctrl+clique', 'Selecionar só um item do grupo'],
            ['Ctrl+]', 'Avançar camada'],
            ['Ctrl+[', 'Recuar camada'],
            ['Ctrl+Shift+]', 'Trazer para frente'],
            ['Ctrl+Shift+[', 'Enviar para trás'],
        ],
    },
    {
        title: 'Alinhamento',
        items: [
            ['Arrastar', 'Imãs magnéticos (bordas e centros)'],
            ['G', 'Mostrar/ocultar grade'],
        ],
    },
    {
        title: 'Zoom e vista',
        items: [
            ['Scroll', 'Zoom no cursor'],
            ['Ctrl+Scroll', 'Zoom (sem zoom do browser)'],
            ['Ctrl+0', 'Zoom 100%'],
            ['Ctrl+1 / Shift+1', 'Ajustar à tela'],
            ['Ctrl++', 'Aumentar zoom'],
            ['Ctrl+-', 'Diminuir zoom'],
            ['Espaço + arrastar', 'Mover canvas'],
            ['Ctrl+R', 'Réguas'],
            ['G', 'Grade'],
        ],
    },
    {
        title: 'Mover seleção',
        items: [
            ['Setas', 'Mover 1px'],
            ['Shift+Setas', 'Mover 10px'],
        ],
    },
    {
        title: 'Ferramentas',
        items: [
            ['V', 'Selecionar'],
            ['T', 'Texto'],
            ['S', 'Nota adesiva'],
            ['R', 'Forma'],
            ['F', 'Frame'],
            ['L', 'Conector'],
            ['P', 'Desenho'],
            ['M', 'Comentário'],
            ['?', 'Esta ajuda'],
        ],
    },
];

export default function ShortcutsHelp({ open, onClose }) {
    if (!open) return null;

    return (
        <div className="whiteboard-shortcuts-backdrop" onClick={onClose} role="presentation">
            <div
                className="whiteboard-shortcuts-panel"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-labelledby="shortcuts-title"
            >
                <header className="whiteboard-shortcuts-header">
                    <h2 id="shortcuts-title">Atalhos do Space</h2>
                    <button type="button" className="whiteboard-shortcuts-close" onClick={onClose} title="Fechar">
                        <X size={18} />
                    </button>
                </header>
                <p className="whiteboard-shortcuts-hint">Estilo Figma · Miro · FigJam — use Cmd no Mac</p>
                <div className="whiteboard-shortcuts-grid">
                    {SECTIONS.map((section) => (
                        <section key={section.title} className="whiteboard-shortcuts-section">
                            <h3>{section.title}</h3>
                            <ul>
                                {section.items.map(([keys, desc]) => (
                                    <li key={keys}>
                                        <kbd>{keys}</kbd>
                                        <span>{desc}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>
            </div>
        </div>
    );
}
