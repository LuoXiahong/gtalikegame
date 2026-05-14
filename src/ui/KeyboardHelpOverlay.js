/**
 * UI: KeyboardHelpOverlay
 * Nakładka z listą wszystkich klawiszy gry.
 * Otwierana przez ? lub / — zamykana przez te same klawisze, Esc lub kliknięcie tła.
 */

const KEYBINDINGS = [
    { key: 'W / ↑',       desc: 'Jedź do przodu / idź w górę' },
    { key: 'S / ↓',       desc: 'Jedź do tyłu / idź w dół' },
    { key: 'A / ←',       desc: 'Skręć / obróć w lewo' },
    { key: 'D / →',       desc: 'Skręć / obróć w prawo' },
    { key: 'F',           desc: 'Wejdź / wysiądź z pojazdu' },
    { key: 'Spacja',      desc: 'Strzał' },
    { key: 'E',           desc: 'Eksplozja' },
    { key: 'V',           desc: 'Przełącz widok 2D / 3D' },
    { key: 'Z',           desc: 'Zoom kamery (przybliż / oddal)' },
    { key: '` (backtick)',desc: 'Tryb debug AI' },
    { key: '? lub /',     desc: 'Pomoc — pokaż / ukryj ten ekran' },
    { key: 'Esc',         desc: 'Zamknij ten ekran' },
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
    font-family: system-ui, -apple-system, sans-serif;
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
    font-family: monospace;
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

    init() {
        // Wstrzyknięcie stylów
        const style = document.createElement('style');
        style.textContent = CSS;
        document.head.appendChild(style);

        // Budowanie DOM
        const backdrop = document.createElement('div');
        backdrop.id = 'keyboardHelpBackdrop';

        const panel = document.createElement('div');
        panel.id = 'keyboardHelpPanel';

        const title = document.createElement('div');
        title.id = 'keyboardHelpTitle';
        title.textContent = 'Sterowanie';

        const table = document.createElement('table');
        table.id = 'keyboardHelpTable';

        KEYBINDINGS.forEach(({ key, desc }) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="kbd-key">${key}</span></td>
                <td class="kbd-desc">${desc}</td>
            `;
            table.appendChild(tr);
        });

        const hint = document.createElement('div');
        hint.id = 'keyboardHelpHint';
        hint.textContent = 'Naciśnij ? / / lub Esc aby zamknąć';

        panel.appendChild(title);
        panel.appendChild(table);
        panel.appendChild(hint);
        backdrop.appendChild(panel);
        document.body.appendChild(backdrop);
        this._backdrop = backdrop;

        // Zamknięcie przez kliknięcie tła (poza panelem)
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) this.hide();
        });

        // Obsługa klawiszy: ? / / / Esc
        document.addEventListener('keydown', (e) => {
            if (e.key === '?' || e.key === '/') {
                e.preventDefault();
                this.toggle();
            } else if (e.key === 'Escape' && this._visible) {
                e.preventDefault();
                this.hide();
            }
        });
    },

    show() {
        if (this._visible) return;
        this._visible = true;
        // rAF żeby transition zadziałało po display
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
