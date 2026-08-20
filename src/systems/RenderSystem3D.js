/**
 * 3D RENDERING SYSTEM (RenderSystem3D)
 * Responsible for rendering the game world in 3D using Three.js.
 * 
 * COORDINATE MAPPING CONVENTION:
 * world2D.x → world3D.x
 * world2D.y → world3D.z (depth axis)
 * world3D.y represents vertical height.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { Camera } from '../world/Camera.js';
import { WorldMetrics } from '../world/WorldMetrics.js';
import { getContactShadowTexture } from './ContactShadow.js';
import { createPooledStreetLight } from './PropFactory.js';
import { FacadeGenerator } from './FacadeGenerator.js';
import { RenderSync3D } from './RenderSync3D.js';
import { RoadTextureGenerator } from './RoadTextureGenerator.js';

import { EventBus } from '../core/EventBus.js';
import { EVENTS } from '../core/Events.js';
import { Time } from '../core/Time.js';
import { CityBuilder3D } from './CityBuilder3D.js';
import { RetroFilmSettings } from './RetroFilmSettings.js';
import { RetroFilmShader } from './RetroFilmShader.js';
import { RoadBuilder3D } from './RoadBuilder3D.js';
import { RainSystem } from './RainSystem.js';
import { TiltShiftShader } from './TiltShiftShader.js';
import { TimeOfDaySettings } from './TimeOfDaySettings.js';
import { ScreenshotCapture } from './ScreenshotCapture.js';
import {
    createPuddleReflectors,
    setPuddleReflectorsActive
} from './PuddleReflector.js';

/** Base PointLight intensity from PropFactory lamp posts. */
export const STREET_LIGHT_BASE = 380;

/**
 * How many street lights actually exist as PointLights.
 *
 * The map holds 72 lamp posts. Giving each one a light meant every
 * MeshStandardMaterial fragment evaluated 72 point lights, distance-culled by
 * nothing — the single largest per-pixel cost in the scene. Instead a fixed pool
 * of this size is reused, repositioned each frame onto the nearest posts. Fog
 * hides the rest long before they would contribute.
 *
 * This number is deliberately constant for the lifetime of the renderer:
 * three.js compiles NUM_POINT_LIGHTS into every affected shader, so growing or
 * shrinking the set forces a recompile and a visible frame hitch.
 */
export const STREET_LIGHT_POOL_SIZE = 16;
const TOD_TRANSITION_SEC = 1.5;
/** Soft lamp/emissive glow — high threshold so white zebra paint does not bloom. */
export const BLOOM_STRENGTH = 0.18;
export const BLOOM_RADIUS = 0.38;
export const BLOOM_THRESHOLD = 0.92;

