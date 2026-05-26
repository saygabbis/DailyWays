import { HelpCircle, ExternalLink } from 'lucide-react';
import { openAppHelp } from '../../Help/AppHelpWidget';
import DiaryGlassCard from './DiaryGlassCard';

export function openDiaryReflectionWidget() {
    openAppHelp('reflection');
}

export default function DiaryReflectionTeaser() {
    return (
        <DiaryGlassCard className="diary-reflection-teaser">
            <div className="diary-reflection-teaser-inner">
                <HelpCircle size={20} className="diary-reflection-teaser-icon" />
                <div>
                    <h2 className="diary-section-title">📝 Reflexão do dia</h2>
                    <p className="diary-section-subtitle">
                        Reserve um minuto para você — escreva aqui no hub ou use o botão ? para dicas
                    </p>
                </div>
            </div>
            <button
                type="button"
                className="btn btn-secondary diary-reflection-teaser-btn"
                onClick={() => openAppHelp('reflection')}
            >
                <ExternalLink size={16} />
                Ver no Diário
            </button>
        </DiaryGlassCard>
    );
}
