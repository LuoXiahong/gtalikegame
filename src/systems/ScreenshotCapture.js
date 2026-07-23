/**
 * In-game screenshot → PNG download (game view + HUD / film gate / minimap).
 * Call request() before a frame; after render, flushFromCanvas() reads the backbuffer
 * then composites DOM overlays.
 */

const HUD_LAYER_IDS = ['uiLayer', 'filmGateChrome', 'fpsOverlay'];
const STYLE_PROPS = [
    'position', 'left', 'right', 'top', 'bottom', 'inset',
    'width', 'height', 'max-width', 'max-height', 'min-width', 'min-height',
    'margin', 'padding', 'border', 'border-radius', 'box-sizing',
    'background', 'background-color', 'color', 'opacity',
    'font-family', 'font-size', 'font-weight', 'font-style', 'letter-spacing',
    'line-height', 'text-align', 'text-transform', 'white-space',
    'display', 'flex-direction', 'align-items', 'justify-content', 'gap',
    'transform', 'transform-origin', 'filter', 'box-shadow', 'text-shadow',
    'z-index', 'overflow', 'pointer-events', 'visibility',
];

function downloadDataUrl(dataUrl, prefix) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${prefix}-${stamp}.png`;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
}

function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
}

/** Deep-clone with computed styles inlined (for SVG foreignObject). */
function cloneWithInlineStyles(source) {
    const clone = source.cloneNode(true);

    const walk = (src, dst) => {
        if (src.nodeType !== Node.ELEMENT_NODE || dst.nodeType !== Node.ELEMENT_NODE) return;
        const cs = window.getComputedStyle(src);
        let css = '';
        for (const prop of STYLE_PROPS) {
            const val = cs.getPropertyValue(prop);
            if (val) css += `${prop}:${val};`;
        }
        dst.setAttribute('style', css);
        const srcKids = src.children;
        const dstKids = dst.children;
        const n = Math.min(srcKids.length, dstKids.length);
        for (let i = 0; i < n; i++) walk(srcKids[i], dstKids[i]);
    };

    walk(source, clone);
    return clone;
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

/**
 * Rasterize a DOM element into the output ctx at its position relative to container.
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLElement} el
 * @param {DOMRect} containerRect
 * @param {number} scale
 */
async function drawDomOverlay(ctx, el, containerRect, scale) {
    if (!isVisible(el)) return;

    const r = el.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    const clone = cloneWithInlineStyles(el);
    clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
    clone.style.width = `${w}px`;
    clone.style.height = `${h}px`;
    clone.style.margin = '0';
    clone.style.position = 'relative';
    clone.style.left = '0';
    clone.style.top = '0';
    clone.style.right = 'auto';
    clone.style.bottom = 'auto';
    clone.style.transform = 'none';

    const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
        `<foreignObject width="100%" height="100%">${new XMLSerializer().serializeToString(clone)}</foreignObject>` +
        `</svg>`;
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

    try {
        const img = await loadImage(url);
        const x = (r.left - containerRect.left) * scale;
        const y = (r.top - containerRect.top) * scale;
        ctx.drawImage(img, x, y, w * scale, h * scale);
    } catch {
        // Overlay skipped if foreignObject raster fails (e.g. tainted font)
    }
}

export const ScreenshotCapture = {
    _pending: false,

    request() {
        this._pending = true;
    },

    isPending() {
        return this._pending;
    },

    /**
     * Composite game canvas + HUD overlays, then download PNG.
     * Must start in the same turn as the WebGL/2D draw.
     * @param {HTMLCanvasElement|null|undefined} canvas
     * @param {string} [prefix]
     * @returns {boolean} true if a capture was started
     */
    flushFromCanvas(canvas, prefix = 'lowge') {
        if (!this._pending) return false;
        this._pending = false;
        if (!canvas || typeof canvas.toDataURL !== 'function') return false;

        // Read WebGL/2D pixels immediately (before buffer clear)
        let gameUrl;
        try {
            gameUrl = canvas.toDataURL('image/png');
        } catch {
            return false;
        }
        if (!gameUrl || gameUrl === 'data:,') return false;

        void this._composeAndDownload(canvas, gameUrl, prefix);
        return true;
    },

    async _composeAndDownload(gameCanvas, gameUrl, prefix) {
        const container = document.getElementById('gameContainer') || gameCanvas.parentElement;
        if (!container) {
            downloadDataUrl(gameUrl, prefix);
            return;
        }

        const containerRect = container.getBoundingClientRect();
        const scale = Math.min(window.devicePixelRatio || 1, 2);
        const outW = Math.max(1, Math.round(containerRect.width * scale));
        const outH = Math.max(1, Math.round(containerRect.height * scale));

        const out = document.createElement('canvas');
        out.width = outW;
        out.height = outH;
        const ctx = out.getContext('2d');
        if (!ctx) {
            downloadDataUrl(gameUrl, prefix);
            return;
        }

        try {
            const gameImg = await loadImage(gameUrl);
            ctx.drawImage(gameImg, 0, 0, outW, outH);

            const minimap = document.getElementById('minimap');
            if (isVisible(minimap)) {
                const mr = minimap.getBoundingClientRect();
                ctx.save();
                const mx = (mr.left - containerRect.left) * scale;
                const my = (mr.top - containerRect.top) * scale;
                const mw = mr.width * scale;
                const mh = mr.height * scale;
                ctx.beginPath();
                ctx.arc(mx + mw / 2, my + mh / 2, Math.min(mw, mh) / 2, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(minimap, mx, my, mw, mh);
                ctx.restore();
            }

            for (const id of HUD_LAYER_IDS) {
                const el = document.getElementById(id);
                if (el) await drawDomOverlay(ctx, el, containerRect, scale);
            }

            downloadDataUrl(out.toDataURL('image/png'), prefix);
        } catch {
            downloadDataUrl(gameUrl, prefix);
        }
    },
};
