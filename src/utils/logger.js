/**
 * Logging central: em produção, console.log/info/debug/trace são removidos no build;
 * warn/error mantêm-se. Em dev, use `debug` para ruído; `warn`/`error` para problemas reais.
 * Defina VITE_DEBUG=1 para ver `debug` mesmo num build local de preview.
 */
const allowVerbose = import.meta.env.DEV || import.meta.env.VITE_DEBUG === '1';

export const logger = {
    debug: (...args) => {
        if (allowVerbose) console.log(...args);
    },
    info: (...args) => {
        if (allowVerbose) console.info(...args);
    },
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args),
};
