/**
 * KeyboardHelpOverlay — full keybinding list (? / / to open; same keys, Esc, or backdrop to close).
 */
import { EventBus } from '../core/EventBus.js';
import { I18n } from '../i18n/I18n.js';

const KEYBINDING_DEFS = [
    { key: 'W / ↑', descKey: 'help.key.moveUp' },
    { key: 'S / ↓', descKey: 'help.key.moveDown' },
    { key: 'A / ←', descKey: 'help.key.turnLeft' },
    { key: 'D / →', descKey: 'help.key.turnRight' },
    { key: 'F', descKey: 'help.key.vehicle' },
    { key: 'Spacja / Space', descKey: 'help.key.shoot' },
    { key: 'E', descKey: 'help.key.explode' },
    { key: 'V', descKey: 'help.key.view' },
    { key: 'Z', descKey: 'help.key.zoom' },
    { key: 'F9', descKey: 'help.key.screenshot' },
    { key: '` (backtick)', descKey: 'help.key.debugAI' },
    { key: 'O', descKey: 'help.key.options' },
    { key: '? / /', descKey: 'help.key.help' },
    { key: 'Esc', descKey: 'help.key.esc' },
];

const CSS = `
#keyboardHelpBackdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(3px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9000;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.22s ease;
}
#keyboardHelpBackdrop.visible {
    opacity: 1;
    pointer-events: all;
}
#keyboardHelpPanel {
    background: rgba(15, 17, 25, 0.88);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 14px;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255,255,255,0.06) inset;
    padding: 28px 36px 32px;
    min-width: 380px;
    max-width: 520px;
    transform: scale(0.92) translateY(12px);
    transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
    font-family: 'Yomogi', cursive;
    color: #e8eaf0;
}
#keyboardHelpBackdrop.visible #keyboardHelpPanel {
    transform: scale(1) translateY(0);
}
#keyboardHelpTitle {
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.45);
    margin: 0 0 18px 0;
    display: flex;
    align-items: center;
    gap: 8px;
}
#keyboardHelpTitle::before {
    content: '';
    display: inline-block;
    width: 3px;
    height: 14px;
    border-radius: 2px;
    background: linear-gradient(180deg, #7c6fff, #4fc3f7);
}
#keyboardHelpTable {
    width: 100%;
    border-collapse: collapse;
}
#keyboardHelpTable tr {
    border-bottom: 1px solid rgba(255,255,255,0.06);
}
#keyboardHelpTable tr:last-child {
    border-bottom: none;
}
#keyboardHelpTable td {
    padding: 9px 0;
    font-size: 14px;
    line-height: 1.4;
    vertical-align: middle;
}
#keyboardHelpTable td:first-child {
    width: 40%;
}
.kbd-key {
    display: inline-block;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.15);
    border-bottom-width: 2px;
    border-radius: 5px;
    padding: 2px 8px;
    font-size: 12px;
    font-family: 'Yomogi', cursive;
    font-weight: 600;
    color: #c8d0e8;
    white-space: nowrap;
}
.kbd-desc {
    color: rgba(255,255,255,0.65);
    padding-left: 12px;
}
#keyboardHelpHint {
    margin-top: 18px;
    text-align: center;
    font-size: 12px;
    color: rgba(255,255,255,0.3);
    letter-spacing: 0.04em;
}
`;

export const KeyboardHelpOverlay = {
    _backdrop: null,
    _visible: false,
    _titleEl: null,
    _hintEl: null,
    _descEls: null,

    init() {
        const style = document.createElement('style');
        style.textContent = CSS;
        document.head.appendChild(style);

        const backdrop = document.createElement('div');
        backdrop.id = 'keyboardHelpBackdrop';

        const panel = document.createElement('div');
        panel.id = 'keyboardHelpPanel';

        const title = document.createElement('div');
        title.id = 'keyboardHelpTitle';
        this._titleEl = title;

        const table = document.createElement('table');
        table.id = 'keyboardHelpTable';

        this._descEls = [];
        KEYBINDING_DEFS.forEach(({ key, descKey }) => {
            const tr = document.createElement('tr');
            const tdKey = document.createElement('td');
            tdKey.innerHTML = `<span class="kbd-key">${key}</span>`;
            const tdDesc = document.createElement('td');
            tdDesc.className = 'kbd-desc';
            tr.appendChild(tdKey);
            tr.appendChild(tdDesc);
            table.appendChild(tr);
            this._descEls.push({ el: tdDesc, descKey });
        });

        const hint = document.createElement('div');
        hint.id = 'keyboardHelpHint';
        this._hintEl = hint;

        panel.appendChild(title);
        panel.appendChild(table);
        panel.appendChild(hint);
        backdrop.appendChild(panel);
        document.body.appendChild(backdrop);
        this._backdrop = backdrop;

        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) this.hide();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === '?' || e.key === '/') {
                e.preventDefault();
                this.toggle();
            } else if (e.key === 'Escape' && this._visible) {
                e.preventDefault();
                this.hide();
            }
        });

        EventBus.on('locale_change', () => this.applyLabels());
        this.applyLabels();
    },

    applyLabels() {
        if (this._titleEl) this._titleEl.textContent = I18n.t('help.title');
        if (this._hintEl) this._hintEl.textContent = I18n.t('help.closeHint');
        (this._descEls || []).forEach(({ el, descKey }) => {
            el.textContent = I18n.t(descKey);
        });
    },

    show() {
        if (this._visible) return;
        this.applyLabels();
        this._visible = true;
        requestAnimationFrame(() => {
            this._backdrop.classList.add('visible');
        });
    },

    hide() {
        if (!this._visible) return;
        this._visible = false;
        this._backdrop.classList.remove('visible');
    },

    toggle() {
        if (this._visible) {
            this.hide();
        } else {
            this.show();
        }
    },

    isVisible() {
        return this._visible;
    },
};
