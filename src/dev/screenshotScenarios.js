export const SCENARIOS = {
  'street-intersection': {
    entities: [
      { type: 'zebra', x: 0, z: 0 },
      { type: 'road', x: 0, z: -35, l: 70, vertical: true },
      { type: 'road', x: 0, z: 35, l: 70, vertical: true },
      { type: 'road', x: -35, z: 0, l: 70, vertical: false },
      { type: 'road', x: 35, z: 0, l: 70, vertical: false },
      
      { type: 'sidewalk', x: -30, z: -30, w: 50, d: 50 },
      { type: 'sidewalk', x: 30, z: -30, w: 50, d: 50 },
      { type: 'sidewalk', x: -30, z: 30, w: 50, d: 50 },
      { type: 'sidewalk', x: 30, z: 30, w: 50, d: 50 },
      
      { type: 'buildingZone', x: -30, z: -30, w: 30, d: 30 },
      { type: 'buildingZone', x: 30, z: -30, w: 30, d: 30 },
      { type: 'buildingZone', x: -30, z: 30, w: 30, d: 30 },
      { type: 'buildingZone', x: 30, z: 30, w: 30, d: 30 },
      
      // Main character (player) waiting to cross
      { type: 'player', x: -5.5, z: 2, rotY: Math.PI / 2 },
      
      // Vehicles
      { type: 'car', archetype: 'sedan_30s', x: 2.5, z: -8, rotY: 0, color: '#8a3a2e' },
      { type: 'car', archetype: 'panel_van_30s', x: -2.5, z: 12, rotY: Math.PI, color: '#444444' },
      { type: 'car', archetype: 'coupe_30s', x: 15, z: 2.5, rotY: -Math.PI/2, color: '#2c3e50' },
      
      // Pedestrians
      { type: 'npc', x: -10, z: -6, color: '#5a5a5a' },
      { type: 'npc', x: 8, z: 8, color: '#3d3d3d' },
      { type: 'npc', x: 14, z: -12, color: '#4a3728' },
      { type: 'npc', x: -12, z: 15, color: '#2c3e50' },

      // Props and trees
      { type: 'tree', size: 'tree', x: -12, z: -10 },
      { type: 'tree', size: 'shrub', x: 15, z: 15 },
      { type: 'prop', propType: 'lampPost', x: -7, z: -7, rot: 0 },
      { type: 'prop', propType: 'lampPost', x: 7, z: 7, rot: Math.PI },
      { type: 'prop', propType: 'fireHydrant', x: -8, z: 12, rot: 0 },
      { type: 'prop', propType: 'bench', x: 12, z: -8, rot: Math.PI / 2 },
      
      // Buildings (placed exactly on building zones)
      { type: 'building', archetype: 'residential', x: 30, z: 30, w: 18, d: 12, h: 22 },
      { type: 'building', archetype: 'shop', x: -30, z: -30, w: 16, d: 16, h: 16 },
      { type: 'building', archetype: 'skyscraper', x: 30, z: -30, w: 14, d: 14, h: 35 },
    ],
    camera: { x: 0, y: 22, z: 14, targetX: 0, targetZ: 0, zoom: 1.2 },
    retroPreset: 'classic',
    timeOfDay: 'dusk',
  },
  'city-overview': {
    entities: [],
    camera: { x: 0, y: 35, z: 25, targetX: 0, targetZ: 0, zoom: 0.8 },
    retroPreset: 'noir',
    timeOfDay: 'night',
  },
  'traffic-block': {
    entities: [],
    camera: { targetX: 1150, targetZ: 1150, zoom: 1.5 },
    retroPreset: 'classic',
    timeOfDay: 'day',
  }
};
