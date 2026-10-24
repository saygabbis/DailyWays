import { useState, useEffect, memo } from 'react';
import { Smartphone, Save, Bell } from 'lucide-react';
import pkg from '../../../../package.json';
import { getNotificationPrefs, setNotificationPrefs } from '../../../services/notificationPrefs';
import '../Settings.css';
import '../AvatarCropper.css';

// ─────────────────────────────────────────────
// APP PANEL
// ─────────────────────────────────────────────
const AppPanel = memo(function AppPanel({ t }) {
    const [notifications, setNotifications] = useState(() => getNotificationPrefs().pushEnabled);
    const [sounds, setSounds] = useState(() => getNotificationPrefs().soundEnabled);
    const [autoSave, setAutoSave] = useState(true);

    useEffect(() => {
        setNotificationPrefs({ pushEnabled: notifications });
    }, [notifications]);

    useEffect(() => {
        setNotificationPrefs({ soundEnabled: sounds });
    }, [sounds]);

    return (
        <div className="settings-panel animate-fade-in">
            <div className="settings-panel-header">
                <h2>{t.appTabTitle}</h2>
                <p>{t.appTabSubtitle}</p>
            </div>
            <div className="settings-section">
                <h3 className="settings-section-title">{t.sNotifications}</h3>
                {[
                    { icon: Bell, label: t.sNotifPush, desc: t.sNotifPushDesc, val: notifications, set: setNotifications },
                    { icon: Smartphone, label: t.sSounds, desc: t.sSoundsDesc, val: sounds, set: setSounds },
                    { icon: Save, label: t.sAutoSave, desc: t.sAutoSaveDesc, val: autoSave, set: setAutoSave },
                ].map(({ icon: Icon, label, desc, val, set }) => (
                    <div key={label} className="settings-toggle-row">
                        <div className="settings-toggle-info">
                            <Icon size={18} />
                            <div><strong>{label}</strong><p>{desc}</p></div>
                        </div>
                        <button className={`settings-toggle ${val ? 'active' : ''}`} onClick={() => set(!val)}>
                            <span className="settings-toggle-thumb" />
                        </button>
                    </div>
                ))}
            </div>
            <div className="settings-section">
                <h3 className="settings-section-title">{t.sData}</h3>
                <div className="settings-info-row"><span>{t.sVersion}</span><span className="settings-info-value">{pkg.version}</span></div>
                <div className="settings-info-row"><span>{t.sStorage}</span><span className="settings-info-value">Supabase (PostgreSQL)</span></div>
            </div>
        </div>
    );
});

export default AppPanel;
