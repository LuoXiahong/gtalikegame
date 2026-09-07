/**
 * Cinematic rain streaks via InstancedMesh (elongated quads).
 * THREE.Points cannot deliver streaks — PointsMaterial always draws square sprites,
 * crushing the drop texture into ~N×N px dots. Each instance is a thin plane
 * aligned to fall + wind, facing the isometric camera.
 */
import * as THREE from 'three';
import { WorldMetrics } from '../world/WorldMetrics.js';

/** Must match RenderSystem3D orthographic viewSize. */
const VIEW_SIZE = 60;
/** Must match RenderSystem3D isometric yaw (45°) and tilt (~35.264°). */
const CAMERA_YAW = Math.PI / 4;
const CAMERA_TILT = 35.264 * Math.PI / 180;
const PARTICLE_COUNT = 700;
const FALL_SPEED = 400;
/**
 * WIND_BASE is a constant world-X drift shared by every drop (was 0 — velocities
 * only had a zero-mean per-drop jitter, so streaks fell essentially straight down
 * on screen: atan(7.5/280) ≈ 1.5° instead of a visible windswept angle). WIND_DRIFT
 * is the remaining per-drop jitter around that base.
 */
const WIND_BASE = 110;
const WIND_DRIFT = 15;
/**
 * World-unit streak size. Ortho frustum height ≈ VIEW_SIZE/zoom (~60),
 * so length 3.2 ≈ 5% of view (~38px @720p); width 0.35 stays a readable stroke.
 */
const STREAK_WIDTH = 0.05;
const STREAK_LENGTH = 3.2;

/**
 * Splash sparkle where a drop hits the ground (T57). A small pool of flat,
 * additive discs — not one per raindrop (700 splashes/frame would be noise, not
 * sparkle) — recycled round-robin and only triggered for a fraction of resets,
 * so hits read as sparse glints rather than a saturated glitter carpet.
 */
const SPLASH_POOL_SIZE = 48;
const SPLASH_LIFETIME = 0.3;
const SPLASH_MAX_SCALE = 0.5;
const SPLASH_TRIGGER_CHANCE = 0.1;
const SPLASH_Y = 0.02;

function createDropTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 48;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        const grad = ctx.createLinearGradient(4, 0, 4, 48);
        grad.addColorStop(0, 'rgba(200, 210, 225, 0)');
        grad.addColorStop(0.25, 'rgba(240, 246, 255, 1.0)');
        grad.addColorStop(0.55, 'rgba(210, 224, 245, 0.7)');
        grad.addColorStop(1, 'rgba(165, 178, 195, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(2, 0, 4, 48);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
}

