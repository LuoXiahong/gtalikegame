import { describe, it, expect, vi, afterEach } from 'vitest';
import { CityBuilder3D, LAMP_EDGE_INSET, LAMP_EDGE_SPACING } from './CityBuilder3D.js';
import { FacadeGenerator } from './FacadeGenerator.js';
import { WorldMetrics } from '../world/WorldMetrics.js';
import { WorldGrid } from '../world/WorldGrid.js';
import { EventBus } from '../core/EventBus.js';

function mockRenderSystem() {
    return {
        scene: { add: vi.fn() },
        sidewalks: [],
        buildingZones: [],
        buildings: [],
        trees: [],
        billboards: [],
        props: [],
        lampLightSpots: [],
        contactShadowTexture: {}
    };
}

function lampFingerprint(renderSystem) {
    return renderSystem.props
        .filter(p => p.userData.propType === 'lampPost')
        .map(p => `${p.position.x.toFixed(3)},${p.position.z.toFixed(3)},${p.rotation.y.toFixed(4)}`)
        .sort()
        .join('|');
}

function treeFingerprint(renderSystem) {
    return renderSystem.trees
        .map(t => `${t.userData.treeType}:${t.position.x.toFixed(3)},${t.position.z.toFixed(3)},${t.rotation.y.toFixed(4)}`)
        .sort()
        .join('|');
}

function propFingerprint(renderSystem) {
    return renderSystem.props
        .filter(p => p.userData.propType !== 'lampPost')
        .map(p => `${p.userData.propType}:${p.position.x.toFixed(3)},${p.position.z.toFixed(3)},${p.rotation.y.toFixed(4)}`)
        .sort()
        .join('|');
}

