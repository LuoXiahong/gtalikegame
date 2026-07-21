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
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { World } from '../world/World.js';
import { WorldGrid } from '../world/WorldGrid.js';
import { RenderSync3D } from './RenderSync3D.js';
import { FacadeGenerator } from './FacadeGenerator.js';
import { RoadTextureGenerator } from './RoadTextureGenerator.js';
import { WorldMetrics } from '../world/WorldMetrics.js';
import { InputSystem } from '../input/InputManager.js';
import { VehicleSystem } from './VehicleSystem.js';
import { getContactShadowTexture } from './ContactShadow.js';

import { TiltShiftShader } from './TiltShiftShader.js';
import { RetroFilmShader } from './RetroFilmShader.js';
import { RetroFilmSettings } from './RetroFilmSettings.js';
import { TimeOfDaySettings } from './TimeOfDaySettings.js';
import { EventBus } from '../core/EventBus.js';
import { Time } from '../core/Time.js';
import { CityBuilder3D } from './CityBuilder3D.js';
import { RoadBuilder3D } from './RoadBuilder3D.js';

/** Base PointLight intensity from PropFactory lamp posts. */
const STREET_LIGHT_BASE = 0.7;
const TOD_TRANSITION_SEC = 1.5;

export const RenderSystem3D = {
    renderer: null,
    scene: null,
    camera: null,
    composer: null,
    tiltShiftPass: null,
    retroFilmPass: null,
    isZoomedIn: false,
    _todFrom: null,
    _todTo: null,
    _todT: 1,
    _streetLightMult: 0,

    // Environment meshes
    groundPlane: null,
    asphaltPlane: null,
    sidewalks: [],
    buildingZones: [],
    buildings: [],
    trees: [],
    billboards: [],
    props: [],
    streetLights: [],
    laneMarkings: [],
    zebras: [],

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

        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.setSize(width, height, false);
        const clearColor = 0x000000;
        this.renderer.setClearColor(clearColor, 1.0);
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

        this.camera.zoom = 1.0;
        this.camera.updateProjectionMatrix();

        this.composer = new EffectComposer(this.renderer);
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        this.tiltShiftPass = new ShaderPass(TiltShiftShader);
        this.composer.addPass(this.tiltShiftPass);

        this.retroFilmPass = new ShaderPass(RetroFilmShader);
        this.composer.addPass(this.retroFilmPass);
        this.applyRetroSettings();

        EventBus.on('retro_settings_change', () => this.applyRetroSettings());
        EventBus.on('time_of_day_change', () => this.startTimeOfDayTransition());

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

            const newAspect = w / h;
            this.camera.left = -viewSize * newAspect / 2;
            this.camera.right = viewSize * newAspect / 2;
            this.camera.top = viewSize / 2;
            this.camera.bottom = -viewSize / 2;
            this.camera.updateProjectionMatrix();
        });

        const screenshotMode = new URLSearchParams(window.location.search).get('screenshot');
        this.screenshotMode = screenshotMode;

        CityBuilder3D.buildCity(this);
        RoadBuilder3D.buildRoads(this);

        if (screenshotMode) {
            if (screenshotMode === 'street-intersection') {
                this.screenshotScenario = { camera: { targetX: 1100, targetZ: 1100, zoom: 1.2 } };
                RetroFilmSettings.applyPreset('classic');
                TimeOfDaySettings.applyPreset('dusk');
            } else if (screenshotMode === 'city-overview') {
                this.screenshotScenario = { camera: { targetX: 1100, targetZ: 1100, zoom: 0.6 } };
                RetroFilmSettings.applyPreset('noir');
                TimeOfDaySettings.applyPreset('night');
            } else if (screenshotMode === 'traffic-block') {
                this.screenshotScenario = { camera: { targetX: 1150, targetZ: 1150, zoom: 1.5 } };
                RetroFilmSettings.applyPreset('classic');
                TimeOfDaySettings.applyPreset('day');
            }
            if (this.screenshotScenario) {
                this.camera.zoom = this.screenshotScenario.camera.zoom;
                this.camera.updateProjectionMatrix();
            }
        }

        // Apply saved/default TOD after lights + street lamps exist
        this.applyTimeOfDayImmediate(TimeOfDaySettings.get());

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
        this.retroFilmPass.enabled = RetroFilmSettings.isActive();
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

        if (this.scene.fog) {
            this.scene.fog.color.setHex(preset.fog.color);
            this.scene.fog.near = preset.fog.near;
            this.scene.fog.far = preset.fog.far;
        }
        if (this.renderer) {
            this.renderer.setClearColor(preset.fog.color, 1.0);
        }

        this._streetLightMult = preset.streetLightMultiplier;
        this._applyStreetLightMultiplier(this._streetLightMult);
        this._todTo = null;
        this._todT = 1;
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
                near: this.scene.fog.near,
                far: this.scene.fog.far,
            },
            streetMult: this._streetLightMult,
        };
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

        this.scene.fog.color.copy(from.fog.color).lerp(new THREE.Color(to.fog.color), t);
        this.scene.fog.near = THREE.MathUtils.lerp(from.fog.near, to.fog.near, t);
        this.scene.fog.far = THREE.MathUtils.lerp(from.fog.far, to.fog.far, t);
        if (this.renderer) {
            this.renderer.setClearColor(this.scene.fog.color, 1.0);
        }

        const mult = THREE.MathUtils.lerp(from.streetMult ?? 0, to.streetLightMultiplier, t);
        this._streetLightMult = mult;
        this._applyStreetLightMultiplier(mult);

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
        sun.shadow.bias = -0.0005;
        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;
        // Softer cast shadows (Three r155+)
        if (sun.shadow.intensity !== undefined) {
            sun.shadow.intensity = 0.55;
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

        if (InputSystem.consumeZoomToggle()) {
            this.isZoomedIn = !this.isZoomedIn;
        }

        const controlled = VehicleSystem.getControlledEntity() || World.getEntitiesByType('player')[0];

        const baseZoom = this.isZoomedIn ? 2.0 : 1.0;
        let speed = 0;
        if (controlled && controlled.physics && controlled.type === 'car') {
            speed = Math.abs(controlled.physics.speed || 0);
        }
        const speedRatio = Math.min(speed / 300, 1.0);
        if (!this.screenshotMode) {
            const targetZoom = baseZoom * (1.0 - 0.2 * speedRatio);
            if (this.currentZoom === undefined) this.currentZoom = baseZoom;
            this.currentZoom += (targetZoom - this.currentZoom) * 0.05;
            this.camera.zoom = this.currentZoom;
            this.camera.updateProjectionMatrix();
        }

        const time = Date.now() * 0.001;
        this.box5u.position.x = (1500 + Math.sin(time) * 1000) * SF;
        this.box5u.position.z = 1100 * SF;

        let focusX = this.originX;
        let focusZ = this.originZ;

        if (controlled && controlled.transform) {
            focusX = controlled.transform.x;
            focusZ = controlled.transform.y;
        }

        let sFocusX = focusX * SF;
        let sFocusZ = focusZ * SF;

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

        RenderSync3D.update(this.scene);

        this.updateTimeOfDay(Time.delta || 0.016);

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
    }
};
