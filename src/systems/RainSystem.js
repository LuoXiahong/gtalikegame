/**
 * Lightweight rain via THREE.Points — cinematic streaks, no physics.
 * Particles live in world-space offsets (no parent scale) so density stays even.
 */
import * as THREE from 'three';
import { WorldMetrics } from '../world/WorldMetrics.js';

/** Must match RenderSystem3D orthographic viewSize. */
const VIEW_SIZE = 60;
/** Must match RenderSystem3D isometric yaw (45°). */
const CAMERA_YAW = Math.PI / 4;
const PARTICLE_COUNT = 2000;
const FALL_SPEED = 100;
const WIND_DRIFT = 12;

function createDropTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 48;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        const grad = ctx.createLinearGradient(4, 0, 4, 48);
        grad.addColorStop(0, 'rgba(200, 210, 225, 0)');
        grad.addColorStop(0.3, 'rgba(215, 225, 240, 0.55)');
        grad.addColorStop(0.65, 'rgba(190, 202, 220, 0.35)');
        grad.addColorStop(1, 'rgba(165, 178, 195, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(3, 0, 2, 48);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
}

/**
 * World-space rain column at a given camera zoom.
 * Uses frustum diagonal + isometric corner margin; shifts toward camera for lower screen.
 */
export function getRainCoverage(zoom = 1, aspect = 4 / 3) {
    const z = Math.max(Number(zoom) || 1, 0.25);
    const halfH = (VIEW_SIZE * 0.5) / z;
    const halfW = halfH * Math.max(aspect, 0.5);
    const groundHalf = Math.hypot(halfW, halfH) * 1.62;
    const offset = groundHalf * 0.22;

    return {
        halfW: groundHalf,
        halfD: groundHalf,
        height: halfH * 0.85,
        offsetX: Math.cos(CAMERA_YAW) * offset,
        offsetZ: Math.sin(CAMERA_YAW) * offset,
    };
}

function wrapCoord(v, half) {
    if (half <= 0) return 0;
    while (v < -half) v += half * 2;
    while (v > half) v -= half * 2;
    return v;
}

export const RainSystem = {
    points: null,
    _positions: null,
    _velocities: null,
    _active: false,
    _coverage: null,

    init(scene) {
        if (this.points || !scene) return;

        const SF = WorldMetrics.SCALE_FACTOR;
        const cover = getRainCoverage(1);
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(PARTICLE_COUNT * 3);
        const velocities = new Float32Array(PARTICLE_COUNT * 2);

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const i3 = i * 3;
            positions[i3] = (Math.random() * 2 - 1) * cover.halfW;
            positions[i3 + 1] = Math.random() * cover.height;
            positions[i3 + 2] = (Math.random() * 2 - 1) * cover.halfD;
            velocities[i * 2] = (Math.random() - 0.5) * WIND_DRIFT * SF;
            velocities[i * 2 + 1] = (0.7 + Math.random() * 0.6) * FALL_SPEED * SF;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            map: createDropTexture(),
            color: 0xc8d4e8,
            size: 11,
            transparent: true,
            opacity: 0.48,
            depthWrite: false,
            depthTest: false,
            sizeAttenuation: false,
            fog: false,
            alphaTest: 0.03,
            blending: THREE.NormalBlending,
        });

        this.points = new THREE.Points(geometry, material);
        this.points.frustumCulled = false;
        this.points.renderOrder = 200;
        this.points.visible = false;
        this._positions = positions;
        this._velocities = velocities;
        this._coverage = cover;
        scene.add(this.points);
    },

    setActive(active) {
        this._active = Boolean(active);
        if (this.points) {
            this.points.visible = this._active;
        }
    },

    update(dt, focusX, focusZ, cameraZoom = 1, aspect = 4 / 3) {
        if (!this.points || !this._active) return;

        const safeDt = Math.min(dt || 0.016, 0.05);
        const cover = getRainCoverage(cameraZoom, aspect);
        this._coverage = cover;

        this.points.position.set(
            focusX + cover.offsetX,
            0,
            focusZ + cover.offsetZ,
        );

        const positions = this._positions;
        const velocities = this._velocities;
        const { halfW, halfD, height } = cover;

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const i3 = i * 3;
            positions[i3] += velocities[i * 2] * safeDt;
            positions[i3 + 1] -= velocities[i * 2 + 1] * safeDt;

            if (positions[i3 + 1] < 0) {
                positions[i3 + 1] = height;
                positions[i3] = (Math.random() * 2 - 1) * halfW;
                positions[i3 + 2] = (Math.random() * 2 - 1) * halfD;
            }

            positions[i3] = wrapCoord(positions[i3], halfW);
            positions[i3 + 2] = wrapCoord(positions[i3 + 2], halfD);
        }

        this.points.geometry.attributes.position.needsUpdate = true;
    },
};
