/**
 * CORE: SZYNA ZDARZEŃ (EventBus)
 * Rozwiązuje problem "twardych powiązań" (hard-coupling).
 */
export const EventBus = {
    listeners: {},

    on(event, callback) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    },

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    },

    off(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
            if (this.listeners[event].length === 0) {
                delete this.listeners[event];
            }
        }
    },

    clear() {
        this.listeners = {};
    }
};
