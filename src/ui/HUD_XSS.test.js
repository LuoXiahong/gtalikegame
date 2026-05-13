import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UISystem } from './HUD.js';
import { EventBus } from '../core/EventBus.js';

describe('UISystem XSS Vulnerability Fix', () => {
    let mockUiLayer;

    beforeEach(() => {
        UISystem.speedValue = 0;
        UISystem.showSpeed = false;
        UISystem.wantedStars = 0;
        UISystem.missionText = '';
        UISystem.currentDialogue = null;
        UISystem.actionHint = null;

        mockUiLayer = {
            style: { display: 'none' },
            innerHTML: ''
        };

        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => {
                if (id === 'uiLayer') return mockUiLayer;
                return { style: {} };
            })
        });

        UISystem.init();
    });

    it('should escape missionText', () => {
        const payload = '<img src=x onerror=alert(1)>';
        const expected = '&lt;img src=x onerror=alert(1)&gt;';
        EventBus.emit('mission_update', payload);

        expect(mockUiLayer.innerHTML).toContain(expected);
        expect(mockUiLayer.innerHTML).not.toContain(payload);
    });

    it('should escape currentDialogue', () => {
        const payload = '<svg onload=alert(1)>';
        const expected = '&lt;svg onload=alert(1)&gt;';
        EventBus.emit('ui_show_dialogue', payload);

        expect(mockUiLayer.innerHTML).toContain(expected);
        expect(mockUiLayer.innerHTML).not.toContain(payload);
    });

    it('should escape actionHint', () => {
        const payload = '<details open ontoggle=alert(1)>';
        const expected = '&lt;details open ontoggle=alert(1)&gt;';
        EventBus.emit('ui_show_action_hint', payload);

        expect(mockUiLayer.innerHTML).toContain(expected);
        expect(mockUiLayer.innerHTML).not.toContain(payload);
    });
});
