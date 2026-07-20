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
import { EventBus } from '../core/EventBus.js';
import { CityBuilder3D } from './CityBuilder3D.js';
import { RoadBuilder3D } from './RoadBuilder3D.js';

export const RenderSystem3D = {
    renderer: null,
    scene: null,
    camera: null,
    composer: null,
    tiltShiftPass: null,
    retroFilmPass: null,
    isZoomedIn: false,

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

        CityBuilder3D.buildCity(this);
        RoadBuilder3D.buildRoads(this);

        // Scale/movement validation cube
        const SF = WorldMetrics.SCALE_FACTOR;
        const geom5u = new THREE.BoxGeometry(1.5, 1.5, 1.5);
        const mat5u = new THREE.MeshBasicMaterial({ color: 0xe74c3c });
        this.box5u = new THREE.Mesh(geom5u, mat5u);
        this.box5u.position.set(this.originX * SF, 1.5 / 2, (this.originZ + 200) * SF);
        this.box5u.visible = false; // debug scale cube — keep out of play view
        this.scene.add(this.box5u);
    },

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
        const targetZoom = baseZoom * (1.0 - 0.2 * speedRatio);

        if (this.currentZoom === undefined) this.currentZoom = baseZoom;
        this.currentZoom += (targetZoom - this.currentZoom) * 0.05;
        this.camera.zoom = this.currentZoom;
        this.camera.updateProjectionMatrix();

        const time = Date.now() * 0.001;
        this.box5u.position.x = (1500 + Math.sin(time) * 1000) * SF;
        this.box5u.position.z = 1100 * SF;

        let focusX = this.originX;
        let focusZ = this.originZ;

        if (controlled && controlled.transform) {
            focusX = controlled.transform.x;
            focusZ = controlled.transform.y;
        }

        const sFocusX = focusX * SF;
        const sFocusZ = focusZ * SF;

        const tiltAngle = 35.264 * Math.PI / 180;
        const yawAngle = 45 * Math.PI / 180;
        const distance = 1200 * SF;

        this.camera.position.x = sFocusX + Math.cos(yawAngle) * Math.cos(tiltAngle) * distance;
        this.camera.position.y = Math.sin(tiltAngle) * distance;
        this.camera.position.z = sFocusZ + Math.sin(yawAngle) * Math.cos(tiltAngle) * distance;

        this.camera.lookAt(sFocusX, 0, sFocusZ);

        RenderSync3D.update(this.scene);

        if (this.retroFilmPass && this.retroFilmPass.enabled && this.retroFilmPass.uniforms?.time) {
            this.retroFilmPass.uniforms.time.value = performance.now() * 0.001;
        }

        if (this.composer) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }
};
