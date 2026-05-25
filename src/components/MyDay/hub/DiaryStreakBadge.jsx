import { STREAK_ENCOURAGEMENT } from './diaryHubConfig';

export default function DiaryStreakBadge({ streak }) {
    const tooltip = streak > 0
        ? `${streak} ${streak === 1 ? 'dia' : 'dias'} de progresso contínuo`
        : 'Comece hoje — qualquer passo conta';

    return (
        <div className="diary-streak-badge" title={tooltip}>
            <span className="diary-streak-emoji" aria-hidden>🔥</span>
            <span className="diary-streak-count">{streak}</span>
            {streak > 0 && (
                <span className="diary-streak-copy">{STREAK_ENCOURAGEMENT}</span>
            )}
        </div>
    );
}
