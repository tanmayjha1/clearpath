/**
 * Route utility functions for ClearPath
 * Handles distance calculations, route interpolation, and near-route detection
 */

/**
 * Calculate the Haversine distance between two lat/lng points
 * @param {Object} p1 - { latitude, longitude }
 * @param {Object} p2 - { latitude, longitude }
 * @returns {number} Distance in meters
 */
export function haversineDistance(p1, p2) {
    const R = 6371000; // Earth's radius in meters
    const toRad = (deg) => (deg * Math.PI) / 180;

    const dLat = toRad(p2.latitude - p1.latitude);
    const dLng = toRad(p2.longitude - p1.longitude);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(p1.latitude)) *
        Math.cos(toRad(p2.latitude)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Interpolate between two positions by a fraction (0 to 1)
 * @param {Object} start - { latitude, longitude }
 * @param {Object} end - { latitude, longitude }
 * @param {number} fraction - 0.0 (at start) to 1.0 (at end)
 * @returns {Object} Interpolated { latitude, longitude }
 */
export function interpolatePosition(start, end, fraction) {
    const clampedFraction = Math.min(1, Math.max(0, fraction));
    return {
        latitude: start.latitude + (end.latitude - start.latitude) * clampedFraction,
        longitude: start.longitude + (end.longitude - start.longitude) * clampedFraction,
    };
}

/**
 * Generate an array of route points between start and end
 * @param {Object} start - { latitude, longitude }
 * @param {Object} end - { latitude, longitude }
 * @param {number} numPoints - Number of points to generate
 * @returns {Array} Array of { latitude, longitude } points
 */
export function generateRoutePoints(start, end, numPoints = 30) {
    const points = [];
    for (let i = 0; i <= numPoints; i++) {
        points.push(interpolatePosition(start, end, i / numPoints));
    }
    return points;
}

/**
 * Calculate the minimum distance from a point to a line segment
 * Uses projection to find the closest point on the segment
 * @param {Object} point - { latitude, longitude }
 * @param {Object} segA - { latitude, longitude } segment start
 * @param {Object} segB - { latitude, longitude } segment end
 * @returns {number} Distance in meters
 */
export function distanceFromPointToSegment(point, segA, segB) {
    const dx = segB.latitude - segA.latitude;
    const dy = segB.longitude - segA.longitude;
    const lenSq = dx * dx + dy * dy;

    if (lenSq === 0) {
        // segA and segB are the same point
        return haversineDistance(point, segA);
    }

    // Project point onto the line segment, clamped to [0, 1]
    let t =
        ((point.latitude - segA.latitude) * dx +
            (point.longitude - segA.longitude) * dy) /
        lenSq;
    t = Math.max(0, Math.min(1, t));

    const projection = {
        latitude: segA.latitude + t * dx,
        longitude: segA.longitude + t * dy,
    };

    return haversineDistance(point, projection);
}

/**
 * Check if a point is within a threshold distance of any segment on the route
 * @param {Object} point - { latitude, longitude }
 * @param {Array} routePoints - Array of { latitude, longitude }
 * @param {number} thresholdMeters - Distance threshold in meters (default: 300)
 * @returns {boolean} True if point is within threshold of the route
 */
export function isNearRoute(point, routePoints, thresholdMeters = 300) {
    for (let i = 0; i < routePoints.length - 1; i++) {
        const distance = distanceFromPointToSegment(
            point,
            routePoints[i],
            routePoints[i + 1]
        );
        if (distance <= thresholdMeters) {
            return true;
        }
    }
    return false;
}

/**
 * Determine which civilian vehicles are near the ambulance route
 * @param {Array} vehicles - Array of { id, name, coordinate: { latitude, longitude } }
 * @param {Array} routePoints - Array of { latitude, longitude }
 * @param {number} thresholdMeters - Distance threshold (default: 300)
 * @returns {Array} Array of vehicle IDs that are near the route
 */
export function getVehiclesNearRoute(vehicles, routePoints, thresholdMeters = 300) {
    return vehicles
        .filter((vehicle) => isNearRoute(vehicle.coordinate, routePoints, thresholdMeters))
        .map((vehicle) => vehicle.id);
}

// TODO: [Step 3] Add function to generate ChatGPT API alert messages
// TODO: [Step 3] Add function to calculate optimal detour suggestions
// TODO: [Step 3] Add function to estimate ambulance ETA based on route distance
