
export function openAppHelp(sectionId = null) {
    window.dispatchEvent(
        new CustomEvent('app-help-open', { detail: sectionId ? { sectionId } : {} })
    );
}
