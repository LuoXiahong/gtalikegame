/**
 * Matte dark minimap bezel + recessed glass overlay, not a 3D mesh.
 * Palette is deliberately neutral/desaturated: the HUD must never be the most
 * saturated thing on screen next to the monochrome noir scene.
 */

/** Ring thickness in canvas px (130×130 minimap). */
export const MINIMAP_BEZEL_WIDTH = 7;

/**
 * Inner radius available for map content.
 * @param {number} width
 * @param {number} height
 */
export function minimapContentRadius(width, height) {
    return Math.min(width, height) / 2 - MINIMAP_BEZEL_WIDTH;
}

/**
 * Clip subsequent draws to the circular map disc (inside the bezel).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx
 * @param {number} cy
 * @param {number} width
 * @param {number} height
 */
export function clipMinimapContent(ctx, cx, cy, width, height) {
    const r = minimapContentRadius(width, height);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
}

/**
 * Recessed glass over the map disc: neutral wash, vignette, faint light catch.
 * Call after map content, before the bezel.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 */
export function drawMinimapGlass(ctx, width, height) {
    const cx = width / 2;
    const cy = height / 2;
    const r = minimapContentRadius(width, height);
    if (r <= 0) return;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    // Neutral glass wash (mutes the map like looking through a lens)
    ctx.fillStyle = 'rgba(150, 152, 156, 0.10)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Recessed depth — darker toward the rim / bottom
    if (typeof ctx.createRadialGradient === 'function') {
        const vig = ctx.createRadialGradient(cx, cy - r * 0.12, r * 0.18, cx, cy + r * 0.08, r);
        vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vig.addColorStop(0.55, 'rgba(0, 0, 0, 0.04)');
        vig.addColorStop(0.82, 'rgba(0, 0, 0, 0.18)');
        vig.addColorStop(1, 'rgba(0, 0, 0, 0.38)');
        ctx.fillStyle = vig;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
    }

    // Faint top-left light catch — a hint of curvature, not a glossy crescent
    if (typeof ctx.createRadialGradient === 'function') {
        const gx = cx - r * 0.38;
        const gy = cy - r * 0.48;
        const gloss = ctx.createRadialGradient(gx, gy, 0, gx, gy, r * 0.95);
        gloss.addColorStop(0, 'rgba(255, 255, 255, 0.10)');
        gloss.addColorStop(0.35, 'rgba(255, 255, 255, 0.04)');
        gloss.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gloss;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
    } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.beginPath();
        ctx.arc(cx, cy, r, Math.PI * 1.05, Math.PI * 1.85, false);
        ctx.lineTo(cx, cy);
        ctx.closePath();
        ctx.fill();
    }

    // Thin inner rim highlight (glass edge under the bezel)
    ctx.beginPath();
    ctx.arc(cx, cy, r - 1.25, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(198, 198, 200, 0.16)';
    ctx.lineWidth = 1.25;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, r - 0.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
}

/**
 * Draw a matte dark annular ring with restrained neutral glints.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 */
export function drawMinimapBezel(ctx, width, height) {
    const cx = width / 2;
    const cy = height / 2;
    const rOuter = Math.min(width, height) / 2 - 0.5;
    const rInner = rOuter - MINIMAP_BEZEL_WIDTH;
    if (rInner <= 0) return;

    ctx.save();

    // Matte band — conic keeps the turned-metal read, but neutral and dark
    // enough that the ring never out-values the scene inside it.
    ctx.beginPath();
    ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
    ctx.arc(cx, cy, rInner, 0, Math.PI * 2, true);

    if (typeof ctx.createConicGradient === 'function') {
        const metal = ctx.createConicGradient(-Math.PI * 0.65, cx, cy);
        metal.addColorStop(0, '#26272a');
        metal.addColorStop(0.1, '#63656a');
        metal.addColorStop(0.22, '#3a3c40');
        metal.addColorStop(0.38, '#75777d');
        metal.addColorStop(0.5, '#2e2f33');
        metal.addColorStop(0.62, '#5a5c61');
        metal.addColorStop(0.78, '#222326');
        metal.addColorStop(0.9, '#6b6d72');
        metal.addColorStop(1, '#26272a');
        ctx.fillStyle = metal;
    } else {
        ctx.fillStyle = '#45474b';
    }
    ctx.fill();

    // Outer rim shadow
    ctx.beginPath();
    ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.lineWidth = 1.25;
    ctx.stroke();

    // Outer specular lip
    ctx.beginPath();
    ctx.arc(cx, cy, rOuter - 1.25, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Inner dark channel (separates metal from map)
    ctx.beginPath();
    ctx.arc(cx, cy, rInner + 0.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.lineWidth = 1.75;
    ctx.stroke();

    // Inner neutral highlight
    ctx.beginPath();
    ctx.arc(cx, cy, rInner + 1.75, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(205, 205, 208, 0.14)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Restrained glints — enough to read as metal, not as chrome
    const midR = (rOuter + rInner) / 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)';
    ctx.lineWidth = 2.25;
    ctx.beginPath();
    ctx.arc(cx, cy, midR, -2.35, -1.55);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, midR, 0.45, 1.05);
    ctx.stroke();

    ctx.restore();
}
