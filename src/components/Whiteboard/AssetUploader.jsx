import React, { useRef } from 'react';
import { useWhiteboardStore } from '../../stores/whiteboardStore';
import { useAuth } from '../../context/AuthContext';
import { uploadSpaceAsset } from '../../services/whiteboardService';
import { insertNode } from '../../services/whiteboardService';
import { ImagePlus } from 'lucide-react';

export default function AssetUploader({ viewport, containerRef }) {
    const inputRef = useRef(null);
    const { user } = useAuth();
    const { spaceId, addNode, setSuppressRealtimeUntil } = useWhiteboardStore();

    const handleFile = async (e) => {
        const file = e.target?.files?.[0];
        if (!file || !spaceId || !file.type.startsWith('image/')) return;
        setSuppressRealtimeUntil(2000);
        const { url } = await uploadSpaceAsset(spaceId, file, user?.id);
        if (!url) return;
        const rect = containerRef?.current?.getBoundingClientRect();
        const worldX = -100;
        const worldY = -75;
        const node = {
            id: crypto.randomUUID(),
            type: 'image',
            x: worldX,
            y: worldY,
            width: 200,
            height: 150,
            rotation: 0,
            scale: 1,
            data: { url },
            style: {},
            parentId: null,
            zIndex: 0,
        };
        const res = await insertNode(spaceId, node, user?.id);
        if (res.success) addNode(node);
        e.target.value = '';
    };

    return (
        <>
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFile}
            />
            <button
                type="button"
                className="toolbar-btn"
                onClick={() => inputRef.current?.click()}
                title="Enviar imagem"
            >
                <ImagePlus size={16} />
            </button>
        </>
    );
}
