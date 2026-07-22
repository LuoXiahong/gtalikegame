/**
 * CityBuilder3D — buildings, sidewalks, trees, and billboards.
 */
import * as THREE from 'three';
import { WorldGrid } from '../world/WorldGrid.js';
import { WorldMetrics } from '../world/WorldMetrics.js';
import { FacadeGenerator } from './FacadeGenerator.js';
import { createPropAt, PROP_TYPES } from './PropFactory.js';

/** Inset from block outer edge onto sidewalk (2D px). */
export const LAMP_EDGE_INSET = 30;
/** Target spacing along a block edge (2D px) — corners + even steps. */
export const LAMP_EDGE_SPACING = 220;
/** Min 3D distance between a random prop and a lamp. */
const PROP_LAMP_CLEARANCE = 2.5;

export const CityBuilder3D = {
    buildCity(renderSystem) {
        const SF = WorldMetrics.SCALE_FACTOR;
        // Removed groundPlane and asphaltPlane to allow 2D tilemap to show through

        renderSystem.sidewalks = [];
        renderSystem.buildingZones = [];
        renderSystem.buildings = [];
        const shops = [];

        const sidewalkMat = new THREE.MeshStandardMaterial({
            color: 0x8a8478,
            roughness: 0.95,
            metalness: 0.0,
            envMapIntensity: 0.15
        });
        const buildingZoneMat = new THREE.MeshStandardMaterial({
            color: 0x6b6558,
            roughness: 0.95,
            metalness: 0.0,
            envMapIntensity: 0.15
        });

        for (let r = 0; r < WorldGrid.GRID_ROWS; r++) {
            for (let c = 0; c < WorldGrid.GRID_COLS; c++) {
                const b = WorldGrid.getBlockBounds(r, c);
                const posX = (b.x + b.w / 2) * SF;
                const posZ = (b.y + b.h / 2) * SF;

                const swGeom = new THREE.BoxGeometry(b.w * SF, WorldMetrics.SIDEWALK_HEIGHT, b.h * SF);
                const swMesh = new THREE.Mesh(swGeom, sidewalkMat);
                swMesh.position.set(posX, WorldMetrics.SIDEWALK_HEIGHT / 2, posZ);
                swMesh.receiveShadow = true;
                renderSystem.scene.add(swMesh);
                renderSystem.sidewalks.push(swMesh);

                const bzGeom = new THREE.BoxGeometry(300 * SF, 0.05, 300 * SF);
                const bzMesh = new THREE.Mesh(bzGeom, buildingZoneMat);
                bzMesh.position.set(posX, WorldMetrics.SIDEWALK_HEIGHT + 0.025, posZ);
                bzMesh.receiveShadow = true;
                renderSystem.scene.add(bzMesh);
                renderSystem.buildingZones.push(bzMesh);

                const pattern = (r + c) % 3;
                if (pattern === 0) {
                    this.createBuilding(renderSystem, { type: 'skyscraper', x: posX, z: posZ, height: 380 * SF, width: 120 * SF, depth: 120 * SF });
                    const s1 = this.createBuilding(renderSystem, { type: 'shop', x: posX - 80 * SF, z: posZ - 80 * SF, height: 50 * SF, width: 80 * SF, depth: 80 * SF });
                    const s2 = this.createBuilding(renderSystem, { type: 'shop', x: posX + 80 * SF, z: posZ + 80 * SF, height: 50 * SF, width: 80 * SF, depth: 80 * SF });
                    shops.push({ group: s1, w: 80 * SF, d: 80 * SF, h: 50 * SF });
                    shops.push({ group: s2, w: 80 * SF, d: 80 * SF, h: 50 * SF });
                } else if (pattern === 1) {
                    this.createBuilding(renderSystem, { type: 'residential', x: posX - 60 * SF, z: posZ, height: 180 * SF, width: 120 * SF, depth: 200 * SF });
                    this.createBuilding(renderSystem, { type: 'residential', x: posX + 60 * SF, z: posZ + 50 * SF, height: 140 * SF, width: 100 * SF, depth: 100 * SF });
                } else {
                    this.createBuilding(renderSystem, { type: 'residential', x: posX, z: posZ - 50 * SF, height: 200 * SF, width: 180 * SF, depth: 120 * SF });
                    const s1 = this.createBuilding(renderSystem, { type: 'shop', x: posX - 80 * SF, z: posZ + 80 * SF, height: 60 * SF, width: 80 * SF, depth: 80 * SF });
                    const s2 = this.createBuilding(renderSystem, { type: 'shop', x: posX + 80 * SF, z: posZ + 80 * SF, height: 45 * SF, width: 80 * SF, depth: 80 * SF });
                    shops.push({ group: s1, w: 80 * SF, d: 80 * SF, h: 60 * SF });
                    shops.push({ group: s2, w: 80 * SF, d: 80 * SF, h: 45 * SF });
                }
            }
        }

        renderSystem.trees = [];
        const treePositions = [];
        const treeOffsets = [
            { x: -200, z: -200 }, { x: 200, z: -200 },
            { x: -200, z: 200 }, { x: 200, z: 200 },
            { x: -200, z: 0 }, { x: 200, z: 0 },
            { x: 0, z: -200 }, { x: 0, z: 200 }
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

        treePositions.sort(() => Math.random() - 0.5);
        const totalTreesCount = Math.floor(Math.random() * 8) + 18;
        for (let i = 0; i < Math.min(totalTreesCount, treePositions.length); i++) {
            const pos = treePositions[i];
            const sizeType = Math.random() < 0.3 ? 'shrub' : 'tree';
            this.createTree(renderSystem, sizeType, pos.x, pos.z);
        }

        this.placeSidewalkProps(renderSystem);

        renderSystem.billboards = [];
        if (shops.length >= 2) {
            shops.sort(() => Math.random() - 0.5);
            this.addBillboard(renderSystem, shops[0].group, shops[0].w, shops[0].d, shops[0].h);
            this.addBillboard(renderSystem, shops[1].group, shops[1].w, shops[1].d, shops[1].h);
        }
    },

    /**
     * Lamps: deterministic corners + even spacing along every block edge.
     * Other props: random on leftover sidewalk slots (clear of lamps).
     */
    placeSidewalkProps(renderSystem) {
        const SF = WorldMetrics.SCALE_FACTOR;
        renderSystem.props = [];
        renderSystem.streetLights = [];

        const lampSpots = this.collectLampSpots(SF);
        for (const spot of lampSpots) {
            this._placeProp(renderSystem, 'lampPost', spot.x, spot.z, spot.rot);
        }

        const propOffsets = [
            { x: -220, z: -180 }, { x: 220, z: -180 },
            { x: -220, z: 180 }, { x: 220, z: 180 },
            { x: -180, z: -220 }, { x: 180, z: -220 },
            { x: -180, z: 220 }, { x: 180, z: 220 },
            { x: -230, z: 0 }, { x: 230, z: 0 },
            { x: 0, z: -230 }, { x: 0, z: 230 }
        ];

        const candidates = [];
        for (let r = 0; r < WorldGrid.GRID_ROWS; r++) {
            for (let c = 0; c < WorldGrid.GRID_COLS; c++) {
                const b = WorldGrid.getBlockBounds(r, c);
                const posX = (b.x + b.w / 2) * SF;
                const posZ = (b.y + b.h / 2) * SF;
                propOffsets.forEach(offset => {
                    candidates.push({
                        x: posX + offset.x * SF,
                        z: posZ + offset.z * SF
                    });
                });
            }
        }

        const free = candidates.filter(pos =>
            lampSpots.every(lamp => Math.hypot(pos.x - lamp.x, pos.z - lamp.z) >= PROP_LAMP_CLEARANCE)
        );
        free.sort(() => Math.random() - 0.5);

        const others = PROP_TYPES.filter(t => t !== 'lampPost');
        const totalOthers = Math.floor(Math.random() * 5) + 10; // 10–14
        for (let i = 0; i < Math.min(totalOthers, free.length); i++) {
            const pos = free[i];
            const type = others[Math.floor(Math.random() * others.length)];
            const rot = (Math.floor(Math.random() * 4) * Math.PI) / 2;
            this._placeProp(renderSystem, type, pos.x, pos.z, rot);
        }
    },

    /**
     * Deterministic lamp world positions (3D xz) for every block edge.
     * @param {number} SF
     * @returns {{ x: number, z: number, rot: number }[]}
     */
    collectLampSpots(SF) {
        const spots = [];
        const seen = new Set();

        const add = (wx, wz, rot) => {
            const k = `${Math.round(wx)},${Math.round(wz)}`;
            if (seen.has(k)) return;
            seen.add(k);
            spots.push({ x: wx * SF, z: wz * SF, rot });
        };

        /** Place endpoints + even interior steps along an edge (2D px). */
        const placeEdge = (x0, z0, x1, z1, rot) => {
            const dx = x1 - x0;
            const dz = z1 - z0;
            const len = Math.hypot(dx, dz);
            const steps = Math.max(1, Math.round(len / LAMP_EDGE_SPACING));
            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                add(x0 + dx * t, z0 + dz * t, rot);
            }
        };

        for (let r = 0; r < WorldGrid.GRID_ROWS; r++) {
            for (let c = 0; c < WorldGrid.GRID_COLS; c++) {
                const b = WorldGrid.getBlockBounds(r, c);
                const x0 = b.x + LAMP_EDGE_INSET;
                const x1 = b.x + b.w - LAMP_EDGE_INSET;
                const z0 = b.y + LAMP_EDGE_INSET;
                const z1 = b.y + b.h - LAMP_EDGE_INSET;

                // Arm local +X → rotate so globe faces outward toward the street
                placeEdge(x0, z0, x1, z0, Math.PI / 2);   // north → -Z
                placeEdge(x0, z1, x1, z1, -Math.PI / 2);  // south → +Z
                placeEdge(x0, z0, x0, z1, Math.PI);       // west  → -X
                placeEdge(x1, z0, x1, z1, 0);             // east  → +X
            }
        }

        return spots;
    },

    _placeProp(renderSystem, type, x, z, rot) {
        const prop = createPropAt(type, x, z, rot);
        renderSystem.scene.add(prop);
        renderSystem.props.push(prop);
        if (type === 'lampPost') {
            prop.traverse(obj => {
                if (obj.isLight && obj.userData.isStreetLight) {
                    renderSystem.streetLights.push(obj);
                }
            });
        }
    },

    createBuilding(renderSystem, config) {
        const { type, x, z, height, width, depth } = config;
        const group = new THREE.Group();
        group.position.set(x, 0, z);

        let roofY = height;
        let roofWidth = width;
        let roofDepth = depth;

        const shadowGeom = new THREE.PlaneGeometry(width * 1.15, depth * 1.15);
        const shadowMat = new THREE.MeshBasicMaterial({
            color: 0x000000,
            map: renderSystem.contactShadowTexture,
            transparent: true,
            opacity: 0.45,
            depthWrite: false
        });
        const shadowMesh = new THREE.Mesh(shadowGeom, shadowMat);
        shadowMesh.rotation.x = -Math.PI / 2;
        shadowMesh.position.set(0, WorldMetrics.SIDEWALK_HEIGHT + 0.005, 0);
        group.add(shadowMesh);

        if (type === 'skyscraper') {
            // Art Deco "wedding cake": stacked setbacks, each smaller than the last
            const tiers = [
                { heightRatio: 0.38, scale: 1.00, color: 0xc4a882 }, // sandstone base
                { heightRatio: 0.26, scale: 0.82, color: 0xb8956c },
                { heightRatio: 0.20, scale: 0.64, color: 0xa8845a },
                { heightRatio: 0.16, scale: 0.46, color: 0x8b7355 }  // darker crown
            ];

            let yCursor = 0;
            tiers.forEach(tier => {
                const tierH = height * tier.heightRatio;
                const tierW = width * tier.scale;
                const tierD = depth * tier.scale;
                const geom = new THREE.BoxGeometry(tierW, tierH, tierD);
                const mats = this.getBuildingMaterials('skyscraper', tierW, tierH, tierD, tier.color);
                const mesh = new THREE.Mesh(geom, mats);
                mesh.position.y = yCursor + tierH / 2;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                group.add(mesh);

                const edges = new THREE.EdgesGeometry(geom);
                const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x3d2e1f }));
                line.position.y = mesh.position.y;
                group.add(line);

                roofWidth = tierW;
                roofDepth = tierD;
                yCursor += tierH;
            });
            roofY = height;

        } else if (type === 'residential') {
            const bodyGeom = new THREE.BoxGeometry(width, height, depth);
            const bodyMats = this.getBuildingMaterials('residential', width, height, depth, 0x9c4a3a); // brick
            const body = new THREE.Mesh(bodyGeom, bodyMats);
            body.position.y = height / 2;
            body.castShadow = true;
            body.receiveShadow = true;
            group.add(body);

            const edges = new THREE.EdgesGeometry(bodyGeom);
            const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x3d2218 }));
            line.position.y = height / 2;
            group.add(line);

        } else if (type === 'shop') {
            const bodyGeom = new THREE.BoxGeometry(width, height, depth);
            const bodyMats = this.getBuildingMaterials('shop', width, height, depth, 0xd4c5a9); // cream
            const body = new THREE.Mesh(bodyGeom, bodyMats);
            body.position.y = height / 2;
            body.castShadow = true;
            body.receiveShadow = true;
            group.add(body);

            const edges = new THREE.EdgesGeometry(bodyGeom);
            const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x5c4a32 }));
            line.position.y = height / 2;
            group.add(line);
        }

        this.addHVACUnits(group, roofWidth, roofDepth, roofY);

        renderSystem.scene.add(group);
        renderSystem.buildings.push(group);
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
        const emOriginal = FacadeGenerator.emissiveTextures.get(textureType);
        const emissiveMap = emOriginal ? emOriginal.clone() : null;

        const repeatY = (textureType === 'shop_front' || textureType === 'shop_side') ? 1 : faceHeight / 5.0;
        const repeatX = faceWidth / 5.0;
        texture.repeat.set(repeatX, repeatY);
        if (emissiveMap) {
            emissiveMap.repeat.set(repeatX, repeatY);
        }

        const color = new THREE.Color(baseColor);
        const tint = 0.95 + Math.random() * 0.1;
        color.multiplyScalar(tint);

        return new THREE.MeshStandardMaterial({
            map: texture,
            color: color,
            roughness: 0.8,
            metalness: textureType === 'skyscraper' ? 0.08 : 0.05,
            // Window-only emissive map (black elsewhere) — gentle glow, no bloom needed
            emissive: 0xffffff,
            emissiveMap: emissiveMap,
            emissiveIntensity: emissiveMap ? 0.4 : 0,
            envMapIntensity: 0.35
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

        if (Math.random() < 0.35) {
            const isAntenna = Math.random() < 0.5;
            if (isAntenna) {
                const mastGeom = new THREE.CylinderGeometry(0.1, 0.15, 4.0, 4);
                const mastMat = new THREE.MeshStandardMaterial({ color: 0xdcdde1, metalness: 0.8, roughness: 0.2 });
                const mast = new THREE.Mesh(mastGeom, mastMat);
                mast.castShadow = true;
                mast.receiveShadow = true;

                const rx = (Math.random() - 0.5) * roofWidth * 0.4;
                const rz = (Math.random() - 0.5) * roofDepth * 0.4;
                mast.position.set(rx, roofY + 2.0, rz);
                group.add(mast);

                const beaconGeom = new THREE.BoxGeometry(0.25, 0.25, 0.25);
                const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff4757 });
                const beacon = new THREE.Mesh(beaconGeom, beaconMat);
                beacon.position.set(rx, roofY + 4.125, rz);
                group.add(beacon);
            } else {
                const shaftGeom = new THREE.BoxGeometry(2.5, 3.0, 2.5);
                const shaftMat = new THREE.MeshStandardMaterial({ color: 0x718093, roughness: 0.9, metalness: 0.1 });
                const shaft = new THREE.Mesh(shaftGeom, shaftMat);
                shaft.castShadow = true;
                shaft.receiveShadow = true;

                const rx = (Math.random() - 0.5) * roofWidth * 0.4;
                const rz = (Math.random() - 0.5) * roofDepth * 0.4;
                shaft.position.set(rx, roofY + 1.5, rz);
                group.add(shaft);

                const ventGeom = new THREE.BoxGeometry(0.3, 1.2, 0.8);
                const ventMat = new THREE.MeshStandardMaterial({ color: 0x2f3640, roughness: 0.5 });
                const vent = new THREE.Mesh(ventGeom, ventMat);
                vent.position.set(rx + 1.25, roofY + 1.0, rz);
                group.add(vent);

                const edges = new THREE.EdgesGeometry(shaftGeom);
                const line = new THREE.LineSegments(edges, hvacEdgeMat);
                line.position.copy(shaft.position);
                group.add(line);
            }
        }
    },

    addBillboard(renderSystem, group, roofWidth, roofDepth, roofY) {
        const billboardGroup = new THREE.Group();

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

        const posterGeom = new THREE.PlaneGeometry(4.6, 2.1);
        // Neon is the only allowed period color accent
        const neonPosterColors = [0xff2d55, 0xffaa00, 0x00e5ff, 0xff0044];
        const randomColor = neonPosterColors[Math.floor(Math.random() * neonPosterColors.length)];
        const posterMat = new THREE.MeshStandardMaterial({
            color: randomColor,
            emissive: randomColor,
            emissiveIntensity: 0.45,
            roughness: 0.55,
            metalness: 0.15,
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

        const rotations = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
        billboardGroup.rotation.y = rotations[Math.floor(Math.random() * rotations.length)];

        group.add(billboardGroup);
        renderSystem.billboards.push(billboardGroup);
    },

    createTree(renderSystem, sizeType, x, z) {
        const group = new THREE.Group();
        group.position.set(x, WorldMetrics.SIDEWALK_HEIGHT, z);

        const greenShades = [
            0x2ecc71, 0x27ae60, 0x1abc9c, 0x16a085, 0x1e824c, 0x2d5a27
        ];
        const leafColor = greenShades[Math.floor(Math.random() * greenShades.length)];

        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x795548, roughness: 0.9, metalness: 0.0 });
        const leafMat = new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.8, metalness: 0.0, flatShading: true });

        if (sizeType === 'shrub') {
            const trunkGeom = new THREE.CylinderGeometry(0.15, 0.15, 0.6, 5);
            const trunk = new THREE.Mesh(trunkGeom, trunkMat);
            trunk.position.y = 0.3;
            trunk.castShadow = true;
            trunk.receiveShadow = true;
            group.add(trunk);

            const leafGeom = new THREE.SphereGeometry(0.8, 6, 6);
            const leaf = new THREE.Mesh(leafGeom, leafMat);
            leaf.position.y = 0.8;
            leaf.castShadow = true;
            leaf.receiveShadow = true;
            group.add(leaf);
        } else {
            const trunkGeom = new THREE.CylinderGeometry(0.2, 0.2, 1.6, 6);
            const trunk = new THREE.Mesh(trunkGeom, trunkMat);
            trunk.position.y = 0.8;
            trunk.castShadow = true;
            trunk.receiveShadow = true;
            group.add(trunk);

            const leafGeom1 = new THREE.SphereGeometry(1.4, 8, 8);
            const leaf1 = new THREE.Mesh(leafGeom1, leafMat);
            leaf1.position.y = 2.0;
            leaf1.castShadow = true;
            leaf1.receiveShadow = true;
            group.add(leaf1);

            const leafGeom2 = new THREE.SphereGeometry(1.0, 8, 8);
            const leaf2 = new THREE.Mesh(leafGeom2, leafMat);
            leaf2.position.y = 2.8;
            leaf2.castShadow = true;
            leaf2.receiveShadow = true;
            group.add(leaf2);
        }

        renderSystem.scene.add(group);
        renderSystem.trees.push(group);
        return group;
    }
};