describe('CityBuilder3D', () => {
    afterEach(() => {
        EventBus.emit('weather_change', 'clear');
    });

    it('should build city elements and populate collections', () => {
        const mock = mockRenderSystem();
        CityBuilder3D.buildCity(mock);
        expect(mock.sidewalks.length).toBeGreaterThan(0);
        expect(mock.buildings.length).toBeGreaterThan(0);
        expect(mock.trees.length).toBeGreaterThan(0);
        expect(mock.props.length).toBeGreaterThan(0);
        expect(mock.lampLightSpots.length).toBeGreaterThan(0);
    });

    it('should create face materials with emissive maps', () => {
        FacadeGenerator.init();
        const mat = CityBuilder3D.createFaceMaterial('residential', 10, 20, 0x9c4a3a);
        expect(mat.map).toBeDefined();
        expect(mat.emissiveMap).toBeDefined();
        expect(mat.emissiveIntensity).toBeCloseTo(0.4);
        expect(mat.emissiveMap).not.toBe(mat.map);
    });

    it('collectLampSpots is deterministic and includes block corners', () => {
        const SF = WorldMetrics.SCALE_FACTOR;
        const a = CityBuilder3D.collectLampSpots(SF);
        const b = CityBuilder3D.collectLampSpots(SF);
        expect(a.length).toBe(b.length);
        expect(a.length).toBeGreaterThan(0);
        expect(a).toEqual(b);

        // 9 blocks × 8 unique edge samples (4 corners + 4 mids at spacing 220)
        const edgeLen = WorldGrid.BLOCK_SIZE - 2 * LAMP_EDGE_INSET;
        const steps = Math.max(1, Math.round(edgeLen / LAMP_EDGE_SPACING));
        const perBlock = 4 * steps; // 4 edges × interior steps; corners shared → 4*(steps+1)-4 = 4*steps
        expect(a.length).toBe(WorldGrid.GRID_ROWS * WorldGrid.GRID_COLS * perBlock);

        const b00 = WorldGrid.getBlockBounds(0, 0);
        const cornerX = (b00.x + LAMP_EDGE_INSET) * SF;
        const cornerZ = (b00.y + LAMP_EDGE_INSET) * SF;
        expect(a.some(s => Math.abs(s.x - cornerX) < 1e-6 && Math.abs(s.z - cornerZ) < 1e-6)).toBe(true);
    });

    it('places the same lamp posts across rebuilds', () => {
        const a = mockRenderSystem();
        const b = mockRenderSystem();
        CityBuilder3D.placeSidewalkProps(a);
        CityBuilder3D.placeSidewalkProps(b);

        const lampsA = a.props.filter(p => p.userData.propType === 'lampPost');
        const lampsB = b.props.filter(p => p.userData.propType === 'lampPost');
        expect(lampsA.length).toBe(lampsB.length);
        // Every lamp post contributes exactly one candidate light position
        expect(lampsA.length).toBe(a.lampLightSpots.length);
        expect(lampFingerprint(a)).toBe(lampFingerprint(b));
    });

    it('places the same trees and street props across rebuilds', () => {
        const a = mockRenderSystem();
        const b = mockRenderSystem();
        CityBuilder3D.buildCity(a);
        CityBuilder3D.buildCity(b);

        expect(a.trees.length).toBeGreaterThan(0);
        expect(treeFingerprint(a)).toBe(treeFingerprint(b));
        expect(propFingerprint(a)).toBe(propFingerprint(b));

        const types = new Set(a.props.map(p => p.userData.propType));
        expect(types.has('bench')).toBe(true);
        expect(types.has('trashCan')).toBe(true);
        expect(types.has('hydrant')).toBe(true);

        const plantTypes = new Set(a.trees.map(t => t.userData.treeType));
        expect(plantTypes.size).toBeGreaterThanOrEqual(4);
    });

    it('keeps trees clear of lamp posts', () => {
        const mock = mockRenderSystem();
        CityBuilder3D.buildCity(mock);
        const SF = WorldMetrics.SCALE_FACTOR;
        const lampSpots = CityBuilder3D.collectLampSpots(SF);
        const minDist = Math.min(
            ...mock.trees.map(tree =>
                Math.min(...lampSpots.map(l => Math.hypot(tree.position.x - l.x, tree.position.z - l.z)))
            )
        );
        expect(minDist).toBeGreaterThanOrEqual(2.5);
    });

    it('keeps street props clear of lamp posts', () => {
        const mock = mockRenderSystem();
        CityBuilder3D.placeSidewalkProps(mock);
        const SF = WorldMetrics.SCALE_FACTOR;
        const lampSpots = CityBuilder3D.collectLampSpots(SF);
        const others = mock.props.filter(p => p.userData.propType !== 'lampPost');
        expect(others.length).toBeGreaterThan(0);
        const minDist = Math.min(
            ...others.map(prop =>
                Math.min(...lampSpots.map(l => Math.hypot(prop.position.x - l.x, prop.position.z - l.z)))
            )
        );
        expect(minDist).toBeGreaterThanOrEqual(2.5);
    });

    it('keeps building ground shadow centered on clear weather and skews it on rain', () => {
        const mock = mockRenderSystem();
        const group = CityBuilder3D.createBuilding(mock, {
            type: 'residential', x: 0, z: 0, height: 20, width: 10, depth: 10
        });
        const shadow = group.children.find(c => c.name === 'contactShadow');
        expect(shadow).toBeDefined();

        const clearX = shadow.position.x;
        const clearScaleX = shadow.scale.x;
        expect(clearX).toBeCloseTo(0);
        expect(clearScaleX).toBeCloseTo(1);

        EventBus.emit('weather_change', 'rain');
        expect(shadow.position.x).not.toBeCloseTo(clearX);
        expect(shadow.scale.x).toBeGreaterThan(clearScaleX);

        EventBus.emit('weather_change', 'clear');
        expect(shadow.position.x).toBeCloseTo(clearX);
        expect(shadow.scale.x).toBeCloseTo(clearScaleX);
    });
});
