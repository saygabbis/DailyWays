import LeftToolbar from './LeftToolbar';
import ViewportControlsBar from './ViewportControlsBar';
import './WhiteboardBottomChrome.css';

/** Barra inferior do canvas: ferramentas e controles de vista lado a lado (quebram linha se faltar espaço). */
export default function WhiteboardBottomChrome({ toolbarProps, viewportControlsProps }) {
    return (
        <div className="whiteboard-bottom-chrome" onPointerDown={(e) => e.stopPropagation()}>
            <div className="whiteboard-bottom-chrome__toolbar">
                <LeftToolbar variant="bottom" {...toolbarProps} />
            </div>
            <ViewportControlsBar {...viewportControlsProps} />
        </div>
    );
}
