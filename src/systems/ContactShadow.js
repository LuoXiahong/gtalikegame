/**
 * Soft circular contact-shadow helper (shared by buildings, NPCs, vehicles).
 */
import * as THREE from 'three';
import { EventBus } from '../core/EventBus.js';
import { EVENTS } from '../core/Events.js';

let cachedTexture = null;

/**
 * Soft radial alpha texture (64×64). Created once and reused.
 * @returns {THREE.CanvasTexture}
 */
export function getContactShadowTexture() {
    if (cachedTexture) return cachedTexture;

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        cachedTexture = new THREE.Texture();
        return cachedTexture;
    }
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
    grad.addColorStop(0.3, 'rgba(0, 0, 0, 0.85)');
    grad.addColorStop(0.8, 'rgba(0, 0, 0, 0.25)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    cachedTexture = new THREE.CanvasTexture(canvas);
    return cachedTexture;
}

/*
 * Rain-weather skew for flat ground shadow decals, so they lean the same way
 * as RainSystem's streaks instead of staying perfectly symmetric underfoot.
 *
 * RainSystem (see RainSystem.js: FALL_SPEED=400, WIND_DRIFT=15) drifts drops
 * along world ±X while falling along world Y, at a per-drop randomized sign.
 * A static ground decal can't track every drop individually, so we bake in a
 * single fixed lean using that same wind/fall ratio (15/400 ≈ 0.0375), scaled
 * up so the offset actually reads on a ~0.7 world-unit blob.
 */
const RAIN_SKEW_RATIO = 15 / 400;
const RAIN_SKEW_SCALE = 8;
const RAIN_STRETCH = 1.3;

/** Shared "is it raining" flag — module-level config, not per-entity state. */
let _raining = false;

/**
 * Tracked shadow decals: { ref: WeakRef<Mesh>, baseX, baseZ, offsetX }.
 * WeakRef so despawned NPC/vehicle contact shadows can still be garbage
 * collected instead of leaking through this shared registry.
 */
const _tracked = new Set();

const _makeRef = typeof WeakRef !== 'undefined'
    ? (obj) => new WeakRef(obj)
    : (obj) => ({ deref: () => obj });

function rainOffsetFor(width) {
    return width * RAIN_SKEW_RATIO * RAIN_SKEW_SCALE;
}

function applyWeatherState(mesh, entry) {
    if (_raining) {
        mesh.position.x = entry.baseX + entry.offsetX;
        mesh.position.z = entry.baseZ;
        mesh.scale.set(RAIN_STRETCH, 1, 1);
    } else {
        mesh.position.x = entry.baseX;
        mesh.position.z = entry.baseZ;
        mesh.scale.set(1, 1, 1);
    }
}

EventBus.on(EVENTS.WEATHER_CHANGE, (weather) => {
    _raining = weather === 'rain';
    for (const entry of _tracked) {
        const mesh = entry.ref.deref();
        if (!mesh) {
            _tracked.delete(entry);
            continue;
        }
        applyWeatherState(mesh, entry);
    }
});

/**
 * Flat soft blob under a model pivot. Reacts to `weather_change` (rain):
 * offsets/stretches to match the on-screen rain fall angle; reverts to
 * centered/symmetric on clear weather.
 * @param {THREE.Group} group
 * @param {{ width?: number, depth?: number, y?: number, opacity?: number }} [opts]
 * @returns {THREE.Mesh}
 */
export function addContactShadow(group, opts = {}) {
    const width = opts.width ?? 0.7;
    const depth = opts.depth ?? 0.7;
    const y = opts.y ?? 0.01;
    const opacity = opts.opacity ?? 0.35;

    const geom = new THREE.PlaneGeometry(width, depth);
    const mat = new THREE.MeshBasicMaterial({
        color: 0x000000,
        map: getContactShadowTexture(),
        transparent: true,
        opacity,
        depthWrite: false
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, y, 0);
    mesh.name = 'contactShadow';
    group.add(mesh);

    const entry = { ref: _makeRef(mesh), baseX: 0, baseZ: 0, offsetX: rainOffsetFor(width) };
    _tracked.add(entry);
    if (_raining) applyWeatherState(mesh, entry);

    return mesh;
}
