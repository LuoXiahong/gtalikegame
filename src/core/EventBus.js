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
    }
};
