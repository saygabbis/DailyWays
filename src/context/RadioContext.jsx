import { createContext, useContext, useState, useEffect, useRef } from 'react';

const RadioContext = createContext();

export function useRadio() {
    return useContext(RadioContext);
}

export const RADIO_STATIONS = [
    {
        id: 'lofi-hiphop',
        name: 'Lofi Hip Hop',
        url: 'https://stream.zeno.fm/0r0xa792kwzuv', // Working Lofi
        color: '#ff7eb9'
    },
    {
        id: 'chillhop',
        name: 'Chillhop Music',
        url: 'https://streams.fluxfm.de/Chillhop/mp3-128/streams.fluxfm.de/', // FluxFM Chillhop
        color: '#70d6ff'
    },
    {
        id: 'jazz-lofi',
        name: 'Jazz Lofi',
        url: 'http://ice5.somafm.com/illstreet-128-mp3', // SomaFM Illinois Street Lounge - Ultra Stable 128kbps
        color: '#ff9e00'
    },
    {
        id: 'lofi-beats',
        name: 'Lofi Beats',
        url: 'https://boxradio-edge-00.streamafrica.net/lofi',
        color: '#be95ff'
    }
];

export function RadioProvider({ children }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [lastError, setLastError] = useState(null);
    const [currentStationIndex, setCurrentStationIndex] = useState(0);
    const [volume, setVolume] = useState(0.5);

    const audioRef = useRef(new Audio());

    useEffect(() => {
        // Explicitly clear crossOrigin to ensure simple playback without CORS preflight/blocks
        if (audioRef.current) {
            audioRef.current.crossOrigin = null;
        }
    }, []);

    const currentStation = RADIO_STATIONS[currentStationIndex];

    useEffect(() => {
        const audio = audioRef.current;
        audio.volume = volume;

        const handleLoadStart = () => {
            setIsLoading(true);
            setLastError(null);
        };
        const handleCanPlay = () => setIsLoading(false);
        const handleError = (e) => {
            console.error("Audio error:", e);
            setIsLoading(false);
            setLastError("Erro ao carregar rádio");
        };

        audio.addEventListener('loadstart', handleLoadStart);
        audio.addEventListener('canplay', handleCanPlay);
        audio.addEventListener('error', handleError);

        return () => {
            audio.removeEventListener('loadstart', handleLoadStart);
            audio.removeEventListener('canplay', handleCanPlay);
            audio.removeEventListener('error', handleError);
        };
    }, [volume]);

    useEffect(() => {
        const audio = audioRef.current;

        if (isPlaying) {
            if (audio.src !== currentStation.url) {
                audio.src = currentStation.url;
                audio.load();
            }

            const startPlayback = () => {
                audio.play().catch(err => {
                    console.error("Radio play failed:", err);
                    if (err.name !== 'AbortError') {
                        setIsPlaying(false);
                        setLastError("Clique para tentar novamente");
                    }
                });
            };

            if (audio.readyState >= 2) {
                startPlayback();
            } else {
                audio.oncanplay = () => {
                    startPlayback();
                    audio.oncanplay = null;
                };
            }
        } else {
            audio.pause();
        }
    }, [isPlaying, currentStationIndex, currentStation.url]);

    const togglePlay = () => setIsPlaying(prev => !prev);

    const nextStation = () => {
        setLastError(null);
        setCurrentStationIndex(prev => (prev + 1) % RADIO_STATIONS.length);
    };

    const prevStation = () => {
        setLastError(null);
        setCurrentStationIndex(prev => (prev - 1 + RADIO_STATIONS.length) % RADIO_STATIONS.length);
    };

    const toggleOpen = () => {
        if (!isOpen) {
            setIsOpen(true);
            setIsMinimized(false);
            setIsPlaying(true); // Auto-play on open
        } else {
            if (isPlaying) {
                setIsMinimized(prev => !prev);
            } else {
                setIsOpen(false);
                setIsMinimized(false);
            }
        }
    };

    const closeRadio = () => {
        setIsOpen(false);
        setIsMinimized(false);
        setIsPlaying(false); // STOP playback when closing via 'X'
    };

    const toggleMinimize = () => setIsMinimized(prev => !prev);

    return (
        <RadioContext.Provider value={{
            isOpen,
            isMinimized,
            isPlaying,
            isLoading,
            lastError,
            currentStation,
            volume,
            setVolume,
            setIsOpen,
            setIsMinimized,
            togglePlay,
            nextStation,
            prevStation,
            toggleOpen,
            closeRadio,
            toggleMinimize
        }}>
            {children}
        </RadioContext.Provider>
    );
}
