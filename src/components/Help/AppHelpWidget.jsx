import { useState, useEffect, useCallback } from 'react';
import {
    HelpCircle,
    X,
    Minimize2,
    ChevronLeft,
    Keyboard,
    Lightbulb,
    Sparkles,
    Wrench,
    MessageCircleQuestion,
    BookOpen,
} from 'lucide-react';
import { HELP_SECTIONS, getHelpSection } from './helpHubConfig';
import './AppHelpWidget.css';

const SECTION_ICONS = {
    shortcuts: Keyboard,
    tips: Lightbulb,
    curiosities: Sparkles,
    troubleshoot: Wrench,
    faq: MessageCircleQuestion,
    reflection: BookOpen,
};

export function openAppHelp(sectionId = null) {
    window.dispatchEvent(
        new CustomEvent('app-help-open', { detail: sectionId ? { sectionId } : {} })
    );
}

/** @deprecated use openAppHelp */
export function openDiaryReflectionWidget() {
    openAppHelp('reflection');
}

function HelpKbd({ keys }) {
    return (
        <span className="app-help-kbd-group">
            {keys.map((k) => (
                <kbd key={k} className="app-help-kbd">
                    {k}
                </kbd>
            ))}
        </span>
    );
}

function HelpSectionBody({ section }) {
    if (!section) return null;

    if (section.items?.length) {
        return (
            <ul className="app-help-list app-help-list--shortcuts">
                {section.items.map((item) => (
                    <li key={item.label}>
                        <HelpKbd keys={item.keys} />
                        <span>{item.label}</span>
                    </li>
                ))}
            </ul>
        );
    }

    if (section.faqs?.length) {
        return (
            <div className="app-help-faqs">
                {section.faqs.map((f) => (
                    <details key={f.q} className="app-help-faq">
                        <summary>{f.q}</summary>
                        <p>{f.a}</p>
                    </details>
                ))}
            </div>
        );
    }

    if (section.bullets?.length) {
        const isTroubleshoot = section.id === 'troubleshoot';
        return (
            <ul className={`app-help-list ${isTroubleshoot ? 'app-help-list--troubleshoot' : ''}`}>
                {section.bullets.map((b, i) => {
                    if (typeof b === 'string') {
                        return <li key={i}>{b}</li>;
                    }
                    return (
                        <li key={b.q}>
                            <strong>{b.q}</strong>
                            <p>{b.a}</p>
                        </li>
                    );
                })}
            </ul>
        );
    }

    return null;
}

export default function AppHelpWidget({ onNavigateView }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [activeSectionId, setActiveSectionId] = useState(null);

    const openPanel = useCallback((sectionId = null) => {
        setIsOpen(true);
        setIsMinimized(false);
        setActiveSectionId(sectionId);
    }, []);

    useEffect(() => {
        const onOpen = (e) => {
            openPanel(e.detail?.sectionId ?? null);
        };
        window.addEventListener('app-help-open', onOpen);
        window.addEventListener('diary-reflection-open', onOpen);
        return () => {
            window.removeEventListener('app-help-open', onOpen);
            window.removeEventListener('diary-reflection-open', onOpen);
        };
    }, [openPanel]);

    useEffect(() => {
        if (!isOpen || isMinimized) return;
        const onKey = (e) => {
            if (e.key === 'Escape') {
                if (activeSectionId) setActiveSectionId(null);
                else {
                    setIsOpen(false);
                    setIsMinimized(false);
                }
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, isMinimized, activeSectionId]);

    const handleClose = (e) => {
        e?.stopPropagation?.();
        e?.preventDefault?.();
        setIsOpen(false);
        setIsMinimized(false);
        setActiveSectionId(null);
    };

    const handleMinimize = (e) => {
        e.stopPropagation();
        e.preventDefault();
        setIsMinimized(true);
    };

    const handleExpandFromMinimized = (e) => {
        e.stopPropagation();
        setIsMinimized(false);
    };

    const handleBack = (e) => {
        e.stopPropagation();
        e.preventDefault();
        setActiveSectionId(null);
    };

    const activeSection = activeSectionId ? getHelpSection(activeSectionId) : null;

    if (!isOpen) {
        return (
            <button
                type="button"
                className="app-help-fab"
                title="Ajuda e atalhos"
                onClick={() => openPanel()}
                aria-label="Abrir central de ajuda"
            >
                <HelpCircle size={22} strokeWidth={2.25} />
            </button>
        );
    }

    if (isMinimized) {
        return (
            <button
                type="button"
                className="app-help-minimized-pill"
                title="Expandir ajuda"
                onClick={handleExpandFromMinimized}
                aria-label="Expandir central de ajuda"
            >
                <span className="app-help-minimized-q">?</span>
            </button>
        );
    }

    return (
        <div className="app-help-widget" role="dialog" aria-label="Central de ajuda">
            <header className="app-help-widget-header">
                {activeSection ? (
                    <button
                        type="button"
                        className="btn-icon btn-xs app-help-back"
                        onClick={handleBack}
                        title="Voltar"
                        aria-label="Voltar"
                    >
                        <ChevronLeft size={18} />
                    </button>
                ) : (
                    <span className="app-help-widget-brand" aria-hidden>
                        <HelpCircle size={16} />
                    </span>
                )}
                <div className="app-help-widget-titles">
                    <h2 className="app-help-widget-title">
                        {activeSection ? activeSection.title : 'Central de ajuda'}
                    </h2>
                    <p className="app-help-widget-sub">
                        {activeSection ? activeSection.subtitle : 'Atalhos, dicas e suporte'}
                    </p>
                </div>
                <div className="app-help-widget-actions">
                    <button
                        type="button"
                        className="btn-icon btn-xs"
                        onClick={handleMinimize}
                        title="Minimizar"
                        aria-label="Minimizar"
                    >
                        <Minimize2 size={14} />
                    </button>
                    <button
                        type="button"
                        className="btn-icon btn-xs"
                        onClick={handleClose}
                        title="Fechar"
                        aria-label="Fechar"
                    >
                        <X size={14} />
                    </button>
                </div>
            </header>

            <div className="app-help-widget-body">
                {!activeSection && (
                    <nav className="app-help-section-grid" aria-label="Seções de ajuda">
                        {HELP_SECTIONS.map((sec) => {
                            const Icon = SECTION_ICONS[sec.id] || HelpCircle;
                            return (
                                <button
                                    key={sec.id}
                                    type="button"
                                    className="app-help-section-card"
                                    onClick={() => setActiveSectionId(sec.id)}
                                >
                                    <span className="app-help-section-card-emoji" aria-hidden>
                                        {sec.emoji}
                                    </span>
                                    <span className="app-help-section-card-text">
                                        <span className="app-help-section-card-title">{sec.title}</span>
                                        <span className="app-help-section-card-sub">{sec.subtitle}</span>
                                    </span>
                                    <Icon size={16} className="app-help-section-card-icon" />
                                </button>
                            );
                        })}
                    </nav>
                )}

                {activeSection && (
                    <div className="app-help-section-detail">
                        <HelpSectionBody section={activeSection} />
                        {activeSection.cta && (
                            <button
                                type="button"
                                className="btn btn-primary app-help-cta"
                                onClick={() => {
                                    onNavigateView?.(activeSection.cta.view);
                                    handleClose();
                                }}
                            >
                                {activeSection.cta.label}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
