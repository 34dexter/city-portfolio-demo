// City grid. World units are roughly meters. The car is ~2.6 long.
export const ROAD_HALF_WIDTH = 5
export const ROADS = [ -125, -75, -25, 25, 75, 125 ]
export const BLOCK_CENTERS = [ -100, -50, 0, 50, 100 ]
export const BLOCK_HALF = 20 // usable half size between roads
export const CITY_HALF = 131 // edge of the land

// The 3x3 inner blocks host the portfolio districts, the outer ring is generic city.
export const AREA_BLOCKS = {
    landing: [ 0, 0 ],
    skills: [ -50, -50 ],
    internship: [ 0, -50 ],
    hudl: [ 50, -50 ],
    education: [ -50, 0 ],
    eventPlanner: [ 50, 0 ],
    boneCancer: [ -50, 50 ],
    solarTracker: [ 0, 50 ],
    contact: [ 50, 50 ],
}

// Outer blocks that become parks instead of buildings
export const PARK_BLOCKS = [ '-100,0', '100,50', '0,100', '50,-100' ]

// The camera looks from +X+Z toward -X-Z. Things that should face the viewer use this rotation.
export const FACE_CAMERA_Y = Math.PI / 4
