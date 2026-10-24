import { Component } from 'react';
import './ErrorBoundary.css';

/**
 * Captura erros de render para que uma tela quebrada não derrube o app inteiro.
 * `resetKey`: quando muda (ex.: troca de view), o boundary tenta renderizar de novo.
 */
export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { error: null, resetKey: props.resetKey };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    static getDerivedStateFromProps(props, state) {
        if (props.resetKey !== state.resetKey) return { error: null, resetKey: props.resetKey };
        return null;
    }

    componentDidCatch(error, info) {
        console.error('[ErrorBoundary]', this.props.label || 'app', error, info?.componentStack);
    }

    render() {
        const { error } = this.state;
        if (!error) return this.props.children;
        if (this.props.fallback !== undefined) return this.props.fallback;
        return (
            <div className={`error-boundary ${this.props.fullScreen ? 'error-boundary--full' : ''}`} role="alert">
                <h2>Algo deu errado nesta tela</h2>
                <p>Suas alterações já sincronizadas estão salvas. Tente de novo ou recarregue a página.</p>
                <div className="error-boundary__actions">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => this.setState({ error: null })}>
                        Tentar de novo
                    </button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => window.location.reload()}>
                        Recarregar
                    </button>
                </div>
            </div>
        );
    }
}
