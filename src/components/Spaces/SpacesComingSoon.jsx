import './SpaceView.css';

export default function SpacesComingSoon() {
    return (
        <div className="space-view-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="space-view-empty" style={{ maxWidth: 480 }}>
                <h2 style={{ fontSize: '1.6rem', marginBottom: 8 }}>Spaces em produção!!</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
                    O canvas colaborativo de Spaces ainda está sendo finalizado.
                    Em breve você poderá criar mapas visuais, fluxos e whiteboards aqui.
                </p>
            </div>
        </div>
    );
}

