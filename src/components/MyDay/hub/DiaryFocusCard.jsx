import { Play, Target } from 'lucide-react';
import { usePomodoro } from '../../../context/PomodoroContext';
import { getEstimatedMinutes } from './diaryHubUtils';
import { DEFAULT_FOCUS_MINUTES } from './diaryHubConfig';
import DiaryGlassCard from './DiaryGlassCard';
import DiaryEmptyState from './DiaryEmptyState';

export default function DiaryFocusCard({ task, onAddMission }) {
    const { startFocusForCard } = usePomodoro();

    if (!task) {
        return (
            <DiaryGlassCard className="diary-focus-card diary-focus-card--empty">
                <div className="diary-focus-header">
                    <Target size={18} />
                    <span>🎯 Próximo passo</span>
                </div>
                <DiaryEmptyState
                    title="Seu dia está aberto"
                    description="Adicione uma missão e nós mostramos o próximo passo — sem pressão."
                    action={
                        <button type="button" className="btn btn-primary diary-focus-cta" onClick={onAddMission}>
                            Adicionar missão
                        </button>
                    }
                />
            </DiaryGlassCard>
        );
    }

    const minutes = getEstimatedMinutes(task) ?? DEFAULT_FOCUS_MINUTES;

    return (
        <DiaryGlassCard className="diary-focus-card diary-focus-card--active">
            <div className="diary-focus-header">
                <Target size={18} />
                <span>🎯 Próximo passo</span>
            </div>
            <h2 className="diary-focus-title">{task.title}</h2>
            <p className="diary-focus-meta">
                {task.boardTitle && <span>{task.boardTitle}</span>}
                {task.boardTitle && task.listTitle && <span> · </span>}
                {task.listTitle && <span>{task.listTitle}</span>}
                <span className="diary-focus-time"> · ~{minutes} min</span>
            </p>
            <button
                type="button"
                className="btn btn-primary diary-focus-cta"
                onClick={() => startFocusForCard(task, minutes)}
            >
                <Play size={16} fill="currentColor" />
                Entrar no modo foco
            </button>
        </DiaryGlassCard>
    );
}
