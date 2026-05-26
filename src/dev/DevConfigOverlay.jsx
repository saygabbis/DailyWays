import { useState, useCallback } from 'react';
import { X, Trash2, UserPlus, Wrench } from 'lucide-react';
import { useDevAccess } from './useDevAccess.js';
import { useDevConfigStore } from './devConfigStore.js';
import { saveDevToolConfig } from './devConfigService.js';
import {
  PRIMARY_DEV_EMAIL,
  PRIMARY_DEV_USERNAME,
  normalizeDevInput,
  isDuplicateDevEntry,
  isReservedDevEntry,
  devEntryKey,
} from './devAccess.js';
import './DevConfigOverlay.css';

export default function DevConfigOverlay({ open, onClose }) {
  const {
    config,
    canEditDevConfig,
    isPrimaryDev,
  } = useDevAccess();
  const saving = useDevConfigStore((s) => s.saving);
  const storeError = useDevConfigStore((s) => s.error);
  const [input, setInput] = useState('');
  const [localError, setLocalError] = useState('');
  const displayError = localError || storeError;

  const persist = useCallback(async (nextConfig) => {
    useDevConfigStore.getState().setSaving(true);
    useDevConfigStore.getState().setError(null);
    setLocalError('');
    try {
      const saved = await saveDevToolConfig(nextConfig);
      useDevConfigStore.getState().setConfig(saved);
    } catch (err) {
      const msg = err?.message || 'Falha ao salvar';
      useDevConfigStore.getState().setError(msg);
      setLocalError(msg);
    } finally {
      useDevConfigStore.getState().setSaving(false);
    }
  }, []);

  const onTogglePrank = () => {
    if (!canEditDevConfig) return;
    persist({ ...config, prankEnabled: !config.prankEnabled });
  };

  const onAddDev = () => {
    if (!canEditDevConfig) return;
    const entry = normalizeDevInput(input);
    if (!entry) {
      setLocalError('Informe um e-mail ou @username');
      return;
    }
    if (isReservedDevEntry(entry)) {
      setLocalError('Essa conta já é o owner DEV');
      return;
    }
    if (isDuplicateDevEntry(config.additionalDevs, entry)) {
      setLocalError('Já está na lista');
      return;
    }
    setInput('');
    setLocalError('');
    persist({
      ...config,
      additionalDevs: [...(config.additionalDevs || []), entry],
    });
  };

  const onRemoveDev = (entry) => {
    if (!canEditDevConfig) return;
    const key = devEntryKey(entry);
    persist({
      ...config,
      additionalDevs: (config.additionalDevs || []).filter((e) => devEntryKey(e) !== key),
    });
  };

  if (!open) return null;

  return (
    <div className="dev-config-overlay" role="dialog" aria-modal="true" aria-labelledby="dev-config-title">
      <button type="button" className="dev-config-overlay__backdrop" onClick={onClose} aria-label="Fechar" />
      <div className="dev-config-panel">
        <header className="dev-config-panel__header">
          <div className="dev-config-panel__title-row">
            <Wrench size={18} aria-hidden />
            <h2 id="dev-config-title">Config DEV</h2>
          </div>
          <button type="button" className="dev-config-panel__close" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>

        <p className="dev-config-panel__hint">
          Atalho: <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>4</kbd>
          {!canEditDevConfig && ' — somente leitura (owner: @gabbis)'}
        </p>

        <section className="dev-config-section">
          <h3>Owner (fixo)</h3>
          <ul className="dev-config-list dev-config-list--readonly">
            <li>
              <span className="dev-config-tag">email</span>
              {PRIMARY_DEV_EMAIL}
            </li>
            <li>
              <span className="dev-config-tag">user</span>
              @{PRIMARY_DEV_USERNAME}
            </li>
          </ul>
        </section>

        <section className="dev-config-section">
          <div className="dev-config-row">
            <h3>Prank do cursor (board)</h3>
            <label className={`dev-config-toggle ${!canEditDevConfig ? 'dev-config-toggle--disabled' : ''}`}>
              <input
                type="checkbox"
                checked={Boolean(config.prankEnabled)}
                onChange={onTogglePrank}
                disabled={!canEditDevConfig || saving}
              />
              <span>{config.prankEnabled ? 'Ativo' : 'Desligado'}</span>
            </label>
          </div>
          <p className="dev-config-panel__subhint">
            Arrastar cursor remoto, botão direito para congelar colega. Só contas DEV.
          </p>
        </section>

        <section className="dev-config-section">
          <h3>Contas DEV extras</h3>
          {canEditDevConfig && (
            <div className="dev-config-add">
              <input
                type="text"
                className="dev-config-input"
                placeholder="email ou @username"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onAddDev();
                  }
                }}
                disabled={saving}
              />
              <button
                type="button"
                className="btn btn-primary btn-sm dev-config-add__btn"
                onClick={onAddDev}
                disabled={saving}
              >
                <UserPlus size={16} aria-hidden />
                Adicionar
              </button>
            </div>
          )}
          {displayError && (
            <p className="dev-config-error" role="alert">
              {displayError}
            </p>
          )}
          <ul className="dev-config-list">
            {(config.additionalDevs || []).length === 0 && (
              <li className="dev-config-list__empty">Nenhuma conta extra</li>
            )}
            {(config.additionalDevs || []).map((entry) => (
              <li key={devEntryKey(entry)}>
                <span className="dev-config-tag">{entry.kind}</span>
                <span className="dev-config-list__label">{entry.label}</span>
                {canEditDevConfig && (
                  <button
                    type="button"
                    className="dev-config-remove"
                    onClick={() => onRemoveDev(entry)}
                    disabled={saving}
                    aria-label={`Remover ${entry.label}`}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>

        {isPrimaryDev && (
          <p className="dev-config-panel__footer">Alterações valem para todos (Supabase).</p>
        )}
      </div>
    </div>
  );
}
