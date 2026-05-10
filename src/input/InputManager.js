/**
 * ZARZĄDZANIE WEJŚCIEM (Input System)
 */
export const InputSystem = {
    keys: { up: false, down: false, left: false, right: false, action: false },
    actionJustPressed: false,

    init() {
        window.addEventListener("keydown", (e) => this.setKey(e.code, true));
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
        if (code === "KeyF") {
            if (state && !this.keys.action) this.actionJustPressed = true;
            this.keys.action = state;
        }
    },

    consumeAction() {
        const pressed = this.actionJustPressed;
        this.actionJustPressed = false;
        return pressed;
    },

    bindHUD(elementId, keyName) {
        const btn = document.getElementById(elementId);
        if (!btn) return;

        btn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            if (!this.keys[keyName]) {
                if (keyName === 'action') this.actionJustPressed = true;
            }
            this.keys[keyName] = true;
        });
        btn.addEventListener('pointerup', (e) => { e.preventDefault(); this.keys[keyName] = false; });
        btn.addEventListener('pointerleave', (e) => { e.preventDefault(); this.keys[keyName] = false; });
        btn.addEventListener('pointercancel', (e) => { e.preventDefault(); this.keys[keyName] = false; });
    }
};
