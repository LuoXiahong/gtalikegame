/**
 * ZARZĄDZANIE WEJŚCIEM (Input System)
 */
export const InputSystem = {
    keys: { up: false, down: false, left: false, right: false, action: false, shoot: false, explode: false, debugAI: false, viewToggle: false, zoomToggle: false, help: false },
    actionJustPressed: false,
    shootJustPressed: false,
    explodeJustPressed: false,
    debugAIJustPressed: false,
    viewToggleJustPressed: false,
    zoomToggleJustPressed: false,
    helpJustPressed: false,

    init() {
        window.addEventListener("keydown", (e) => {
            if (e.code === "Space" || e.key === " ") e.preventDefault();
            this.setKey(e.code, true);
        });
        window.addEventListener("keyup", (e) => this.setKey(e.code, false));

        this.bindHUD('btnUp', 'up');
        this.bindHUD('btnDown', 'down');
        this.bindHUD('btnLeft', 'left');
        this.bindHUD('btnRight', 'right');
        this.bindHUD('btnAction', 'action');
    },

    setKey(code, state) {
        if (code === "ArrowUp" || code === "KeyW") this.keys.up = state;
        if (code === "ArrowDown" || code === "KeyS") this.keys.down = state;
        if (code === "ArrowLeft" || code === "KeyA") this.keys.left = state;
        if (code === "ArrowRight" || code === "KeyD") this.keys.right = state;
        if (code === "Backquote") {
            if (state && !this.keys.debugAI) this.debugAIJustPressed = true;
            this.keys.debugAI = state;
        }
        if (code === "KeyF") {
            if (state && !this.keys.action) this.actionJustPressed = true;
            this.keys.action = state;
        }
        if (code === "Space") {
            if (state && !this.keys.shoot) this.shootJustPressed = true;
            this.keys.shoot = state;
        }
        if (code === "KeyE") {
            if (state && !this.keys.explode) this.explodeJustPressed = true;
            this.keys.explode = state;
        }
        if (code === "KeyV") {
            if (state && !this.keys.viewToggle) this.viewToggleJustPressed = true;
            this.keys.viewToggle = state;
        }
        if (code === "KeyZ") {
            if (state && !this.keys.zoomToggle) this.zoomToggleJustPressed = true;
            this.keys.zoomToggle = state;
        }
        // Slash (/) i Shift+Slash (?) — pomoc; NIE blokujemy propagacji (overlay obsługuje sam)
        if (code === "Slash") {
            if (state && !this.keys.help) this.helpJustPressed = true;
            this.keys.help = state;
        }
    },

    consumeDebugAI() {
        const pressed = this.debugAIJustPressed;
        this.debugAIJustPressed = false;
        return pressed;
    },

    consumeAction() {
        const pressed = this.actionJustPressed;
        this.actionJustPressed = false;
        return pressed;
    },

    consumeShoot() {
        const pressed = this.shootJustPressed;
        this.shootJustPressed = false;
        return pressed;
    },

    consumeExplode() {
        const pressed = this.explodeJustPressed;
        this.explodeJustPressed = false;
        return pressed;
    },

    consumeViewToggle() {
        const pressed = this.viewToggleJustPressed;
        this.viewToggleJustPressed = false;
        return pressed;
    },

    consumeZoomToggle() {
        const pressed = this.zoomToggleJustPressed;
        this.zoomToggleJustPressed = false;
        return pressed;
    },

    consumeHelp() {
        const pressed = this.helpJustPressed;
        this.helpJustPressed = false;
        return pressed;
    },

    resetAll() {
        for (const key in this.keys) {
            this.keys[key] = false;
        }
        this.actionJustPressed = false;
        this.shootJustPressed = false;
        this.explodeJustPressed = false;
        this.debugAIJustPressed = false;
        this.viewToggleJustPressed = false;
        this.zoomToggleJustPressed = false;
        this.helpJustPressed = false;
    },

    bindHUD(elementId, keyName) {
        const btn = document.getElementById(elementId);
        if (!btn) return;

        btn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            if (!this.keys[keyName]) {
                if (keyName === 'action') this.actionJustPressed = true;
                if (keyName === 'shoot') this.shootJustPressed = true;
                if (keyName === 'explode') this.explodeJustPressed = true;
            }
            this.keys[keyName] = true;
        });
        btn.addEventListener('pointerup', (e) => { e.preventDefault(); this.keys[keyName] = false; });
        btn.addEventListener('pointerleave', (e) => { e.preventDefault(); this.keys[keyName] = false; });
        btn.addEventListener('pointercancel', (e) => { e.preventDefault(); this.keys[keyName] = false; });
    }
};