export const RenderSystem3D = {
    renderer: null,
    scene: null,
    camera: null,
    composer: null,
    bloomPass: null,
    tiltShiftPass: null,
    retroFilmPass: null,
    _todFrom: null,
    _todTo: null,
    _todT: 1,
    _streetLightMult: 0,
    _gradingDesat: 0,
    _gradingTint: null,
    _baseFogNear: 60,
    _baseFogFar: 220,

    // Environment meshes
    groundPlane: null,
    asphaltPlane: null,
    sidewalks: [],
    buildingZones: [],
    buildings: [],
    trees: [],
    billboards: [],
    props: [],
    /** Fixed pool of PointLights (see STREET_LIGHT_POOL_SIZE). */
    streetLights: [],
    /** Candidate world positions collected from lamp posts by CityBuilder3D. */
    lampLightSpots: [],
    laneMarkings: [],
    zebras: [],
    puddleReflectors: [],

    // Contact shadow texture (T-702)
    contactShadowTexture: null,

    // Scale/movement validation cube
    box5u: null,

    // Reference origin (matches start intersection)
    originX: 1100,
    originZ: 1100,

    createContactShadowTexture() {
        return getContactShadowTexture();
    },

    init() {
        const canvas = document.getElementById('gameCanvas3D');
        if (!canvas) {
            console.error('gameCanvas3D element not found!');
            return;
        }

        FacadeGenerator.init();
        RoadTextureGenerator.init();
        this.createdIntersections = new Set();
        this.contactShadowTexture = this.createContactShadowTexture();

        const parent = canvas.parentElement;
        const width = parent.clientWidth || 800;
        const height = parent.clientHeight || 600;

        const screenshotMode = new URLSearchParams(window.location.search).get('screenshot');
        this.screenshotMode = screenshotMode;
        this.renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            powerPreference: 'high-performance',
        });
        // Post-processing runs 4+ full-screen passes every frame — capping below native
        // HiDPI ratio (was 1.5) noticeably cuts fragment-shader cost with minimal visible loss.
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, screenshotMode ? 1 : 1.25));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.72;   // darkens overall before light tweaks
        this.renderer.setSize(width, height, false);
        const clearColor = 0x000000;
        this.renderer.setClearColor(clearColor, 1.0);
        // Screenshots are one-off renders, not realtime gameplay, so there is no FPS-cost
        // reason to skip shadows here — doing so made captures show flat, contrast-less
        // shadows on vehicles/NPCs/buildings vs. live gameplay (T26).
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.info.autoReset = false;

        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(clearColor, 200, 350);

        // Orthographic isometric camera
        const aspect = width / height;
        const viewSize = 60;

        this.camera = new THREE.OrthographicCamera(
            -viewSize * aspect / 2,
            viewSize * aspect / 2,
            viewSize / 2,
            -viewSize / 2,
            -200,
            1000
        );

        // Camera owns zoom state; this just applies whatever it currently
        // holds to the freshly-created THREE.js camera (screenshot scenarios
        // override the focus, not zoom, below).
        this.camera.zoom = Camera.zoom;
        this.camera.updateProjectionMatrix();

        this.composer = new EffectComposer(this.renderer);
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(width, height),
            BLOOM_STRENGTH,
            BLOOM_RADIUS,
            BLOOM_THRESHOLD,
        );
        this.composer.addPass(this.bloomPass);

        this.tiltShiftPass = new ShaderPass(TiltShiftShader);
        this.composer.addPass(this.tiltShiftPass);

        this.retroFilmPass = new ShaderPass(RetroFilmShader);
        this.composer.addPass(this.retroFilmPass);
        this.applyRetroSettings();

        EventBus.on(EVENTS.RETRO_SETTINGS_CHANGE, () => this.applyRetroSettings());
        EventBus.on(EVENTS.TIME_OF_DAY_CHANGE, () => this.startTimeOfDayTransition());
        EventBus.on(EVENTS.WEATHER_CHANGE, (weather) => this._onWeatherChange(weather));

        const outputPass = new OutputPass();
        this.composer.addPass(outputPass);

        this.setupLighting();
        this.setupEnvironment();

        window.addEventListener('resize', () => {
            const w = parent.clientWidth || 800;
            const h = parent.clientHeight || 600;

            this.renderer.setSize(w, h, false);
            if (this.composer) {
                this.composer.setSize(w, h);
            }
            if (this.bloomPass) {
                this.bloomPass.setSize(w, h);
            }

            const newAspect = w / h;
            this.camera.left = -viewSize * newAspect / 2;
            this.camera.right = viewSize * newAspect / 2;
            this.camera.top = viewSize / 2;
            this.camera.bottom = -viewSize / 2;
            this.camera.updateProjectionMatrix();
        });

        CityBuilder3D.buildCity(this);
        RoadBuilder3D.buildRoads(this);
        this.initStreetLightPool();

        if (this.screenshotMode) {
            // Screenshots are night + rain + noir only (see screenshotScenarios.js)
            RetroFilmSettings.applyPreset('noir');
            TimeOfDaySettings.applyPreset('night');
            TimeOfDaySettings.applyWeather('rain');
            if (this.screenshotMode === 'street-intersection') {
                this.screenshotScenario = { camera: { targetX: 1100, targetZ: 1100, zoom: 1.2 } };
            } else if (this.screenshotMode === 'city-overview') {
                this.screenshotScenario = { camera: { targetX: 1100, targetZ: 1100, zoom: 0.6 } };
            }
            if (this.screenshotScenario) {
                this.camera.zoom = this.screenshotScenario.camera.zoom;
                this.camera.updateProjectionMatrix();
            }
        }

        // Apply saved/default TOD after lights + street lamps exist
        this.applyTimeOfDayImmediate(TimeOfDaySettings.get());
        RainSystem.init(this.scene);
        RainSystem.setActive(TimeOfDaySettings.isRaining());
        const roadMeshes = [...(this.laneMarkings || []), ...(this.zebras || [])];
        RoadTextureGenerator.setWetness(TimeOfDaySettings.weather, roadMeshes);
        this.puddleReflectors = createPuddleReflectors(this.scene, {
            active: TimeOfDaySettings.isRaining()
        });

        if (this.screenshotMode) {
            // Signal capture script as soon as the scene exists (2 frames for composer settle)
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    window.__SCREENSHOT_READY__ = true;
                });
            });
        }

        // Scale/movement validation cube
        const SF = WorldMetrics.SCALE_FACTOR;
        const geom5u = new THREE.BoxGeometry(1.5, 1.5, 1.5);
        const mat5u = new THREE.MeshBasicMaterial({ color: 0xe74c3c });
        this.box5u = new THREE.Mesh(geom5u, mat5u);
        this.box5u.position.set(this.originX * SF, 1.5 / 2, (this.originZ + 200) * SF);
        this.box5u.visible = false; // debug scale cube — keep out of play view
        this.scene.add(this.box5u);
    },

    // Custom diorama builder removed, using real city instead

    createDashedLine(xStart, zStart, xEnd, zEnd, isVertical) {
        RoadBuilder3D.createDashedLine(this, xStart, zStart, xEnd, zEnd, isVertical);
    },

    createZebra(targetX, targetZ, isVerticalRoad = true) {
        RoadBuilder3D.createZebra(this, targetX, targetZ);
    },

    createBuilding(config) {
        return CityBuilder3D.createBuilding(this, config);
    },

    getBuildingMaterials(type, width, height, depth, baseColor) {
        return CityBuilder3D.getBuildingMaterials(type, width, height, depth, baseColor);
    },

    createFaceMaterial(textureType, faceWidth, faceHeight, baseColor) {
        return CityBuilder3D.createFaceMaterial(textureType, faceWidth, faceHeight, baseColor);
    },

    addHVACUnits(group, roofWidth, roofDepth, roofY) {
        CityBuilder3D.addHVACUnits(group, roofWidth, roofDepth, roofY);
    },

    addBillboard(group, roofWidth, roofDepth, roofY) {
        CityBuilder3D.addBillboard(this, group, roofWidth, roofDepth, roofY);
    },

    createTree(sizeType, x, z) {
        return CityBuilder3D.createTree(this, sizeType, x, z);
    },

    /**
     * Sync retro pass uniforms/enabled from RetroFilmSettings.
     */
    applyRetroSettings() {
        if (!this.retroFilmPass) return;
        RetroFilmSettings.applyToUniforms(this.retroFilmPass.uniforms);
        // Keep pass enabled so time-of-day grading runs even when film intensity is 0.
        this.retroFilmPass.enabled = true;
        this._applyGradingUniforms();
    },

    _applyGradingUniforms() {
        if (!this.retroFilmPass?.uniforms) return;
        const u = this.retroFilmPass.uniforms;
        if (u.todDesaturation) {
            u.todDesaturation.value = this._gradingDesat ?? 0;
        }
        if (u.todTint && this._gradingTint) {
            const v = u.todTint.value;
            if (v && typeof v.set === 'function') {
                v.set(this._gradingTint.r, this._gradingTint.g, this._gradingTint.b);
            } else if (Array.isArray(v)) {
                v[0] = this._gradingTint.r;
                v[1] = this._gradingTint.g;
                v[2] = this._gradingTint.b;
            }
        }
    },

    _applyGradingFromPreset(preset) {
        if (!preset?.grading) return;
        this._gradingDesat = preset.grading.desaturation;
        if (!this._gradingTint) {
            this._gradingTint = new THREE.Color(preset.grading.tint);
        } else {
            this._gradingTint.setHex(preset.grading.tint);
        }
        this._applyGradingUniforms();
    },

    _onWeatherChange(weather) {
        RainSystem.setActive(weather === 'rain');
        const roadMeshes = [...(this.laneMarkings || []), ...(this.zebras || [])];
        RoadTextureGenerator.setWetness(weather, roadMeshes);
        setPuddleReflectorsActive(this.puddleReflectors, weather === 'rain');
    },

    startTimeOfDayTransition() {
        if (!this.ambientLight || !this.hemiLight || !this.sunLight || !this.scene?.fog) return;
        this._todFrom = this._captureLightingSnapshot();
        this._todTo = TimeOfDaySettings.get();
        this._todT = 0;
    },

    /**
     * Snap lighting/fog/street lights to a preset (used on init).
     * @param {object} preset
     */
    applyTimeOfDayImmediate(preset) {
        if (!preset || !this.ambientLight) return;
        this.ambientLight.color.setHex(preset.ambient.color);
        this.ambientLight.intensity = preset.ambient.intensity;

        this.hemiLight.color.setHex(preset.hemi.sky);
        this.hemiLight.groundColor.setHex(preset.hemi.ground);
        this.hemiLight.intensity = preset.hemi.intensity;

        this.sunLight.color.setHex(preset.sun.color);
        this.sunLight.intensity = preset.sun.intensity;

        if (this.rimLight && preset.rim) {
            this.rimLight.color.setHex(preset.rim.color);
            this.rimLight.intensity = preset.rim.intensity;
        }

        if (this.scene.fog) {
            this.scene.fog.color.setHex(preset.fog.color);
            this._baseFogNear = preset.fog.near;
            this._baseFogFar = preset.fog.far;
            this._applyFogForCurrentZoom();
        }
        if (this.renderer) {
            this.renderer.setClearColor(preset.fog.color, 1.0);
        }

        this._streetLightMult = preset.streetLightMultiplier;
        this._applyStreetLightMultiplier(this._streetLightMult);
        this._applyGradingFromPreset(preset);
        this._todTo = null;
        this._todT = 1;
    },

    /**
     * Apply base fog distances scaled by the live camera zoom.
     * Zoom already lerps each frame, so fog follows smoothly.
     */
    _applyFogForCurrentZoom() {
        if (!this.scene?.fog) return;
        const zoom = this.camera?.zoom ?? Camera.zoom ?? 1;
        const scaled = TimeOfDaySettings.fogAtZoom(
            { color: 0, near: this._baseFogNear, far: this._baseFogFar },
            zoom,
        );
        this.scene.fog.near = scaled.near;
        this.scene.fog.far = scaled.far;
    },

    _captureLightingSnapshot() {
        return {
            ambient: {
                color: this.ambientLight.color.clone(),
                intensity: this.ambientLight.intensity,
            },
            hemi: {
                sky: this.hemiLight.color.clone(),
                ground: this.hemiLight.groundColor.clone(),
                intensity: this.hemiLight.intensity,
            },
            sun: {
                color: this.sunLight.color.clone(),
                intensity: this.sunLight.intensity,
            },
            fog: {
                color: this.scene.fog.color.clone(),
                near: this._baseFogNear,
                far: this._baseFogFar,
            },
            streetMult: this._streetLightMult,
            grading: {
                desaturation: this._gradingDesat ?? 0,
                tint: (this._gradingTint ?? new THREE.Color(0xffffff)).clone(),
            },
            rim: {
                color: this.rimLight?.color.clone() ?? new THREE.Color(0xa8b8d8),
                intensity: this.rimLight?.intensity ?? 0,
            },
        };
    },

    /**
     * Build the fixed street-light pool once and park it in the scene.
     * Call after the city (and therefore `lampLightSpots`) exists.
     */
    initStreetLightPool() {
        if (this.streetLights.length > 0) return this.streetLights;
        for (let i = 0; i < STREET_LIGHT_POOL_SIZE; i++) {
            const light = createPooledStreetLight();
            // Park far below the map until the first assignment, so a pool larger
            // than the lamp count never lights anything by accident.
            light.position.set(0, -1000, 0);
            this.scene.add(light);
            this.streetLights.push(light);
        }
        return this.streetLights;
    },

    /**
     * Move the pool onto the lamp posts nearest `(fx, fz)`.
     *
     * Uses partial selection rather than a full sort: only POOL_SIZE of ~72
     * candidates are needed, so this stays O(n·k) with no allocation per frame.
     * Lights are never added, removed or hidden — only moved — which keeps
     * NUM_POINT_LIGHTS constant and avoids shader recompiles.
     * @param {number} fx focus world X
     * @param {number} fz focus world Z
     */
    updateStreetLightPool(fx, fz) {
        const pool = this.streetLights;
        const spots = this.lampLightSpots;
        if (!pool.length || !spots.length) return;

        const taken = this._lampTaken || (this._lampTaken = []);
        taken.length = 0;

        for (let i = 0; i < pool.length; i++) {
            let bestIdx = -1;
            let bestD = Infinity;
            for (let s = 0; s < spots.length; s++) {
                if (taken.includes(s)) continue;
                const spot = spots[s];
                const dx = spot.x - fx;
                const dz = spot.z - fz;
                const d = dx * dx + dz * dz;
                if (d < bestD) {
                    bestD = d;
                    bestIdx = s;
                }
            }
            const light = pool[i];
            if (bestIdx === -1) {
                // Fewer lamps than pool slots — park the surplus out of range
                // instead of removing it, so the light count stays fixed.
                light.position.set(0, -1000, 0);
                continue;
            }
            taken.push(bestIdx);
            const spot = spots[bestIdx];
            light.position.set(spot.x, spot.y, spot.z);
        }
    },

    _applyStreetLightMultiplier(mult) {
        const lights = this.streetLights || [];
        for (const light of lights) {
            const base = light.userData?.baseIntensity ?? STREET_LIGHT_BASE;
            light.intensity = base * mult;
        }
    },

    updateTimeOfDay(dt) {
        if (!this._todTo || !this._todFrom) return;
        this._todT = Math.min(1, this._todT + dt / TOD_TRANSITION_SEC);
        const t = this._todT;
        const from = this._todFrom;
        const to = this._todTo;

        this.ambientLight.color.copy(from.ambient.color).lerp(new THREE.Color(to.ambient.color), t);
        this.ambientLight.intensity = THREE.MathUtils.lerp(from.ambient.intensity, to.ambient.intensity, t);

        this.hemiLight.color.copy(from.hemi.sky).lerp(new THREE.Color(to.hemi.sky), t);
        this.hemiLight.groundColor.copy(from.hemi.ground).lerp(new THREE.Color(to.hemi.ground), t);
        this.hemiLight.intensity = THREE.MathUtils.lerp(from.hemi.intensity, to.hemi.intensity, t);

        this.sunLight.color.copy(from.sun.color).lerp(new THREE.Color(to.sun.color), t);
        this.sunLight.intensity = THREE.MathUtils.lerp(from.sun.intensity, to.sun.intensity, t);

        if (this.rimLight && to.rim) {
            this.rimLight.color.copy(from.rim.color).lerp(new THREE.Color(to.rim.color), t);
            this.rimLight.intensity = THREE.MathUtils.lerp(from.rim.intensity, to.rim.intensity, t);
        }

        this.scene.fog.color.copy(from.fog.color).lerp(new THREE.Color(to.fog.color), t);
        this._baseFogNear = THREE.MathUtils.lerp(from.fog.near, to.fog.near, t);
        this._baseFogFar = THREE.MathUtils.lerp(from.fog.far, to.fog.far, t);
        this._applyFogForCurrentZoom();
        if (this.renderer) {
            this.renderer.setClearColor(this.scene.fog.color, 1.0);
        }

        const mult = THREE.MathUtils.lerp(from.streetMult ?? 0, to.streetLightMultiplier, t);
        this._streetLightMult = mult;
        this._applyStreetLightMultiplier(mult);

        if (to.grading) {
            const fromDesat = from.grading?.desaturation ?? 0;
            const fromTint = from.grading?.tint ?? new THREE.Color(0xffffff);
            this._gradingDesat = THREE.MathUtils.lerp(fromDesat, to.grading.desaturation, t);
            if (!this._gradingTint) this._gradingTint = new THREE.Color();
            this._gradingTint.copy(fromTint).lerp(new THREE.Color(to.grading.tint), t);
            this._applyGradingUniforms();
        }

        if (this._todT >= 1) {
            this._todTo = null;
            this._todFrom = null;
        }
    },

    setupLighting() {
        const SF = WorldMetrics.SCALE_FACTOR;

        // Brighter fill — less hollow shadows, readable characters
        const ambient = new THREE.AmbientLight(0x8585a0, 0.62);
        this.scene.add(ambient);
        this.ambientLight = ambient;

        const hemiLight = new THREE.HemisphereLight(0xa4b3c6, 0x8a8078, 0.72);
        this.scene.add(hemiLight);
        this.hemiLight = hemiLight;

        const sun = new THREE.DirectionalLight(0xfff5e6, 1.35);
        sun.position.set(600 * SF, 550 * SF, 400 * SF);

        sun.target.position.set(1500 * SF, 0, 1500 * SF);
        this.scene.add(sun.target);

        sun.castShadow = true;
        // 1024 halves the shadow depth-pass fill cost vs the previous 2048 map;
        // bias roughly doubled to match the larger texel footprint (avoids acne).
        sun.shadow.bias = -0.001;
        sun.shadow.mapSize.width = 1024;
        sun.shadow.mapSize.height = 1024;
        // Soften cast shadows a touch (Three r155+), but stay close to full occlusion —
        // 0.55 let too much direct sun bleed through onto shadowed vehicles/NPCs, making
        // the building-cast shadow nearly invisible on them relative to buildings (T26).
        if (sun.shadow.intensity !== undefined) {
            sun.shadow.intensity = 0.85;
        }

        const d = 1600 * SF;
        sun.shadow.camera.left = -d;
        sun.shadow.camera.right = d;
        sun.shadow.camera.top = d;
        sun.shadow.camera.bottom = -d;
        sun.shadow.camera.near = 10;
        sun.shadow.camera.far = 300;

        this.scene.add(sun);
        this.sunLight = sun;

        const rim = new THREE.DirectionalLight(0xa8b8d8, 0);
        rim.castShadow = false;
        rim.position.set(0, 400 * SF, 0);
        rim.target.position.set(1500 * SF, 0, 1500 * SF);
        this.scene.add(rim.target);
        this.scene.add(rim);
        this.rimLight = rim;
    },

    /**
     * One-shot IBL for MeshStandardMaterial metalness reflections.
     */
    setupEnvironment() {
        if (!this.renderer || !this.scene) return;
        const pmrem = new THREE.PMREMGenerator(this.renderer);
        const envRT = pmrem.fromScene(new RoomEnvironment());
        this.scene.environment = envRT.texture;
        pmrem.dispose();
    },

    update() {
        if (!this.renderer || !this.scene || !this.camera) return;

        const SF = WorldMetrics.SCALE_FACTOR;

        // Zoom and focus (including speed look-ahead) are computed once per
        // frame by Camera.update() (called from Game.loop, before either
        // renderer runs) — this renderer only projects them into the scene.
        this.camera.zoom = Camera.zoom;
        this.camera.updateProjectionMatrix();
        this._applyFogForCurrentZoom();

        const time = Time.time;
        this.box5u.position.x = (1500 + Math.sin(time) * 1000) * SF;
        this.box5u.position.z = 1100 * SF;

        let sFocusX = Camera.focusX * SF;
        let sFocusZ = Camera.focusY * SF;

        if (this.screenshotMode && this.screenshotScenario?.camera) {
            sFocusX = this.screenshotScenario.camera.targetX * SF;
            sFocusZ = this.screenshotScenario.camera.targetZ * SF;
        }

        const tiltAngle = 35.264 * Math.PI / 180;
        const yawAngle = 45 * Math.PI / 180;
        const distance = 1200 * SF;

        this.camera.position.x = sFocusX + Math.cos(yawAngle) * Math.cos(tiltAngle) * distance;
        this.camera.position.y = Math.sin(tiltAngle) * distance;
        this.camera.position.z = sFocusZ + Math.sin(yawAngle) * Math.cos(tiltAngle) * distance;
        this.camera.lookAt(sFocusX, 0, sFocusZ);

        if (this.rimLight) {
            const camToFocusX = sFocusX - this.camera.position.x;
            const camToFocusZ = sFocusZ - this.camera.position.z;
            const len = Math.hypot(camToFocusX, camToFocusZ) || 1;
            const backX = -camToFocusX / len;
            const backZ = -camToFocusZ / len;
            const rimDist = 280 * SF;
            const rimHeight = 180 * SF;
            this.rimLight.position.set(
                sFocusX + backX * rimDist,
                rimHeight,
                sFocusZ + backZ * rimDist,
            );
            this.rimLight.target.position.set(sFocusX, 40 * SF, sFocusZ);
            this.rimLight.target.updateMatrixWorld();
        }

        RenderSync3D.update(this.scene);

        this.updateStreetLightPool(sFocusX, sFocusZ);

        this.updateTimeOfDay(Time.delta || 0.016);

        const rainZoom = this.camera?.zoom ?? Camera.zoom ?? 1;
        const rainAspect = (this.camera.right - this.camera.left)
            / Math.max(this.camera.top - this.camera.bottom, 0.001);
        RainSystem.update(Time.delta || 0.016, sFocusX, sFocusZ, rainZoom, rainAspect);

        if (this.retroFilmPass && this.retroFilmPass.enabled && this.retroFilmPass.uniforms?.time) {
            if (this.screenshotMode) {
                this.retroFilmPass.uniforms.time.value = 42.0; // static time for determinism
            } else {
                this.retroFilmPass.uniforms.time.value = performance.now() * 0.001;
            }
        }

        if (this.composer) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }

        if (ScreenshotCapture.isPending()) {
            ScreenshotCapture.flushFromCanvas(
                this.renderer?.domElement,
                this.screenshotMode || 'lowge',
                !!this.screenshotMode,
            );
        }
    }
};
