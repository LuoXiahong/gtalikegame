import { describe, it, expect, vi } from 'vitest';
import {
    MINIMAP_BEZEL_WIDTH,
    minimapContentRadius,
    clipMinimapContent,
    drawMinimapBezel,
    drawMinimapGlass
} from './MinimapBezel.js';

function mockCtx() {
    const grad = { addColorStop: vi.fn() };
    return {
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        arc: vi.fn(),
        clip: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        createConicGradient: vi.fn(() => grad),
        createRadialGradient: vi.fn(() => grad),
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 0,
        lineCap: 'butt',
        _grad: grad
    };
}

describe('MinimapBezel', () => {
    it('reserves a metal ring outside the content disc', () => {
        expect(MINIMAP_BEZEL_WIDTH).toBeGreaterThanOrEqual(6);
        expect(minimapContentRadius(130, 130)).toBe(65 - MINIMAP_BEZEL_WIDTH);
    });

    it('clips map content to the inner disc', () => {
        const ctx = mockCtx();
        clipMinimapContent(ctx, 65, 65, 130, 130);
        expect(ctx.beginPath).toHaveBeenCalled();
        expect(ctx.arc).toHaveBeenCalledWith(65, 65, 65 - MINIMAP_BEZEL_WIDTH, 0, Math.PI * 2);
        expect(ctx.clip).toHaveBeenCalled();
    });

    it('paints a conic metal ring with specular strokes', () => {
        const ctx = mockCtx();
        drawMinimapBezel(ctx, 130, 130);
        expect(ctx.createConicGradient).toHaveBeenCalled();
        expect(ctx._grad.addColorStop).toHaveBeenCalled();
        expect(ctx.fill).toHaveBeenCalled();
        expect(ctx.stroke.mock.calls.length).toBeGreaterThanOrEqual(4);
        expect(ctx.save).toHaveBeenCalled();
        expect(ctx.restore).toHaveBeenCalled();
    });

    it('falls back when createConicGradient is missing', () => {
        const ctx = mockCtx();
        delete ctx.createConicGradient;
        drawMinimapBezel(ctx, 130, 130);
        expect(ctx.fillStyle).toBe('#9aa0aa');
        expect(ctx.fill).toHaveBeenCalled();
    });

    it('draws a glass lens: tint, vignette, and specular crescent', () => {
        const ctx = mockCtx();
        drawMinimapGlass(ctx, 130, 130);
        expect(ctx.clip).toHaveBeenCalled();
        expect(ctx.createRadialGradient).toHaveBeenCalled();
        expect(ctx._grad.addColorStop).toHaveBeenCalled();
        expect(ctx.fill.mock.calls.length).toBeGreaterThanOrEqual(3);
        expect(ctx.stroke.mock.calls.length).toBeGreaterThanOrEqual(2);
        expect(ctx.save).toHaveBeenCalled();
        expect(ctx.restore).toHaveBeenCalled();
    });
});
