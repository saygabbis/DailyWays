import { useDiaryReflection } from '../../../hooks/useDiaryReflection';
import DiaryGlassCard from './DiaryGlassCard';
import DiaryReflectionEditor from './DiaryReflectionEditor';

/** Versão inline (legado); preferir widget + teaser no hub. */
export default function DiaryReflection() {
    const reflection = useDiaryReflection();

    return (
        <DiaryGlassCard className="diary-reflection-card">
            <div className="diary-reflection-header">
                <h2 className="diary-section-title">📝 Reflexão do dia</h2>
            </div>
            <p className="diary-section-subtitle">Um espaço acolhedor — sem pressa, sem julgamento</p>
            <DiaryReflectionEditor {...reflection} />
        </DiaryGlassCard>
    );
}
