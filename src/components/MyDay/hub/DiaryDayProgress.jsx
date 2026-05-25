import { DAY_CATEGORIES, CATEGORY_ORDER } from './diaryHubConfig';
import DiaryGlassCard from './DiaryGlassCard';

export default function DiaryDayProgress({ overallPercent, categoryProgress, dayXp }) {
    return (
        <DiaryGlassCard className="diary-progress-card">
            <div className="diary-progress-header">
                <h2 className="diary-section-title">Progresso do dia</h2>
                {dayXp > 0 && (
                    <span className="diary-xp-badge" title="Pequenos passos somam">+{dayXp} XP</span>
                )}
            </div>

            <div className="diary-progress-overall">
                <div className="diary-progress-track">
                    <div
                        className="diary-progress-fill diary-progress-fill--overall"
                        style={{ width: `${overallPercent}%` }}
                    />
                </div>
                <span className="diary-progress-label">
                    {overallPercent}% do dia avançado
                </span>
            </div>

            <div className="diary-progress-categories">
                {CATEGORY_ORDER.map(catId => {
                    const cat = DAY_CATEGORIES[catId];
                    const prog = categoryProgress[catId];
                    if (prog.total === 0) return null;
                    return (
                        <div key={catId} className="diary-progress-cat">
                            <div className="diary-progress-cat-head">
                                <span>{cat.emoji} {cat.label}</span>
                                <span className="diary-progress-cat-count">
                                    {prog.completed}/{prog.total}
                                </span>
                            </div>
                            <div className="diary-progress-track diary-progress-track--sm">
                                <div
                                    className="diary-progress-fill"
                                    style={{ width: `${prog.percent}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </DiaryGlassCard>
    );
}
