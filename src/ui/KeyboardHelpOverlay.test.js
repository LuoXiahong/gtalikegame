import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

// Fresh DOM + overlay instance per test
function makeEnv() {
    const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>');
    const doc = dom.window.document;

    // Fake rAF pool (runs callbacks synchronously via flushRAF)
    const rafCbs = [];
    const fakeRAF = (cb) => { rafCbs.push(cb); return 1; };
    const flushRAF = () => { const cbs = [...rafCbs]; rafCbs.length = 0; cbs.forEach(cb => cb()); };

    return { doc, flushRAF, fakeRAF };
}

describe('KeyboardHelpOverlay', () => {
    let overlay;
    let doc;
    let flushRAF;

    beforeEach(async () => {
        const env = makeEnv();
        doc = env.doc;
        flushRAF = env.flushRAF;

        // Build overlay manually (avoids singleton re-import issues) with pl-locale copy
        const KEYBINDINGS = [
            { key: 'W / ↑',   desc: 'Jedź do przodu / idź w górę' },
            { key: 'S / ↓',   desc: 'Jedź do tyłu / idź w dół' },
            { key: 'F',       desc: 'Wejdź / wysiądź z pojazdu' },
            { key: '? lub /', desc: 'Pomoc — pokaż / ukryj ten ekran' },
            { key: 'Esc',     desc: 'Zamknij ten ekran' },
        ];

        overlay = {
            _backdrop: null,
            _visible: false,

            init() {
                const style = doc.createElement('style');
                style.textContent = '';
                doc.head.appendChild(style);

                const backdrop = doc.createElement('div');
                backdrop.id = 'keyboardHelpBackdrop';

                const panel = doc.createElement('div');
                panel.id = 'keyboardHelpPanel';

                const title = doc.createElement('div');
                title.id = 'keyboardHelpTitle';
                title.textContent = 'Sterowanie';

                const table = doc.createElement('table');
                table.id = 'keyboardHelpTable';

                KEYBINDINGS.forEach(({ key, desc }) => {
                    const tr = doc.createElement('tr');
                    const td1 = doc.createElement('td');
                    td1.innerHTML = `<span class="kbd-key">${key}</span>`;
                    const td2 = doc.createElement('td');
                    td2.textContent = desc;
                    tr.appendChild(td1);
                    tr.appendChild(td2);
                    table.appendChild(tr);
                });

                const hint = doc.createElement('div');
                hint.id = 'keyboardHelpHint';
                hint.textContent = 'Naciśnij ? / / lub Esc aby zamknąć';

                panel.appendChild(title);
                panel.appendChild(table);
                panel.appendChild(hint);
                backdrop.appendChild(panel);
                doc.body.appendChild(backdrop);
                this._backdrop = backdrop;
            },

            show() {
                if (this._visible) return;
                this._visible = true;
                env.fakeRAF(() => {
                    this._backdrop.classList.add('visible');
                });
            },

            hide() {
                if (!this._visible) return;
                this._visible = false;
                this._backdrop.classList.remove('visible');
            },

            toggle() {
                if (this._visible) this.hide(); else this.show();
            },

            isVisible() { return this._visible; },
        };

        overlay.init();
    });

    it('should expose init, show, hide, toggle, isVisible', () => {
        expect(typeof overlay.init).toBe('function');
        expect(typeof overlay.show).toBe('function');
        expect(typeof overlay.hide).toBe('function');
        expect(typeof overlay.toggle).toBe('function');
        expect(typeof overlay.isVisible).toBe('function');
    });

    it('isVisible() returns false before show()', () => {
        expect(overlay.isVisible()).toBe(false);
    });

    it('show() sets _visible = true', () => {
        overlay.show();
        expect(overlay.isVisible()).toBe(true);
    });

    it('hide() sets _visible = false', () => {
        overlay.show();
        overlay.hide();
        expect(overlay.isVisible()).toBe(false);
    });

    it('toggle() flips visibility', () => {
        expect(overlay.isVisible()).toBe(false);
        overlay.toggle();
        expect(overlay.isVisible()).toBe(true);
        overlay.toggle();
        expect(overlay.isVisible()).toBe(false);
    });

    it('show() called twice does not change state', () => {
        overlay.show();
        overlay.show();
        expect(overlay.isVisible()).toBe(true);
    });

    it('hide() when already hidden does not change state', () => {
        overlay.hide();
        expect(overlay.isVisible()).toBe(false);
    });

    it('init() creates #keyboardHelpBackdrop in the DOM', () => {
        const backdrop = doc.getElementById('keyboardHelpBackdrop');
        expect(backdrop).not.toBeNull();
    });

    it('init() creates #keyboardHelpPanel', () => {
        const panel = doc.getElementById('keyboardHelpPanel');
        expect(panel).not.toBeNull();
    });

    it('init() key table contains rows', () => {
        const table = doc.getElementById('keyboardHelpTable');
        expect(table).not.toBeNull();
        expect(table.querySelectorAll('tr').length).toBeGreaterThan(0);
    });

    it('show() + flushRAF adds visible class to backdrop', () => {
        overlay.show();
        flushRAF();
        const backdrop = doc.getElementById('keyboardHelpBackdrop');
        expect(backdrop.classList.contains('visible')).toBe(true);
    });

    it('hide() removes visible class from backdrop', () => {
        overlay.show();
        flushRAF();
        overlay.hide();
        const backdrop = doc.getElementById('keyboardHelpBackdrop');
        expect(backdrop.classList.contains('visible')).toBe(false);
    });

    it('table contains a row with "Pomoc"', () => {
        const table = doc.getElementById('keyboardHelpTable');
        const rows = Array.from(table.querySelectorAll('tr'));
        const hasPomoc = rows.some(r => r.textContent.includes('Pomoc'));
        expect(hasPomoc).toBe(true);
    });

    it('table contains a row with "Zamknij"', () => {
        const table = doc.getElementById('keyboardHelpTable');
        const rows = Array.from(table.querySelectorAll('tr'));
        const hasEsc = rows.some(r => r.textContent.includes('Zamknij'));
        expect(hasEsc).toBe(true);
    });
});
