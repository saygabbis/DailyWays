import { useState } from 'react';
import { useDiaryHub } from '../../hooks/useDiaryHub';
import DiaryHero from './hub/DiaryHero';
import DiaryFocusCard from './hub/DiaryFocusCard';
import DiaryMissions from './hub/DiaryMissions';
import DiaryDayProgress from './hub/DiaryDayProgress';
import DiaryReflectionTeaser from './hub/DiaryReflectionTeaser';
import DiarySuggestions from './hub/DiarySuggestions';
import DiaryAdvancedPlanner from './hub/DiaryAdvancedPlanner';
import './MyDay.css';

export default function MyDayView({ onCardClick }) {
    const [plannerOpen, setPlannerOpen] = useState(false);
    const hub = useDiaryHub();

    const scrollToMissions = () => {
        document.getElementById('diary-missions')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <div className="myday-view diary-hub animate-slide-up">
            <DiaryHero
                motivationalPhrase={hub.motivationalPhrase}
                completedToday={hub.completedToday}
                totalToday={hub.totalToday}
                focusDisplay={hub.focusDisplay}
                streak={hub.streak}
            />

            <DiaryFocusCard
                task={hub.nextFocusTask}
                onAddMission={scrollToMissions}
            />

            <div id="diary-missions">
                <DiaryMissions
                    missionGroups={hub.missionGroups}
                    onCardClick={onCardClick}
                    onTaskCompleted={hub.onTaskCompleted}
                    onOpenAdvancedPlanner={() => setPlannerOpen(true)}
                />
            </div>

            <DiarySuggestions onCardClick={onCardClick} />

            <DiaryDayProgress
                overallPercent={hub.overallPercent}
                categoryProgress={hub.categoryProgress}
                dayXp={hub.dayXp}
            />

            <DiaryReflectionTeaser />

            <DiaryAdvancedPlanner
                open={plannerOpen}
                onClose={() => setPlannerOpen(false)}
                onCardClick={onCardClick}
            />
        </div>
    );
}
