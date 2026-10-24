import { useState, useRef, useEffect, useCallback, memo, lazy, Suspense } from 'react';
import { Save, LogOut, Camera, Trash2 } from 'lucide-react';
import { TEXT } from '@dailyways/limits';
import '../Settings.css';
import '../AvatarCropper.css';

const AvatarCropper = lazy(() => import('../AvatarCropper'));

// ─────────────────────────────────────────────
// ACCOUNT PANEL
// ─────────────────────────────────────────────
const AccountPanel = memo(function AccountPanel({ user, updateProfile, confirmLogout, uploadAvatar, removeAvatar, t }) {
    const [name, setName] = useState(user?.name || '');
    const [username, setUsername] = useState(user?.username || '');
    const [avatar, setAvatar] = useState(user?.avatar || '');
    const [bio, setBio] = useState(user?.bio || '');
    const [saved, setSaved] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [photoUrl, setPhotoUrl] = useState(user?.photo_url || null);
    const [showCropper, setShowCropper] = useState(false);
    const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
    const [photoLoading, setPhotoLoading] = useState(false);
    const avatarMenuRef = useRef(null);

    // Update from user prop changes
    const [prevUser, setPrevUser] = useState(user);
    if (user !== prevUser) {
        setPrevUser(user);
        setName(user?.name || '');
        setUsername(user?.username || '');
        setAvatar(user?.avatar || '');
        setBio(user?.bio || '');
        setPhotoUrl(user?.photo_url || null);
    }

    // Close avatar menu on outside click
    useEffect(() => {
        const handler = (e) => {
            if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target))
                setAvatarMenuOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleAvatarUpload = useCallback(async (blob) => {
        setPhotoLoading(true);
        setShowCropper(false);
        const result = await uploadAvatar(blob);
        if (result?.success) setPhotoUrl(result.photo_url || user?.photo_url || null);
        setPhotoLoading(false);
        setAvatarMenuOpen(false);
    }, [uploadAvatar, user?.photo_url]);

    const handleRemovePhoto = useCallback(async () => {
        setAvatarMenuOpen(false);
        setPhotoLoading(true);
        await removeAvatar();
        setPhotoUrl(null);
        setPhotoLoading(false);
    }, [removeAvatar]);

    const handleSave = useCallback(async () => {
        setSaveError('');
        const result = await updateProfile({ name, username, avatar, bio });
        if (result?.success) {
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } else {
            setSaveError(result?.error || 'Erro ao salvar.');
        }
    }, [updateProfile, name, username, avatar, bio]);

    const handleClearData = useCallback(() => {
        if (window.confirm('Tem certeza que deseja limpar todos os dados? Esta ação é irreversível.')) {
            localStorage.clear();
            window.location.reload();
        }
    }, []);

    return (
        <div className="settings-panel animate-fade-in">
            <div className="settings-panel-header">
                <h2>{t.acTitle}</h2>
                <p>{t.acSubtitle}</p>
            </div>

            <div className="settings-section">
                <div className="settings-avatar-section">
                    <div className="settings-avatar-wrapper" ref={avatarMenuRef} style={{ position: 'relative' }}>
                        {photoUrl ? (
                            <img src={photoUrl} alt="avatar" className="settings-avatar-photo" />
                        ) : (
                            <div className="settings-avatar-large">{avatar || name?.[0] || '?'}</div>
                        )}
                        <div
                            className="settings-avatar-overlay"
                            onClick={() => setAvatarMenuOpen(v => !v)}
                            title={photoUrl ? t.avChangePhoto : t.avSetPhoto}
                            style={{ cursor: 'pointer' }}
                        >
                            <Camera size={20} color="#fff" />
                        </div>
                        {avatarMenuOpen && (
                            <div className="avatar-options-menu">
                                <button className="avatar-option-btn" onClick={() => { setAvatarMenuOpen(false); setShowCropper(true); }} disabled={photoLoading}>
                                    <Camera size={15} />
                                    {photoUrl ? t.avChangePhoto : t.avSetPhoto}
                                </button>
                                {photoUrl && (
                                    <button className="avatar-option-btn danger" onClick={handleRemovePhoto} disabled={photoLoading}>
                                        <Trash2 size={15} />
                                        {t.avRemovePhoto}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="settings-avatar-info">
                        <h3>{user?.name}</h3>
                        <p>{user?.email}</p>
                        {user?.username && <p className="settings-username">@{user.username}</p>}
                    </div>
                </div>
            </div>

            {showCropper && (
                <Suspense fallback={null}>
                    <AvatarCropper
                        onApply={handleAvatarUpload}
                        onClose={() => setShowCropper(false)}
                        t={t}
                    />
                </Suspense>
            )}

            <div className="settings-section">
                <h3 className="settings-section-title">{t.acPersonalInfo}</h3>
                <div className="settings-field">
                    <label>{t.acName}</label>
                    <input type="text" value={name} maxLength={TEXT.profileName} onChange={e => setName(e.target.value)} placeholder={t.acNamePh} />
                </div>
                <div className="settings-field">
                    <label>Username</label>
                    <input
                        type="text"
                        value={username}
                        maxLength={TEXT.usernameMax}
                        onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                        placeholder="username"
                    />
                </div>
                <div className="settings-field">
                    <label>{t.acEmail}</label>
                    <input type="email" value={user?.email ?? ''} readOnly disabled placeholder="seu@email.com" className="settings-input-readonly" />
                    <p className="settings-field-hint">{t.acEmailHint}</p>
                </div>
                <div className="settings-field">
                    <label>{t.acBio}</label>
                    <textarea value={bio} maxLength={TEXT.profileBio} onChange={e => setBio(e.target.value)} placeholder={t.acBioPh} rows={2} className="settings-bio" />
                </div>
                {saveError && <p className="settings-error">{saveError}</p>}
                <div className="settings-actions">
                    <button className="btn btn-primary" onClick={handleSave}>
                        <Save size={16} />
                        {saved ? t.acSaved : t.acSave}
                    </button>
                </div>
            </div>

            <div className="settings-section settings-danger-zone">
                <h3 className="settings-section-title">{t.acDangerZone}</h3>
                <div className="settings-danger-card">
                    <div>
                        <strong>{t.acClearData}</strong>
                        <p>{t.acClearDataDesc}</p>
                    </div>
                    <button className="btn btn-danger btn-sm" onClick={handleClearData}>{t.acClearBtn}</button>
                </div>
                <div className="settings-danger-card">
                    <div>
                        <strong>{t.acLogout}</strong>
                        <p>{t.acLogoutDesc}</p>
                    </div>
                    <button className="btn btn-danger btn-sm" onClick={confirmLogout}>
                        <LogOut size={14} />
                        {t.acLogoutBtn}
                    </button>
                </div>
            </div>
        </div>
    );
});

export default AccountPanel;
