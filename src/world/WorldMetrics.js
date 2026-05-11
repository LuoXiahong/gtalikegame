/**
 * WORLD: WorldMetrics
 * Defines physical constants and scale multipliers for the game world.
 * Convention: 1 unit in Three.js = 1 meter in the physical world (1u = 1m).
 * Transition factor from 2D pixel space to 3D space: SCALE_FACTOR = 0.1.
 */

export const WorldMetrics = {
    // Multiplier for converting 2D pixel coordinates to 3D units (100px in 2D = 10m in 3D)
    SCALE_FACTOR: 0.1,

    // Sidewalks & curbs
    SIDEWALK_HEIGHT: 0.15, // m (height of the curb/sidewalk)
    
    // Buildings & levels
    FLOOR_HEIGHT: 3.0,     // m (height of a single building level)
    DOOR_HEIGHT: 2.1,      // m (height of ground-floor doors)

    // Streets & roads
    LANE_WIDTH: 3.5,       // m (width of a single traffic lane)

    // Pedestrians (NPCs)
    NPC_HEIGHT: 1.8,       // m (character height)
    NPC_WIDTH: 0.6,        // m (shoulder width)
    NPC_DEPTH: 0.4,        // m (depth thickness)

    // Vehicles - Type A (Sedan)
    SEDAN: {
        length: 4.5,       // m
        width: 1.8,        // m
        height: 1.4,       // m
        chassisHeightRatio: 0.3 // 30% of height is the lower chassis
    },

    // Vehicles - Type B (Van)
    VAN: {
        length: 5.5,       // m
        width: 2.2,        // m
        height: 1.8,       // m
        chassisHeightRatio: 0.3 // 30% of height is the lower chassis
    }
};
