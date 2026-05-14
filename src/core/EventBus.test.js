import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from './EventBus.js';

describe('EventBus', () => {
    beforeEach(() => {
        // Czyszczenie stanu przed każdym testem
        EventBus.listeners = {};
    });

    it('should register a listener for an event', () => {
        const callback = vi.fn();
        EventBus.on('testEvent', callback);

        expect(EventBus.listeners['testEvent']).toBeDefined();
        expect(EventBus.listeners['testEvent'].length).toBe(1);
        expect(EventBus.listeners['testEvent'][0]).toBe(callback);
    });

    it('should emit an event and call the registered listeners with data', () => {
        const callback1 = vi.fn();
        const callback2 = vi.fn();
        
        EventBus.on('testEvent', callback1);
        EventBus.on('testEvent', callback2);

        const testData = { foo: 'bar' };
        EventBus.emit('testEvent', testData);

        expect(callback1).toHaveBeenCalledTimes(1);
        expect(callback1).toHaveBeenCalledWith(testData);

        expect(callback2).toHaveBeenCalledTimes(1);
        expect(callback2).toHaveBeenCalledWith(testData);
    });

    it('should safely emit an event even if there are no listeners', () => {
        // Nie powinno rzucić wyjątku
        expect(() => {
            EventBus.emit('nonExistentEvent', { data: 123 });
        }).not.toThrow();
    });

    it('should unregister a listener using off', () => {
        const callback1 = vi.fn();
        const callback2 = vi.fn();

        EventBus.on('testEvent', callback1);
        EventBus.on('testEvent', callback2);

        EventBus.off('testEvent', callback1);

        EventBus.emit('testEvent', { a: 1 });

        expect(callback1).not.toHaveBeenCalled();
        expect(callback2).toHaveBeenCalledTimes(1);

        EventBus.off('testEvent', callback2);
        expect(EventBus.listeners['testEvent']).toBeUndefined();
    });

    it('should clear all listeners using clear', () => {
        const callback = vi.fn();
        EventBus.on('testEvent', callback);
        EventBus.clear();

        expect(Object.keys(EventBus.listeners).length).toBe(0);
    });
});
