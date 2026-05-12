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
import { World } from '../world/World.js';
import { WorldGrid } from '../world/WorldGrid.js';
import { RenderSync3D } from './RenderSync3D.js';
import { FacadeGenerator } from './FacadeGenerator.js';
import { WorldMetrics } from '../world/WorldMetrics.js';

export const RenderSystem3D = {
    renderer: null,
    scene: null,
    camera: null,
    
    // 3D environment elements
    groundPlane: null,
    asphaltPlane: null,
    sidewalks: [],
    buildingZones: [],
    buildings: [],
    trees: [],
    billboards: [],
    laneMarkings: [],
    zebras: [],
    
    // Contact shadow texture (T-702)
    contactShadowTexture: null,
    
    // Movement and scale validation cube
    box5u: null,
    
    // Reference origin (matches start intersection)
    originX: 1100,
    originZ: 1100,

    /**
     * Creates a circular contact shadow texture using Canvas
     */
    createContactShadowTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            // Return empty texture for headless environments (like JSDOM)
            return new THREE.Texture();
        }
        const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
        grad.addColorStop(0.3, 'rgba(0, 0, 0, 0.85)');
        grad.addColorStop(0.8, 'rgba(0, 0, 0, 0.25)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 64, 64);
        return new THREE.CanvasTexture(canvas);
    },

    init() {
        const canvas = document.getElementById('gameCanvas3D');
        if (!canvas) {
            console.error('gameCanvas3D element not found!');
            return;
        }

        FacadeGenerator.init();
        this.contactShadowTexture = this.createContactShadowTexture();

        const parent = canvas.parentElement;
        const width = parent.clientWidth || 800;
        const height = parent.clientHeight || 600;

        // 1. Initialize WebGLRenderer
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.setSize(width, height, false);
        this.renderer.setClearColor(0x000000, 1.0);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // 2. Initialize Scene
        this.scene = new THREE.Scene();

        // 3. Configure OrthographicCamera (isometric view)
        const aspect = width / height;
        const viewSize = 60; // Scale adjusted isometric view size
        
        this.camera = new THREE.OrthographicCamera(
            -viewSize * aspect / 2, // left
            viewSize * aspect / 2,  // right
            viewSize / 2,           // top
            -viewSize / 2,          // bottom
            -200,                   // near
            1000                    // far
        );

        this.camera.zoom = 1.0;
        this.camera.updateProjectionMatrix();

        const SF = WorldMetrics.SCALE_FACTOR;

        // 3B. Setup lighting and shadows
        this.setupLighting();

        // 4. Handle resize event
        window.addEventListener('resize', () => {
            const w = parent.clientWidth || 800;
            const h = parent.clientHeight || 600;
            
            this.renderer.setSize(w, h, false);
            
            const newAspect = w / h;
            this.camera.left = -viewSize * newAspect / 2;
            this.camera.right = viewSize * newAspect / 2;
            this.camera.top = viewSize / 2;
            this.camera.bottom = -viewSize / 2;
            this.camera.updateProjectionMatrix();
        });

        // 5. Build environment on WorldGrid
        
        // A. Grass ground plane (3000x3000px -> 300x300m) - desaturated green (T-276)
        const groundGeom = new THREE.PlaneGeometry(3000 * SF, 3000 * SF);
        const groundMat = new THREE.MeshStandardMaterial({ color: 0x42634e, roughness: 0.9, metalness: 0.0 });
        this.groundPlane = new THREE.Mesh(groundGeom, groundMat);
        this.groundPlane.rotation.x = -Math.PI / 2;
        this.groundPlane.position.set(1500 * SF, -0.005, 1500 * SF);
        this.groundPlane.receiveShadow = true;
        this.scene.add(this.groundPlane);

        // B. Asphalt ground plane - darker road color (T-276)
        const asphaltSize = 3000 - 2 * WorldGrid.PADDING;
        const asphaltGeom = new THREE.PlaneGeometry(asphaltSize * SF, asphaltSize * SF);
        const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x18181a, roughness: 0.9, metalness: 0.0 });
        this.asphaltPlane = new THREE.Mesh(asphaltGeom, asphaltMat);
        this.asphaltPlane.rotation.x = -Math.PI / 2;
        this.asphaltPlane.position.set(1500 * SF, -0.001, 1500 * SF);
        this.asphaltPlane.receiveShadow = true;
        this.scene.add(this.asphaltPlane);

        // C. Build 9 blocks (sidewalk + building zones)
        this.sidewalks = [];
        this.buildingZones = [];
        this.buildings = [];
        const shops = [];
        
        // Sidewalks - chłodniejsze i jaśniejsze, Plots - lekko zabarwione (T-276)
        const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x9eb1bd, roughness: 0.8, metalness: 0.0 });
        const buildingZoneMat = new THREE.MeshStandardMaterial({ color: 0x7c8a99, roughness: 0.8, metalness: 0.0 });
        
        for (let r = 0; r < WorldGrid.GRID_ROWS; r++) {
            for (let c = 0; c < WorldGrid.GRID_COLS; c++) {
                const b = WorldGrid.getBlockBounds(r, c);
                const posX = (b.x + b.w / 2) * SF;
                const posZ = (b.y + b.h / 2) * SF;
                
                // 1. Sidewalk base
                const swGeom = new THREE.BoxGeometry(b.w * SF, WorldMetrics.SIDEWALK_HEIGHT, b.h * SF);
                const swMesh = new THREE.Mesh(swGeom, sidewalkMat);
                swMesh.position.set(posX, WorldMetrics.SIDEWALK_HEIGHT / 2, posZ);
                swMesh.receiveShadow = true;
                this.scene.add(swMesh);
                this.sidewalks.push(swMesh);
                
                // 2. Building zone platform
                const bzGeom = new THREE.BoxGeometry(300 * SF, 0.05, 300 * SF);
                const bzMesh = new THREE.Mesh(bzGeom, buildingZoneMat);
                bzMesh.position.set(posX, WorldMetrics.SIDEWALK_HEIGHT + 0.025, posZ);
                bzMesh.receiveShadow = true;
                this.scene.add(bzMesh);
                this.buildingZones.push(bzMesh);

                // 3. Generate procedural buildings
                const pattern = (r + c) % 3;
                if (pattern === 0) {
                    this.createBuilding('skyscraper', posX, posZ, 380 * SF, 120 * SF, 120 * SF);
                    const s1 = this.createBuilding('shop', posX - 80 * SF, posZ - 80 * SF, 50 * SF, 80 * SF, 80 * SF);
                    const s2 = this.createBuilding('shop', posX + 80 * SF, posZ + 80 * SF, 50 * SF, 80 * SF, 80 * SF);
                    shops.push({ group: s1, w: 80 * SF, d: 80 * SF, h: 50 * SF });
                    shops.push({ group: s2, w: 80 * SF, d: 80 * SF, h: 50 * SF });
                } else if (pattern === 1) {
                    this.createBuilding('residential', posX - 60 * SF, posZ, 180 * SF, 120 * SF, 200 * SF);
                    this.createBuilding('residential', posX + 60 * SF, posZ + 50 * SF, 140 * SF, 100 * SF, 100 * SF);
                } else {
                    this.createBuilding('residential', posX, posZ - 50 * SF, 200 * SF, 180 * SF, 120 * SF);
                    const s1 = this.createBuilding('shop', posX - 80 * SF, posZ + 80 * SF, 60 * SF, 80 * SF, 80 * SF);
                    const s2 = this.createBuilding('shop', posX + 80 * SF, posZ + 80 * SF, 45 * SF, 80 * SF, 80 * SF);
                    shops.push({ group: s1, w: 80 * SF, d: 80 * SF, h: 60 * SF });
                    shops.push({ group: s2, w: 80 * SF, d: 80 * SF, h: 45 * SF });
                }
            }
        }

        // D. Generate lane markings
        this.laneMarkings = [];
        const roads = WorldGrid.getStreetCenters();
        
        roads.forEach(rx => {
            this.createDashedLine(rx * SF, 500 * SF, rx * SF, 1000 * SF, true);
            this.createDashedLine(rx * SF, 1200 * SF, rx * SF, 1700 * SF, true);
            this.createDashedLine(rx * SF, 1900 * SF, rx * SF, 2400 * SF, true);
        });
        
        roads.forEach(rz => {
            this.createDashedLine(500 * SF, rz * SF, 1000 * SF, rz * SF, false);
            this.createDashedLine(1200 * SF, rz * SF, 1700 * SF, rz * SF, false);
            this.createDashedLine(1900 * SF, rz * SF, 2400 * SF, rz * SF, false);
        });

        // E. Generate pedestrian zebra crossings
        this.zebras = [];
        roads.forEach(cx => {
            roads.forEach(cz => {
                this.createZebra(cx * SF, (cz - 110) * SF, true);  // North
                this.createZebra(cx * SF, (cz + 110) * SF, true);  // South
                this.createZebra((cx - 110) * SF, cz * SF, false); // West
                this.createZebra((cx + 110) * SF, cz * SF, false); // East
            });
        });

        // F. Generate trees on sidewalks
        this.trees = [];
        const treePositions = [];
        const treeOffsets = [
            { x: -200, z: -200 }, { x: 200, z: -200 },
            { x: -200, z: 200 },  { x: 200, z: 200 },
            { x: -200, z: 0 },    { x: 200, z: 0 },
            { x: 0, z: -200 },    { x: 0, z: 200 }
        ];

        for (let r = 0; r < WorldGrid.GRID_ROWS; r++) {
            for (let c = 0; c < WorldGrid.GRID_COLS; c++) {
                const b = WorldGrid.getBlockBounds(r, c);
                const posX = (b.x + b.w / 2) * SF;
                const posZ = (b.y + b.h / 2) * SF;

                treeOffsets.forEach(offset => {
                    treePositions.push({
                        x: posX + offset.x * SF,
                        z: posZ + offset.z * SF
                    });
                });
            }
        }

        // Shuffle tree positions and choose a count between 18 and 25
        treePositions.sort(() => Math.random() - 0.5);
        const totalTreesCount = Math.floor(Math.random() * 8) + 18;
        for (let i = 0; i < Math.min(totalTreesCount, treePositions.length); i++) {
            const pos = treePositions[i];
            const sizeType = Math.random() < 0.3 ? 'shrub' : 'tree';
            this.createTree(sizeType, pos.x, pos.z);
        }

        // G. Generate billboards on shop roofs
        this.billboards = [];
        if (shops.length >= 2) {
            shops.sort(() => Math.random() - 0.5);
            this.addBillboard(shops[0].group, shops[0].w, shops[0].d, shops[0].h);
            this.addBillboard(shops[1].group, shops[1].w, shops[1].d, shops[1].h);
        }

        // 6. Test movement & scale validation cube
        const geom5u = new THREE.BoxGeometry(1.5, 1.5, 1.5);
        const mat5u = new THREE.MeshBasicMaterial({ color: 0xe74c3c });
        this.box5u = new THREE.Mesh(geom5u, mat5u);
        this.box5u.position.set(this.originX * SF, 1.5 / 2, (this.originZ + 200) * SF);
        this.scene.add(this.box5u);
    },

    createDashedLine(xStart, zStart, xEnd, zEnd, isVertical) {
        const SF = WorldMetrics.SCALE_FACTOR;
        const dashLength = 15 * SF;
        const dashGap = 15 * SF;
        const step = dashLength + dashGap;
        
        const geom = new THREE.BoxGeometry(isVertical ? 0.2 : dashLength, 0.005, isVertical ? dashLength : 0.2);
        const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        
        const start = isVertical ? zStart : xStart;
        const end = isVertical ? zEnd : xEnd;
        
        for (let pos = start + dashGap; pos < end - dashGap; pos += step) {
            const mesh = new THREE.Mesh(geom, mat);
            const posX = isVertical ? xStart : pos;
            const posZ = isVertical ? pos : zStart;
            mesh.position.set(posX, 0.003, posZ);
            this.scene.add(mesh);
            this.laneMarkings.push(mesh);
        }
    },

    createZebra(cx, cz, isVerticalRoad) {
        const SF = WorldMetrics.SCALE_FACTOR;
        const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const stripeOffsets = [-60 * SF, -30 * SF, 0, 30 * SF, 60 * SF];
        
        if (isVerticalRoad) {
            const stripeGeom = new THREE.BoxGeometry(0.4, 0.005, 2.0);
            stripeOffsets.forEach(dx => {
                const mesh = new THREE.Mesh(stripeGeom, stripeMat);
                mesh.position.set(cx + dx, 0.003, cz);
                this.scene.add(mesh);
                this.zebras.push(mesh);
            });
        } else {
            const stripeGeom = new THREE.BoxGeometry(2.0, 0.005, 0.4);
            stripeOffsets.forEach(dz => {
                const mesh = new THREE.Mesh(stripeGeom, stripeMat);
                mesh.position.set(cx, 0.003, cz + dz);
                this.scene.add(mesh);
                this.zebras.push(mesh);
            });
        }
    },

    createBuilding(type, x, z, height, width, depth) {
        const group = new THREE.Group();
        group.position.set(x, 0, z);

        let roofY = height;
        let roofWidth = width;
        let roofDepth = depth;

        // Circular contact shadow under building (T-702, T-278)
        const shadowGeom = new THREE.PlaneGeometry(width * 1.15, depth * 1.15);
        const shadowMat = new THREE.MeshBasicMaterial({
            color: 0x000000,
            map: this.contactShadowTexture,
            transparent: true,
            opacity: 0.85,
            depthWrite: false
        });
        const shadowMesh = new THREE.Mesh(shadowGeom, shadowMat);
        shadowMesh.rotation.x = -Math.PI / 2;
        shadowMesh.position.set(0, WorldMetrics.SIDEWALK_HEIGHT + 0.005, 0);
        group.add(shadowMesh);

        if (type === 'skyscraper') {
            const baseHeight = height * 0.75;
            const topHeight = height * 0.25;

            // Skyscraper base with procedural texture
            const baseGeom = new THREE.BoxGeometry(width, baseHeight, depth);
            const baseMats = this.getBuildingMaterials('skyscraper', width, baseHeight, depth, 0x2d3436);
            const base = new THREE.Mesh(baseGeom, baseMats);
            base.position.y = baseHeight / 2;
            base.castShadow = true;
            base.receiveShadow = true;
            group.add(base);

            // Narrow top section (setback)
            const topGeom = new THREE.BoxGeometry(width * 0.75, topHeight, depth * 0.75);
            const topMats = this.getBuildingMaterials('skyscraper', width * 0.75, topHeight, depth * 0.75, 0x353b48);
            const topMesh = new THREE.Mesh(topGeom, topMats);
            topMesh.position.y = baseHeight + topHeight / 2;
            topMesh.castShadow = true;
            topMesh.receiveShadow = true;
            group.add(topMesh);

            // Edge outlines for better visibility/contrast
            const edgesBase = new THREE.EdgesGeometry(baseGeom);
            const lineBase = new THREE.LineSegments(edgesBase, new THREE.LineBasicMaterial({ color: 0x111111 }));
            lineBase.position.y = baseHeight / 2;
            group.add(lineBase);

            const edgesTop = new THREE.EdgesGeometry(topGeom);
            const lineTop = new THREE.LineSegments(edgesTop, new THREE.LineBasicMaterial({ color: 0x111111 }));
            lineTop.position.y = baseHeight + topHeight / 2;
            group.add(lineTop);

            roofWidth = width * 0.75;
            roofDepth = depth * 0.75;
            roofY = height;

        } else if (type === 'residential') {
            // Residential block with regular window grid
            const bodyGeom = new THREE.BoxGeometry(width, height, depth);
            const bodyMats = this.getBuildingMaterials('residential', width, height, depth, 0xb2bec3);
            const body = new THREE.Mesh(bodyGeom, bodyMats);
            body.position.y = height / 2;
            body.castShadow = true;
            body.receiveShadow = true;
            group.add(body);

            const edges = new THREE.EdgesGeometry(bodyGeom);
            const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x222222 }));
            line.position.y = height / 2;
            group.add(line);

        } else if (type === 'shop') {
            // Low retail shop (storefront window facades on ground floor)
            const bodyGeom = new THREE.BoxGeometry(width, height, depth);
            const bodyMats = this.getBuildingMaterials('shop', width, height, depth, 0xf5cd79);
            const body = new THREE.Mesh(bodyGeom, bodyMats);
            body.position.y = height / 2;
            body.castShadow = true;
            body.receiveShadow = true;
            group.add(body);

            const edges = new THREE.EdgesGeometry(bodyGeom);
            const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x444444 }));
            line.position.y = height / 2;
            group.add(line);
        }

        // 40% chance of procedural roof HVAC units
        this.addHVACUnits(group, roofWidth, roofDepth, roofY);

        this.scene.add(group);
        this.buildings.push(group);
        return group;
    },

    getBuildingMaterials(type, width, height, depth, baseColor) {
        const topMat = new THREE.MeshStandardMaterial({
            color: baseColor,
            roughness: 0.8,
            metalness: 0.1
        });
        const bottomMat = topMat;

        let matX, matZ;

        if (type === 'skyscraper') {
            matX = this.createFaceMaterial('skyscraper', depth, height, baseColor);
            matZ = this.createFaceMaterial('skyscraper', width, height, baseColor);
            return [matX, matX, topMat, bottomMat, matZ, matZ];
        } else if (type === 'residential') {
            matX = this.createFaceMaterial('residential', depth, height, baseColor);
            matZ = this.createFaceMaterial('residential', width, height, baseColor);
            return [matX, matX, topMat, bottomMat, matZ, matZ];
        } else if (type === 'shop') {
            const matFront = this.createFaceMaterial('shop_front', width, height, baseColor);
            const matSide = this.createFaceMaterial('shop_side', depth, height, baseColor);
            return [matSide, matSide, topMat, bottomMat, matFront, matFront];
        }

        return [topMat, topMat, topMat, bottomMat, topMat, topMat];
    },

    createFaceMaterial(textureType, faceWidth, faceHeight, baseColor) {
        const originalTexture = FacadeGenerator.textures.get(textureType);
        if (!originalTexture) {
            return new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.8, metalness: 0.1 });
        }
        const texture = originalTexture.clone();
        
        const repeatY = (textureType === 'shop_front' || textureType === 'shop_side') ? 1 : faceHeight / 5.0;
        texture.repeat.set(faceWidth / 5.0, repeatY);
        
        const color = new THREE.Color(baseColor);
        const tint = 0.95 + Math.random() * 0.1; // Subtle variations for organic diversity
        color.multiplyScalar(tint);

        return new THREE.MeshStandardMaterial({
            map: texture,
            color: color,
            roughness: 0.8,
            metalness: textureType === 'skyscraper' ? 0.25 : 0.1
        });
    },

    addHVACUnits(group, roofWidth, roofDepth, roofY) {
        if (Math.random() > 0.4) return;

        const sizes = [
            { w: 1.5, h: 0.8, d: 1.2 },
            { w: 1.0, h: 0.6, d: 1.0 },
            { w: 2.2, h: 1.0, d: 1.6 }
        ];

        const count = Math.floor(Math.random() * 3) + 1;
        const hvacMat = new THREE.MeshStandardMaterial({ color: 0x7f8c8d, roughness: 0.5, metalness: 0.6 });
        const hvacEdgeMat = new THREE.LineBasicMaterial({ color: 0x2c3e50 });

        for (let i = 0; i < count; i++) {
            const size = sizes[Math.floor(Math.random() * sizes.length)];
            const geom = new THREE.BoxGeometry(size.w, size.h, size.d);
            const mesh = new THREE.Mesh(geom, hvacMat);
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            const marginX = roofWidth * 0.15 + size.w / 2;
            const marginZ = roofDepth * 0.15 + size.d / 2;
            
            const rangeX = Math.max(0, roofWidth - marginX * 2);
            const rangeZ = Math.max(0, roofDepth - marginZ * 2);

            const rx = rangeX > 0 ? (Math.random() - 0.5) * rangeX : 0;
            const rz = rangeZ > 0 ? (Math.random() - 0.5) * rangeZ : 0;

            mesh.position.set(rx, roofY + size.h / 2, rz);
            group.add(mesh);

            const edges = new THREE.EdgesGeometry(geom);
            const line = new THREE.LineSegments(edges, hvacEdgeMat);
            line.position.copy(mesh.position);
            group.add(line);
        }

        // 35% chance to add a taller architectural element on the roof (chimney or antenna tower) (T-261)
        if (Math.random() < 0.35) {
            const isAntenna = Math.random() < 0.5;
            if (isAntenna) {
                // Tall antenna/mast
                const mastGeom = new THREE.CylinderGeometry(0.1, 0.15, 4.0, 4);
                const mastMat = new THREE.MeshStandardMaterial({ color: 0xdcdde1, metalness: 0.8, roughness: 0.2 });
                const mast = new THREE.Mesh(mastGeom, mastMat);
                mast.castShadow = true;
                mast.receiveShadow = true;

                const rx = (Math.random() - 0.5) * roofWidth * 0.4;
                const rz = (Math.random() - 0.5) * roofDepth * 0.4;
                mast.position.set(rx, roofY + 2.0, rz);
                group.add(mast);

                // Warning beacon on top
                const beaconGeom = new THREE.BoxGeometry(0.25, 0.25, 0.25);
                const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff4757 }); // emissive red beacon
                const beacon = new THREE.Mesh(beaconGeom, beaconMat);
                beacon.position.set(rx, roofY + 4.125, rz);
                group.add(beacon);
            } else {
                // Concrete service/elevator shaft or chimney
                const shaftGeom = new THREE.BoxGeometry(2.5, 3.0, 2.5);
                const shaftMat = new THREE.MeshStandardMaterial({ color: 0x718093, roughness: 0.9, metalness: 0.1 });
                const shaft = new THREE.Mesh(shaftGeom, shaftMat);
                shaft.castShadow = true;
                shaft.receiveShadow = true;

                const rx = (Math.random() - 0.5) * roofWidth * 0.4;
                const rz = (Math.random() - 0.5) * roofDepth * 0.4;
                shaft.position.set(rx, roofY + 1.5, rz);
                group.add(shaft);

                // Shaft door or vents (simple detail box on side)
                const ventGeom = new THREE.BoxGeometry(0.3, 1.2, 0.8);
                const ventMat = new THREE.MeshStandardMaterial({ color: 0x2f3640, roughness: 0.5 });
                const vent = new THREE.Mesh(ventGeom, ventMat);
                vent.position.set(rx + 1.25, roofY + 1.0, rz);
                group.add(vent);

                // Outline edges for shaft
                const edges = new THREE.EdgesGeometry(shaftGeom);
                const line = new THREE.LineSegments(edges, hvacEdgeMat);
                line.position.copy(shaft.position);
                group.add(line);
            }
        }
    },

    addBillboard(group, roofWidth, roofDepth, roofY) {
        const billboardGroup = new THREE.Group();
        
        // Frame legs
        const legGeom = new THREE.BoxGeometry(0.2, 2.0, 0.2);
        const legMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.7, metalness: 0.5 });
        const legEdgeMat = new THREE.LineBasicMaterial({ color: 0x111111 });

        const leftLeg = new THREE.Mesh(legGeom, legMat);
        leftLeg.position.set(-1.5, 1.0, 0);
        leftLeg.castShadow = true;
        leftLeg.receiveShadow = true;
        billboardGroup.add(leftLeg);

        const rightLeg = new THREE.Mesh(legGeom, legMat);
        rightLeg.position.set(1.5, 1.0, 0);
        rightLeg.castShadow = true;
        rightLeg.receiveShadow = true;
        billboardGroup.add(rightLeg);

        [leftLeg, rightLeg].forEach(leg => {
            const edges = new THREE.EdgesGeometry(legGeom);
            const line = new THREE.LineSegments(edges, legEdgeMat);
            line.position.copy(leg.position);
            billboardGroup.add(line);
        });

        // Board panel
        const boardGeom = new THREE.BoxGeometry(5.0, 2.5, 0.3);
        const boardMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.8, metalness: 0.1 });
        const board = new THREE.Mesh(boardGeom, boardMat);
        board.position.set(0, 2.5, 0);
        board.castShadow = true;
        board.receiveShadow = true;
        billboardGroup.add(board);

        const boardEdges = new THREE.EdgesGeometry(boardGeom);
        const boardLine = new THREE.LineSegments(boardEdges, legEdgeMat);
        boardLine.position.copy(board.position);
        billboardGroup.add(boardLine);

        // Poster sheet
        const posterGeom = new THREE.PlaneGeometry(4.6, 2.1);
        const posterColors = [0xe74c3c, 0x9b59b6, 0xf1c40f, 0xe67e22, 0x1abc9c, 0xe84393];
        const randomColor = posterColors[Math.floor(Math.random() * posterColors.length)];
        const posterMat = new THREE.MeshStandardMaterial({ 
            color: randomColor,
            roughness: 0.8,
            metalness: 0.0,
            side: THREE.DoubleSide
        });
        
        const poster = new THREE.Mesh(posterGeom, posterMat);
        poster.position.set(0, 2.5, 0.16);
        poster.castShadow = true;
        poster.receiveShadow = true;
        billboardGroup.add(poster);

        const posterEdges = new THREE.EdgesGeometry(posterGeom);
        const posterLine = new THREE.LineSegments(posterEdges, new THREE.LineBasicMaterial({ color: 0xffffff }));
        posterLine.position.copy(poster.position);
        billboardGroup.add(posterLine);

        billboardGroup.position.set(0, roofY, 0);

        // Random rotation aligned to building boundaries
        const rotations = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
        billboardGroup.rotation.y = rotations[Math.floor(Math.random() * rotations.length)];

        group.add(billboardGroup);
        this.billboards.push(billboardGroup);
    },

    createTree(sizeType, x, z) {
        const group = new THREE.Group();
        group.position.set(x, WorldMetrics.SIDEWALK_HEIGHT, z);

        const greenShades = [
            0x2ecc71, 0x27ae60, 0x1abc9c, 0x16a085, 0x1e824c, 0x2d5a27
        ];
        const leafColor = greenShades[Math.floor(Math.random() * greenShades.length)];

        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x795548, roughness: 0.9, metalness: 0.0 });
        const trunkEdgeMat = new THREE.LineBasicMaterial({ color: 0x3d271d });
        const leafMat = new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.8, metalness: 0.0 });
        const leafEdgeMat = new THREE.LineBasicMaterial({ color: 0x145a32 });

        if (sizeType === 'shrub') {
            const trunkGeom = new THREE.CylinderGeometry(0.15, 0.15, 0.6, 5);
            const trunk = new THREE.Mesh(trunkGeom, trunkMat);
            trunk.position.y = 0.3;
            trunk.castShadow = true;
            trunk.receiveShadow = true;
            group.add(trunk);

            const trunkEdges = new THREE.EdgesGeometry(trunkGeom);
            const trunkLine = new THREE.LineSegments(trunkEdges, trunkEdgeMat);
            trunkLine.position.copy(trunk.position);
            group.add(trunkLine);

            const leafGeom = new THREE.SphereGeometry(0.8, 6, 6);
            const leaf = new THREE.Mesh(leafGeom, leafMat);
            leaf.position.y = 0.8;
            leaf.castShadow = true;
            leaf.receiveShadow = true;
            group.add(leaf);

            const leafEdges = new THREE.EdgesGeometry(leafGeom);
            const leafLine = new THREE.LineSegments(leafEdges, leafEdgeMat);
            leafLine.position.copy(leaf.position);
            group.add(leafLine);
        } else {
            const trunkGeom = new THREE.CylinderGeometry(0.2, 0.2, 1.6, 6);
            const trunk = new THREE.Mesh(trunkGeom, trunkMat);
            trunk.position.y = 0.8;
            trunk.castShadow = true;
            trunk.receiveShadow = true;
            group.add(trunk);

            const trunkEdges = new THREE.EdgesGeometry(trunkGeom);
            const trunkLine = new THREE.LineSegments(trunkEdges, trunkEdgeMat);
            trunkLine.position.copy(trunk.position);
            group.add(trunkLine);

            // Lower foliage
            const leafGeom1 = new THREE.SphereGeometry(1.4, 8, 8);
            const leaf1 = new THREE.Mesh(leafGeom1, leafMat);
            leaf1.position.y = 2.0;
            leaf1.castShadow = true;
            leaf1.receiveShadow = true;
            group.add(leaf1);

            const leafEdges1 = new THREE.EdgesGeometry(leafGeom1);
            const leafLine1 = new THREE.LineSegments(leafEdges1, leafEdgeMat);
            leafLine1.position.copy(leaf1.position);
            group.add(leafLine1);

            // Upper foliage
            const leafGeom2 = new THREE.SphereGeometry(1.0, 8, 8);
            const leaf2 = new THREE.Mesh(leafGeom2, leafMat);
            leaf2.position.y = 2.8;
            leaf2.castShadow = true;
            leaf2.receiveShadow = true;
            group.add(leaf2);

            const leafEdges2 = new THREE.EdgesGeometry(leafGeom2);
            const leafLine2 = new THREE.LineSegments(leafEdges2, leafEdgeMat);
            leafLine2.position.copy(leaf2.position);
            group.add(leafLine2);
        }

        this.scene.add(group);
        this.trees.push(group);
        return group;
    },

    setupLighting() {
        const SF = WorldMetrics.SCALE_FACTOR;

        // 1. Ambient lighting to soften shadows - decreased to let hemisphere light gradient shine (T-276)
        const ambient = new THREE.AmbientLight(0x8585a0, 0.45);
        this.scene.add(ambient);

        // 1B. HemisphereLight for fake ambient gradient (top: chłodniejszy błękit, bottom: cieplejszy piaskowy) (T-276)
        const hemiLight = new THREE.HemisphereLight(0xa4b3c6, 0x786e64, 0.55);
        this.scene.add(hemiLight);

        // 2. Directional light simulating the sun - lower angle for longer, dramatic shadows (T-278)
        const sun = new THREE.DirectionalLight(0xfff5e6, 1.55);
        sun.position.set(600 * SF, 550 * SF, 400 * SF);
        
        sun.target.position.set(1500 * SF, 0, 1500 * SF);
        this.scene.add(sun.target);

        sun.castShadow = true;
        sun.shadow.bias = -0.0005;
        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;

        const d = 1600 * SF;
        sun.shadow.camera.left = -d;
        sun.shadow.camera.right = d;
        sun.shadow.camera.top = d;
        sun.shadow.camera.bottom = -d;
        sun.shadow.camera.near = 10;
        sun.shadow.camera.far = 300;

        this.scene.add(sun);
    },

    update() {
        if (!this.renderer || !this.scene || !this.camera) return;

        const SF = WorldMetrics.SCALE_FACTOR;

        // Validation - smooth red cube movement on X-axis
        const time = Date.now() * 0.001;
        this.box5u.position.x = (1500 + Math.sin(time) * 1000) * SF;
        this.box5u.position.z = 1100 * SF;

        // Track focus target (Player or active vehicle)
        const player = World.getEntitiesByType('player')[0];
        let focusX = this.originX;
        let focusZ = this.originZ;

        if (player && player.transform) {
            focusX = player.transform.x;
            focusZ = player.transform.y;
        }

        const sFocusX = focusX * SF;
        const sFocusZ = focusZ * SF;

        // Isometric camera alignment
        const tiltAngle = 35.264 * Math.PI / 180;
        const yawAngle = 45 * Math.PI / 180;
        const distance = 1200 * SF;

        this.camera.position.x = sFocusX + Math.cos(yawAngle) * Math.cos(tiltAngle) * distance;
        this.camera.position.y = Math.sin(tiltAngle) * distance;
        this.camera.position.z = sFocusZ + Math.sin(yawAngle) * Math.cos(tiltAngle) * distance;
        
        this.camera.lookAt(sFocusX, 0, sFocusZ);

        RenderSync3D.update(this.scene);
        this.renderer.render(this.scene, this.camera);
    }
};
