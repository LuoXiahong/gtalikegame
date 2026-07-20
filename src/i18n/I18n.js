/**
 * I18n — UI localization (pl, en, de, es, fr).
 */
import { EventBus } from '../core/EventBus.js';
import { catalogs, SUPPORTED_LOCALES, LOCALE_NATIVE_NAMES } from './locales.js';

const DEFAULT_LOCALE = 'en';

function interpolate(template, params) {
    if (!params) return template;
    return String(template).replace(/\{(\w+)\}/g, (match, key) => {
        if (Object.prototype.hasOwnProperty.call(params, key)) {
            return String(params[key]);
        }
        return match;
    });
}

export const I18n = {
    locale: DEFAULT_LOCALE,
    _ready: false,

    init(locale) {
        const code = this.normalize(locale) || DEFAULT_LOCALE;
        this.locale = code;
        this._ready = true;
        this._applyDocumentLang();
    },

    normalize(code) {
        if (!code || typeof code !== 'string') return null;
        const lower = code.toLowerCase().slice(0, 2);
        return SUPPORTED_LOCALES.includes(lower) ? lower : null;
    },

    getLocale() {
        return this.locale;
    },

    getSupportedLocales() {
        return SUPPORTED_LOCALES.slice();
    },

    getLocaleLabel(code) {
        return LOCALE_NATIVE_NAMES[code] || code;
    },

    /**
     * @param {string} code
     * @param {{ silent?: boolean }} [opts]
     */
    setLocale(code, opts = {}) {
        const next = this.normalize(code);
        if (!next || next === this.locale) return false;
        this.locale = next;
        this._applyDocumentLang();
        if (!opts.silent) {
            EventBus.emit('locale_change', { locale: next });
        }
        return true;
    },

    /**
     * @param {string} key
     * @param {Record<string, string|number>} [params]
     */
    t(key, params) {
        const cat = catalogs[this.locale] || catalogs[DEFAULT_LOCALE];
        const fallback = catalogs[DEFAULT_LOCALE];
        const raw = (cat && cat[key]) ?? (fallback && fallback[key]) ?? key;
        return interpolate(raw, params);
    },

    _applyDocumentLang() {
        if (typeof document !== 'undefined' && document.documentElement) {
            document.documentElement.lang = this.locale;
        }
    },
};

export { SUPPORTED_LOCALES, LOCALE_NATIVE_NAMES };
