import { useState, useEffect, useRef, useCallback } from 'react';
import { useRadio } from '../../context/RadioContext';
import { Play, Pause, SkipBack, SkipForward, X, Minimize2, Music, Volume2 } from 'lucide-react';
import './RadioWidget.css';

const DEFAULT_SIZE = { width: 360, height: 180 };
const DEFAULT_MINI_SIZE = { width: 64, height: 64 };
const DEFAULT_POS = () => ({ x: window.innerWidth - 420, y: window.innerHeight - 300 });

export default function RadioWidget() {
    const {
        isOpen, isMinimized, isPlaying, isLoading, lastError, currentStation, volume, setVolume,
        setIsOpen, togglePlay, nextStation, prevStation, toggleMinimize, closeRadio
    } = useRadio();

    const [position, setPosition] = useState(DEFAULT_POS);
    const [size, setSize] = useState(DEFAULT_SIZE);
    const miniSize = DEFAULT_MINI_SIZE;

    useEffect(() => {
        if (isOpen) {
            if (position.x > window.innerWidth - 80 || position.y > window.innerHeight - 80) {
                setPosition(DEFAULT_POS());
            }
        }
    }, [isOpen]);

    // Drag & Resize logic ──────────────────────────────────────────────────
    const [isDragging, setIsDragging] = useState(false);
    const [isActuallyDragging, setIsActuallyDragging] = useState(false);
    const dragDistance = useRef(0);
    const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
    const [resizeDir, setResizeDir] = useState(null);
    const resizeStart = useRef({ width: 0, height: 0, mouseX: 0, mouseY: 0 });
    const widgetRef = useRef(null);

    const handleMouseDownDrag = useCallback((e) => {
        if (e.target.closest('button') || e.target.closest('.slider-wrapper-mini')) return;
        e.preventDefault();
        dragDistance.current = 0;
        dragStart.current = { x: e.clientX, y: e.clientY, posX: position.x, posY: position.y };
        setIsDragging(true);
    }, [position]);

    const startResize = useCallback((dir) => (e) => {
        e.preventDefault();
        e.stopPropagation();
        const currentW = widgetRef.current?.offsetWidth || size.width;
        const currentH = widgetRef.current?.offsetHeight || size.height;
        resizeStart.current = { width: currentW, height: currentH, mouseX: e.clientX, mouseY: e.clientY };
        setResizeDir(dir);
    }, [size]);

    // Custom Volume Slider Drag Logic (FIXED 1:1 Mapping) ────────────────────
    const [isDraggingVolume, setIsDraggingVolume] = useState(false);
    const volumeRef = useRef(null);

    const updateVolume = useCallback((e) => {
        if (!volumeRef.current) return;
        const rect = volumeRef.current.getBoundingClientRect();
        // Calculate raw relative position [0, 1]
        const x = e.clientX - rect.left;
        const relX = Math.max(0, Math.min(x / rect.width, 1));
        setVolume(relX);
    }, [setVolume]);

    const handleVolumeMouseDown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingVolume(true);
        updateVolume(e);
    };

    useEffect(() => {
        const onMove = (e) => {
            if (isDragging && !resizeDir) {
                const dx = e.clientX - dragStart.current.x;
                const dy = e.clientY - dragStart.current.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 3 || isActuallyDragging) {
                    if (!isActuallyDragging) setIsActuallyDragging(true);
                    dragDistance.current = dist;
                    const w = widgetRef.current?.offsetWidth || 300;
                    const h = widgetRef.current?.offsetHeight || 180;
                    setPosition({
                        x: Math.max(10, Math.min(dragStart.current.posX + dx, window.innerWidth - w - 10)),
                        y: Math.max(10, Math.min(dragStart.current.posY + dy, window.innerHeight - h - 10)),
                    });
                }
            }
            if (resizeDir) {
                const dx = e.clientX - resizeStart.current.mouseX;
                const dy = e.clientY - resizeStart.current.mouseY;
                setSize({
                    width: Math.min(600, Math.max(300, resizeStart.current.width + dx)),
                    height: Math.min(400, Math.max(160, resizeStart.current.height + dy)),
                });
            }
            if (isDraggingVolume) {
                updateVolume(e);
            }
        };

        const onUp = () => {
            setIsDragging(false);
            setIsActuallyDragging(false);
            setResizeDir(null);
            setIsDraggingVolume(false);
        };

        if (isDragging || resizeDir || isDraggingVolume) {
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        }
        return () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
    }, [isDragging, isActuallyDragging, resizeDir, isDraggingVolume, updateVolume]);

    if (!isOpen) return null;

    const widgetStyle = isMinimized
        ? { left: position.x, top: position.y, width: miniSize.width, height: miniSize.height }
        : { left: position.x, top: position.y, width: size.width, height: size.height };

    const handleMiniClick = (e) => {
        if (e.target.closest('.bolinha-center-icon')) {
            e.stopPropagation();
            togglePlay();
            return;
        }
        if (dragDistance.current < 5) {
            toggleMinimize();
        }
    };

    return (
        <div
            ref={widgetRef}
            className={`radio-overhaul ${isMinimized ? 'minimized' : ''} ${isActuallyDragging ? 'dragging' : ''} animate-scale-in`}
            style={widgetStyle}
        >
            {!isMinimized ? (
                <>
                    <div className="radio-glass-header" onMouseDown={handleMouseDownDrag}>
                        <div className="radio-header-brand">
                            <Music size={14} />
                            <span>RADIO TUNER</span>
                        </div>
                        <div className="radio-header-actions">
                            <button className="btn-head" onClick={toggleMinimize} title="Minimizar"><Minimize2 size={12} /></button>
                            <button className="btn-head" onClick={closeRadio} title="Fechar"><X size={12} /></button>
                        </div>
                    </div>

                    <div className="radio-player-body">
                        {/* Compact Display Area */}
                        <div className="player-display-compact">
                            <div className="visualizer-content">
                                <div className="rustic-reel-mini">
                                    <div className={`reel-inner-mini ${isPlaying ? 'spin-fast' : ''}`} />
                                </div>
                                <div className="station-center-info">
                                    <div className="modern-stripe-mini" style={{ background: currentStation.color }} />
                                    <div className="station-name-centered">{currentStation.name}</div>
                                </div>
                                <div className="rustic-reel-mini">
                                    <div className={`reel-inner-mini ${isPlaying ? 'spin-fast' : ''}`} />
                                </div>
                            </div>

                            {lastError && (
                                <div className="error-overlay-compact" onClick={togglePlay}>
                                    <div className="error-msg-mini text-center">{lastError}</div>
                                </div>
                            )}
                        </div>

                        {/* Controls Section */}
                        <div className="player-controls-compact">
                            <div className="playback-row">
                                <button className="btn-nav-mini" onClick={prevStation} title="Anterior">
                                    <SkipBack size={20} fill="currentColor" />
                                </button>
                                <button className={`btn-play-compact ${isLoading ? 'is-loading' : ''}`} onClick={togglePlay}>
                                    {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" style={{ marginLeft: '2px' }} />}
                                </button>
                                <button className="btn-nav-mini" onClick={nextStation} title="Próxima">
                                    <SkipForward size={20} fill="currentColor" />
                                </button>
                            </div>

                            <div className="live-status-bottom">
                                <div className={`status-dot ${isPlaying ? 'pulse' : ''}`} />
                                {isLoading ? 'BUFF' : isPlaying ? 'LIVE' : 'OFF'}
                            </div>

                            <div className="volume-row-compact">
                                <Volume2 size={12} className="v-icon" />
                                <div
                                    ref={volumeRef}
                                    className={`slider-wrapper-mini ${isDraggingVolume ? 'is-dragging' : ''}`}
                                    onMouseDown={handleVolumeMouseDown}
                                >
                                    <div className="v-track-mini" style={{ width: `${volume * 100}%`, background: currentStation.color }}>
                                        <div className="v-thumb-mini" style={{ background: currentStation.color }} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="resize-handle-modern" onMouseDown={startResize('se')} />
                    </div>
                </>
            ) : (
                <div
                    className={`radio-bolinha ${isPlaying ? 'is-playing' : ''}`}
                    onMouseDown={handleMouseDownDrag}
                    onClick={handleMiniClick}
                    style={{ '--accent-station': currentStation.color }}
                >
                    <div className="bolinha-rings">
                        <div className="ring" />
                        <div className="ring" />
                    </div>
                    <div className="bolinha-outer-area" />
                    <div className="bolinha-center-icon">
                        {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" style={{ marginLeft: '1px' }} />}
                    </div>
                    {isLoading && <div className="bolinha-loader-mini" />}
                </div>
            )}
        </div>
    );
}
