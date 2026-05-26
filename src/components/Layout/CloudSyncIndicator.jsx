import { useState, useRef, useEffect, useCallback } from 'react';

import { Cloud, Loader2, RefreshCw, RotateCcw, AlertTriangle } from 'lucide-react';

import { useApp } from '../../context/AppContext';

import { useCloudSyncStatus } from '../../hooks/useCloudSyncStatus';

import './CloudSyncIndicator.css';



const MANUAL_SYNC_COOLDOWN_MS = 5000;



export default function CloudSyncIndicator() {

    const { retryFailedSave, revertFailedSave, persistBoard, state } = useApp();

    const {

        status,

        tooltip,

        lastError,

        collabOnActiveBoard,

        saveAllPending,

    } = useCloudSyncStatus();



    const [panelOpen, setPanelOpen] = useState(false);

    const [busyId, setBusyId] = useState(null);

    const [manualSyncing, setManualSyncing] = useState(false);

    const wrapRef = useRef(null);

    const lastManualSyncRef = useRef(0);



    const showPanelOnClick = status === 'error' || (status === 'pending' && !collabOnActiveBoard);



    useEffect(() => {

        if (!panelOpen) return;

        const onDown = (e) => {

            if (wrapRef.current && !wrapRef.current.contains(e.target)) {

                setPanelOpen(false);

            }

        };

        document.addEventListener('mousedown', onDown);

        return () => document.removeEventListener('mousedown', onDown);

    }, [panelOpen]);



    useEffect(() => {

        if (status !== 'error') setPanelOpen(false);

    }, [status]);



    const handleManualSync = useCallback(async () => {

        const boardId = state.activeBoard;

        if (!boardId) return;

        const now = Date.now();

        if (now - lastManualSyncRef.current < MANUAL_SYNC_COOLDOWN_MS) return;

        if (manualSyncing) return;



        lastManualSyncRef.current = now;

        setManualSyncing(true);

        try {

            await persistBoard(boardId, { force: true, ensureSave: true });

        } finally {

            setManualSyncing(false);

        }

    }, [state.activeBoard, persistBoard, manualSyncing]);



    const handleClick = () => {

        if (status === 'synced') {

            handleManualSync();

            return;

        }

        if (showPanelOnClick) setPanelOpen((v) => !v);

    };



    const handleRetry = async () => {

        if (!lastError) return;

        setBusyId(lastError.boardId);

        try {

            await retryFailedSave(lastError.boardId, lastError.boardSnapshot);

            setPanelOpen(false);

        } finally {

            setBusyId(null);

        }

    };



    const handleRevert = async () => {

        if (!lastError) return;

        setBusyId(lastError.boardId);

        try {

            await revertFailedSave(lastError.boardId);

            setPanelOpen(false);

        } finally {

            setBusyId(null);

        }

    };



    const isBusy = lastError && busyId === lastError.boardId;

    const isSynced = status === 'synced';

    const isSaving = status === 'saving' || manualSyncing;

    const clickTitle = isSynced

        ? (manualSyncing

            ? 'A guardar cópia de segurança na nuvem…'

            : 'Guardado na nuvem. Clica para sincronizar manualmente (máx. de 5 em 5 s).')

        : tooltip;



    return (

        <div

            className={`header-cloud-sync header-cloud-sync--${status}${panelOpen ? ' header-cloud-sync--open' : ''}${manualSyncing ? ' header-cloud-sync--manual' : ''}`}

            ref={wrapRef}

        >

            <button

                type="button"

                className={`header-cloud-sync-btn${isSynced ? ' header-cloud-sync-btn--synced' : ''}`}

                title={clickTitle}

                aria-label={clickTitle}

                aria-expanded={panelOpen}

                onClick={handleClick}

                disabled={isSynced && !state.activeBoard}

            >

                <Cloud

                    size={20}

                    className="header-cloud-sync-icon"

                    fill={isSynced ? 'currentColor' : 'none'}

                    strokeWidth={isSynced ? 1.5 : 2}

                />

                {isSaving && (

                    <span className="header-cloud-sync-spinner" aria-hidden>

                        <Loader2 size={22} className="spinning" />

                    </span>

                )}

                {status === 'error' && (

                    <span className="header-cloud-sync-dot header-cloud-sync-dot--error" aria-hidden />

                )}

                {status === 'pending' && !collabOnActiveBoard && (

                    <span className="header-cloud-sync-dot header-cloud-sync-dot--pending" aria-hidden />

                )}

            </button>



            {panelOpen && (

                <div className="header-cloud-sync-panel animate-pop-in" role="dialog" aria-label="Estado da nuvem">

                    {status === 'error' && lastError && (

                        <>

                            <div className="header-cloud-sync-panel-title">

                                <AlertTriangle size={14} />

                                Falha ao guardar na nuvem

                            </div>

                            {lastError.boardTitle && (

                                <p className="header-cloud-sync-panel-meta">{lastError.boardTitle}</p>

                            )}

                            {lastError.message && (

                                <p className="header-cloud-sync-panel-msg">{lastError.message}</p>

                            )}

                            <div className="header-cloud-sync-panel-actions">

                                <button

                                    type="button"

                                    className="btn btn-primary btn-sm"

                                    onClick={handleRetry}

                                    disabled={isBusy}

                                >

                                    {isBusy ? <Loader2 size={14} className="spinning" /> : <RefreshCw size={14} />}

                                    Tentar novamente

                                </button>

                                <button

                                    type="button"

                                    className="btn btn-ghost btn-sm header-cloud-sync-revert"

                                    onClick={handleRevert}

                                    disabled={isBusy}

                                >

                                    <RotateCcw size={14} />

                                    Reverter

                                </button>

                            </div>

                        </>

                    )}

                    {status === 'pending' && !collabOnActiveBoard && (

                        <>

                            <p className="header-cloud-sync-panel-title">Alterações por guardar</p>

                            <p className="header-cloud-sync-panel-msg">

                                As alterações ainda não foram enviadas para a base de dados.

                            </p>

                            <button

                                type="button"

                                className="btn btn-primary btn-sm"

                                onClick={() => {

                                    saveAllPending();

                                    setPanelOpen(false);

                                }}

                            >

                                <Cloud size={14} />

                                Guardar agora

                            </button>

                        </>

                    )}

                </div>

            )}

        </div>

    );

}