/** Soft round glint — the splash equivalent of createDropTexture's streak. */
function createSplashTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        grad.addColorStop(0, 'rgba(235, 244, 255, 0.9)');
        grad.addColorStop(0.4, 'rgba(210, 224, 245, 0.5)');
        grad.addColorStop(1, 'rgba(200, 210, 225, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 32, 32);
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

/** Direction from focus toward the isometric camera (matches RenderSystem3D). */
const _camDir = new THREE.Vector3(
    Math.cos(CAMERA_YAW) * Math.cos(CAMERA_TILT),
    Math.sin(CAMERA_TILT),
    Math.sin(CAMERA_YAW) * Math.cos(CAMERA_TILT),
).normalize();

const _fall = new THREE.Vector3();
const _xAxis = new THREE.Vector3();
const _yAxis = new THREE.Vector3();
const _zAxis = new THREE.Vector3();
const _scale = new THREE.Vector3(1, 1, 1);
const _mat = new THREE.Matrix4();

function writeInstanceMatrix(mesh, index, x, y, z, windX, fallY, lengthScale) {
    // Local Y = fall direction; local Z faces camera so the quad is not edge-on.
    _fall.set(windX, -fallY, 0);
    if (_fall.lengthSq() < 1e-8) _fall.set(0, -1, 0);
    else _fall.normalize();

    _yAxis.copy(_fall);
    _xAxis.crossVectors(_yAxis, _camDir);
    if (_xAxis.lengthSq() < 1e-8) {
        _xAxis.set(1, 0, 0);
    } else {
        _xAxis.normalize();
    }
    _zAxis.crossVectors(_xAxis, _yAxis).normalize();

    _scale.set(1, lengthScale, 1);
    _mat.makeBasis(_xAxis, _yAxis, _zAxis);
    _mat.scale(_scale);
    _mat.setPosition(x, y, z);
    mesh.setMatrixAt(index, _mat);
}

function writeSplashMatrix(mesh, index, x, y, z, scale) {
    _scale.set(scale, scale, scale);
    _mat.makeScale(_scale.x, _scale.y, _scale.z);
    _mat.setPosition(x, y, z);
    mesh.setMatrixAt(index, _mat);
}

export const RainSystem = {
    /** @type {THREE.InstancedMesh|null} */
    mesh: null,
    /** @deprecated alias of mesh — kept for older call sites/tests during transition */
    get points() {
        return this.mesh;
    },
    set points(value) {
        this.mesh = value;
    },
    _positions: null,
    _velocities: null,
    _lengthScales: null,
    _active: false,
    _coverage: null,

    /** @type {THREE.InstancedMesh|null} T57 ground-hit splash pool. */
    splashMesh: null,
    _splashAge: null,
    _splashX: null,
    _splashZ: null,
    _splashCursor: 0,

    init(scene) {
        if (this.mesh || !scene) return;

        const SF = WorldMetrics.SCALE_FACTOR;
        const cover = getRainCoverage(1);
        const positions = new Float32Array(PARTICLE_COUNT * 3);
        const velocities = new Float32Array(PARTICLE_COUNT * 2);
        const lengthScales = new Float32Array(PARTICLE_COUNT);

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const i3 = i * 3;
            positions[i3] = (Math.random() * 2 - 1) * cover.halfW;
            positions[i3 + 1] = Math.random() * cover.height;
            positions[i3 + 2] = (Math.random() * 2 - 1) * cover.halfD;
            velocities[i * 2] = (WIND_BASE + (Math.random() - 0.5) * WIND_DRIFT) * SF;
            velocities[i * 2 + 1] = (0.7 + Math.random() * 0.6) * FALL_SPEED * SF;
            lengthScales[i] = 0.7 + Math.random() * 0.6;
        }

        const geometry = new THREE.PlaneGeometry(STREAK_WIDTH, STREAK_LENGTH);
        const material = new THREE.MeshBasicMaterial({
            map: createDropTexture(),
            color: 0xf2f7ff,
            transparent: true,
            opacity: 0.55,
            depthWrite: false,
            depthTest: false,
            fog: false,
            side: THREE.DoubleSide,
            // Additive + untonemapped so streaks can actually reach screen-white; with
            // NormalBlending + ACES + toneMappingExposure 0.72 they capped out at ~44%
            // gray even on bright surfaces (RenderSystem3D.js toneMappingExposure).
            blending: THREE.AdditiveBlending,
            toneMapped: false,
            alphaTest: 0.02,
        });

        const mesh = new THREE.InstancedMesh(geometry, material, PARTICLE_COUNT);
        mesh.frustumCulled = false;
        mesh.renderOrder = 200;
        mesh.visible = false;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const i3 = i * 3;
            writeInstanceMatrix(
                mesh,
                i,
                positions[i3],
                positions[i3 + 1],
                positions[i3 + 2],
                velocities[i * 2],
                velocities[i * 2 + 1],
                lengthScales[i],
            );
        }
        mesh.instanceMatrix.needsUpdate = true;

        this.mesh = mesh;
        this._positions = positions;
        this._velocities = velocities;
        this._lengthScales = lengthScales;
        this._coverage = cover;
        scene.add(mesh);

        // Flat disc, lying on the ground — rotation baked into the geometry so
        // per-instance matrices only need translation + uniform scale.
        const splashGeometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
        const splashMaterial = new THREE.MeshBasicMaterial({
            map: createSplashTexture(),
            color: 0xdce8f8,
            transparent: true,
            depthWrite: false,
            depthTest: false,
            fog: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
            alphaTest: 0.02,
        });
        const splashMesh = new THREE.InstancedMesh(splashGeometry, splashMaterial, SPLASH_POOL_SIZE);
        splashMesh.frustumCulled = false;
        splashMesh.renderOrder = 199;
        splashMesh.visible = false;
        splashMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

        const splashAge = new Float32Array(SPLASH_POOL_SIZE).fill(SPLASH_LIFETIME);
        for (let i = 0; i < SPLASH_POOL_SIZE; i++) {
            writeSplashMatrix(splashMesh, i, 0, SPLASH_Y, 0, 0);
        }
        splashMesh.instanceMatrix.needsUpdate = true;

        this.splashMesh = splashMesh;
        this._splashAge = splashAge;
        this._splashX = new Float32Array(SPLASH_POOL_SIZE);
        this._splashZ = new Float32Array(SPLASH_POOL_SIZE);
        this._splashCursor = 0;
        scene.add(splashMesh);
    },

    setActive(active) {
        this._active = Boolean(active);
        if (this.mesh) {
            this.mesh.visible = this._active;
        }
        if (this.splashMesh) {
            this.splashMesh.visible = this._active;
        }
    },

    /** Recycles the oldest pool slot for a fresh ground-hit glint. */
    _triggerSplash(x, z) {
        const idx = this._splashCursor;
        this._splashCursor = (idx + 1) % SPLASH_POOL_SIZE;
        this._splashAge[idx] = 0;
        this._splashX[idx] = x;
        this._splashZ[idx] = z;
    },

    update(dt, focusX, focusZ, cameraZoom = 1, aspect = 4 / 3) {
        if (!this.mesh || !this._active) return;

        const safeDt = Math.min(dt || 0.016, 0.05);
        const cover = getRainCoverage(cameraZoom, aspect);
        this._coverage = cover;

        this.mesh.position.set(
            focusX + cover.offsetX,
            0,
            focusZ + cover.offsetZ,
        );

        const positions = this._positions;
        const velocities = this._velocities;
        const lengthScales = this._lengthScales;
        const { halfW, halfD, height } = cover;
        const mesh = this.mesh;

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const i3 = i * 3;
            const windX = velocities[i * 2];
            const fallY = velocities[i * 2 + 1];

            positions[i3] += windX * safeDt;
            positions[i3 + 1] -= fallY * safeDt;

            if (positions[i3 + 1] < 0) {
                if (Math.random() < SPLASH_TRIGGER_CHANCE) {
                    this._triggerSplash(positions[i3], positions[i3 + 2]);
                }
                positions[i3 + 1] = height;
                positions[i3] = (Math.random() * 2 - 1) * halfW;
                positions[i3 + 2] = (Math.random() * 2 - 1) * halfD;
            }

            positions[i3] = wrapCoord(positions[i3], halfW);
            positions[i3 + 2] = wrapCoord(positions[i3 + 2], halfD);

            writeInstanceMatrix(
                mesh,
                i,
                positions[i3],
                positions[i3 + 1],
                positions[i3 + 2],
                windX,
                fallY,
                lengthScales[i],
            );
        }

        mesh.instanceMatrix.needsUpdate = true;

        if (this.splashMesh) {
            this.splashMesh.position.copy(mesh.position);
            const age = this._splashAge;
            const sx = this._splashX;
            const sz = this._splashZ;
            for (let i = 0; i < SPLASH_POOL_SIZE; i++) {
                if (age[i] < SPLASH_LIFETIME) age[i] += safeDt;
                // sin(t*PI): 0 → peak at mid-life → 0, so pool slots that were
                // never triggered (age pinned at LIFETIME) stay at scale 0.
                const t = Math.min(age[i] / SPLASH_LIFETIME, 1);
                const scale = Math.sin(t * Math.PI) * SPLASH_MAX_SCALE;
                writeSplashMatrix(this.splashMesh, i, sx[i], SPLASH_Y, sz[i], scale);
            }
            this.splashMesh.instanceMatrix.needsUpdate = true;
        }
    },
};
