import { SlidersHorizontal } from 'lucide-react';
import { CATEGORY_ORDER } from './diaryHubConfig';
import DiaryGlassCard from './DiaryGlassCard';
import DiaryMissionSection from './DiaryMissionSection';

export default function DiaryMissions({
    missionGroups,
    onCardClick,
    onTaskCompleted,
    onOpenAdvancedPlanner,
}) {
    return (
        <DiaryGlassCard className="diary-missions-card">
            <div className="diary-missions-header">
                <div>
                    <h2 className="diary-section-title">Missões do dia</h2>
                    <p className="diary-section-subtitle">Equilíbrio entre obrigação, criação e você</p>
                </div>
                <button
                    type="button"
                    className="diary-advanced-link"
                    onClick={onOpenAdvancedPlanner}
                >
                    <SlidersHorizontal size={14} />
                    Planejamento avançado
                </button>
            </div>

            <div className="diary-missions-grid">
                {CATEGORY_ORDER.map(catId => (
                    <DiaryMissionSection
                        key={catId}
                        categoryId={catId}
                        cards={missionGroups[catId] || []}
                        onCardClick={onCardClick}
                        onTaskCompleted={onTaskCompleted}
                    />
                ))}
            </div>
        </DiaryGlassCard>
    );
}
