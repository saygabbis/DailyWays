import { useRef, useState, useCallback, useEffect } from 'react';
import './AvatarCropper.css';

/**
 * AvatarCropper
 * Canvas-based 1:1 image crop modal. No external dependencies.
 * Usage: <AvatarCropper onApply={blob => ...} onClose={() => ...} />
 */
export default function AvatarCropper({ onApply, onClose, t = {} }) {
    const [imgSrc, setImgSrc] = useState(null);
    const [imgObj, setImgObj] = useState(null);
    const [dragging, setDragging] = useState(false);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [scale, setScale] = useState(1);
    const [uploading, setUploading] = useState(false);

    const canvasRef = useRef(null);
    const fileRef = useRef(null);
    const lastPointer = useRef(null);

    // Canvas dimensions
    const SIZE = 280; // display size
    const OUTPUT = 400; // output size

    // ── Draw crop circle frame on canvas ──
    const draw = useCallback((img, ox, oy, sc) => {
        const canvas = canvasRef.current;
        if (!canvas || !img) return;
        const ctx = canvas.getContext('2d');
        canvas.width = SIZE;
        canvas.height = SIZE;

        // Background
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, SIZE, SIZE);

        // Scaled image
        const sw = img.width * sc;
        const sh = img.height * sc;
        ctx.drawImage(img, ox, oy, sw, sh);

        // Dim outside circle
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, SIZE, SIZE);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Circle border
        ctx.strokeStyle = 'var(--accent-primary, #7c3aed)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 4, 0, Math.PI * 2);
        ctx.stroke();
    }, []);

    useEffect(() => {
        if (imgObj) draw(imgObj, offset.x, offset.y, scale);
    }, [imgObj, offset, scale, draw]);

    // ── File input → load image ──
    const handleFile = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            setImgSrc(ev.target.result);
            const img = new Image();
            img.onload = () => {
                setImgObj(img);
                // Center image to fill the crop circle
                const sc = Math.max(SIZE / img.width, SIZE / img.height);
                const ox = (SIZE - img.width * sc) / 2;
                const oy = (SIZE - img.height * sc) / 2;
                setScale(sc);
                setOffset({ x: ox, y: oy });
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    };

    // ── Drag to reposition ──
    const onPointerDown = (e) => {
        setDragging(true);
        lastPointer.current = { x: e.clientX, y: e.clientY };
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e) => {
        if (!dragging || !lastPointer.current) return;
        const dx = e.clientX - lastPointer.current.x;
        const dy = e.clientY - lastPointer.current.y;
        lastPointer.current = { x: e.clientX, y: e.clientY };
        setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    };

    const onPointerUp = () => { setDragging(false); lastPointer.current = null; };

    // ── Pinch/scroll to zoom ──
    const onWheel = (e) => {
        e.preventDefault();
        setScale(prev => Math.min(5, Math.max(0.2, prev - e.deltaY * 0.001)));
    };

    // ── Apply: render to offscreen canvas → blob ──
    const handleApply = async () => {
        if (!imgObj) return;
        setUploading(true);
        // Render high-res output
        const off = document.createElement('canvas');
        off.width = OUTPUT;
        off.height = OUTPUT;
        const ctx = off.getContext('2d');

        // Clip circle
        ctx.beginPath();
        ctx.arc(OUTPUT / 2, OUTPUT / 2, OUTPUT / 2, 0, Math.PI * 2);
        ctx.clip();

        // Scale offset from SIZE to OUTPUT
        const ratio = OUTPUT / SIZE;
        ctx.drawImage(
            imgObj,
            offset.x * ratio,
            offset.y * ratio,
            imgObj.width * scale * ratio,
            imgObj.height * scale * ratio
        );

        off.toBlob(async (blob) => {
            await onApply(blob);
            setUploading(false);
        }, 'image/jpeg', 0.92);
    };

    return (
        <div className="cropper-backdrop" onClick={onClose}>
            <div className="cropper-modal" onClick={e => e.stopPropagation()}>
                <h3 className="cropper-title">{t.cropTitle || 'Ajustar foto de perfil'}</h3>
                <p className="cropper-hint">{t.cropHint || 'Arraste para reposicionar · Scroll para zoom'}</p>

                {!imgSrc ? (
                    <div className="cropper-upload-area" onClick={() => fileRef.current?.click()}>
                        <div className="cropper-upload-icon">📷</div>
                        <p>{t.cropUploadClick || 'Clique para selecionar uma imagem'}</p>
                        <span>{t.cropUploadFormats || 'JPG, PNG, WebP · máx. 5MB'}</span>
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            style={{ display: 'none' }}
                            onChange={handleFile}
                        />
                    </div>
                ) : (
                    <canvas
                        ref={canvasRef}
                        className="cropper-canvas"
                        width={SIZE}
                        height={SIZE}
                        style={{ cursor: dragging ? 'grabbing' : 'grab' }}
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerUp}
                        onWheel={onWheel}
                    />
                )}

                <div className="cropper-actions">
                    <button className="btn btn-ghost" onClick={onClose}>
                        {t.cancel || 'Cancelar'}
                    </button>
                    {imgSrc && (
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => { setImgSrc(null); setImgObj(null); }}
                        >
                            {t.cropSwap || 'Trocar foto'}
                        </button>
                    )}
                    <button
                        className="btn btn-primary"
                        onClick={handleApply}
                        disabled={!imgObj || uploading}
                    >
                        {uploading ? (t.cropApplying || 'Enviando...') : (t.cropApply || 'Aplicar')}
                    </button>
                </div>
            </div>
        </div>
    );
}
