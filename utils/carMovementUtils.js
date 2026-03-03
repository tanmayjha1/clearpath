/**
 * Car Movement Utilities for ClearPath
 *
 * Handles generating civilian cars near a route, waypoint generation,
 * car movement simulation, and nearest-car detection.
 */

// ─── Haversine distance (meters) ───────────────────────────────────────
export function haversineDistance(p1, p2) {
    const R = 6371000;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(p2.latitude - p1.latitude);
    const dLng = toRad(p2.longitude - p1.longitude);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(p1.latitude)) *
        Math.cos(toRad(p2.latitude)) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Check if a point is within thresholdMeters of any route segment ──
export function isNearRoute(point, routePoints, thresholdMeters = 300) {
    for (let i = 0; i < routePoints.length - 1; i++) {
        const dist = distanceToSegment(point, routePoints[i], routePoints[i + 1]);
        if (dist <= thresholdMeters) return true;
    }
    return false;
}

function distanceToSegment(point, segA, segB) {
    const dx = segB.latitude - segA.latitude;
    const dy = segB.longitude - segA.longitude;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return haversineDistance(point, segA);

    let t =
        ((point.latitude - segA.latitude) * dx +
            (point.longitude - segA.longitude) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    return haversineDistance(point, {
        latitude: segA.latitude + t * dx,
        longitude: segA.longitude + t * dy,
    });
}

// ─── Random offset in degrees for a given distance in meters ──────────
function randomOffsetDeg(maxMeters) {
    // ~111,320 meters per degree of latitude at equator
    const maxDeg = maxMeters / 111320;
    return (Math.random() - 0.5) * 2 * maxDeg;
}

// ─── Generate waypoints near a center point ───────────────────────────
// For on-route cars, waypoints stay close to route; for off-route, normal spread
function generateWaypoints(center, count = 5, spreadMeters = 200) {
    const waypoints = [{ ...center }];
    let current = { ...center };
    for (let i = 1; i < count; i++) {
        current = {
            latitude: current.latitude + randomOffsetDeg(spreadMeters),
            longitude: current.longitude + randomOffsetDeg(spreadMeters),
        };
        waypoints.push(current);
    }
    return waypoints;
}

/**
 * Generate waypoints that follow along the route (for car_a)
 * Places waypoints on actual route points so the car stays on the road
 */
function generateOnRouteWaypoints(routePoints, startRouteIdx, count = 5) {
    const waypoints = [];
    const step = Math.max(1, Math.floor(routePoints.length / (count * 2)));
    for (let i = 0; i < count; i++) {
        const idx = Math.min(startRouteIdx + i * step, routePoints.length - 1);
        // Tiny offset so the car doesn't sit exactly on the polyline
        waypoints.push({
            latitude: routePoints[idx].latitude + randomOffsetDeg(30),
            longitude: routePoints[idx].longitude + randomOffsetDeg(30),
        });
    }
    return waypoints;
}

/**
 * Generate civilian cars near a route polyline
 * CAR_A is ALWAYS placed directly on the route (ahead of midpoint, heading toward destination)
 * Other cars are placed randomly within 800m of the route
 * @param {Array} routePoints - Array of { latitude, longitude }
 * @param {number} count - Number of cars to generate (default 5)
 * @returns {Array} Array of car objects:
 *   { id, name, coordinate, speed, waypoints, waypointIndex, onRoute }
 */
export function generateCarsNearRoute(routePoints, count = 5) {
    if (!routePoints || routePoints.length === 0) return [];

    const CAR_IDS = ['car_a', 'car_b', 'car_c', 'car_d', 'car_e'];
    const CAR_NAMES = ['Car A', 'Car B', 'Car C', 'Car D', 'Car E'];
    const cars = [];

    for (let i = 0; i < count; i++) {
        const isCarA = i === 0;

        if (isCarA) {
            // ── Car A: ALWAYS on the route, placed ~40-60% along the route ──
            // This ensures it's ahead of the ambulance start and in the path
            const routeIdx = Math.floor(routePoints.length * (0.4 + Math.random() * 0.2));
            const routePoint = routePoints[Math.min(routeIdx, routePoints.length - 1)];

            // Very small offset (within 50m) so it stays on route
            const startPos = {
                latitude: routePoint.latitude + randomOffsetDeg(50),
                longitude: routePoint.longitude + randomOffsetDeg(50),
            };

            const speedKmh = 35 + Math.random() * 15; // 35-50 km/h

            // Waypoints that follow the route
            const waypoints = generateOnRouteWaypoints(routePoints, routeIdx, 5);

            cars.push({
                id: 'car_a',
                name: 'Car A',
                coordinate: { ...startPos },
                speed: speedKmh,
                waypoints,
                waypointIndex: 0,
                onRoute: true, // Always true for car_a
            });
        } else {
            // ── Other cars: random placement near route ──
            const routeIdx = Math.floor(Math.random() * routePoints.length);
            const basePoint = routePoints[routeIdx];

            const offsetLat = randomOffsetDeg(800);
            const offsetLng = randomOffsetDeg(800);
            const startPos = {
                latitude: basePoint.latitude + offsetLat,
                longitude: basePoint.longitude + offsetLng,
            };

            const speedKmh = 30 + Math.random() * 30;
            const waypoints = generateWaypoints(startPos, 5, 150);
            const onRoute = isNearRoute(startPos, routePoints, 300);

            cars.push({
                id: CAR_IDS[i] || `car_${i}`,
                name: CAR_NAMES[i] || `Car ${i + 1}`,
                coordinate: { ...startPos },
                speed: speedKmh,
                waypoints,
                waypointIndex: 0,
                onRoute,
            });
        }
    }

    return cars;
}

/**
 * Advance a car to its next waypoint position
 * Returns the updated coordinate and waypointIndex
 * @param {Object} car - Car object with waypoints and waypointIndex
 * @returns {Object} { coordinate, waypointIndex }
 */
export function advanceCarToNextWaypoint(car) {
    const nextIdx = (car.waypointIndex + 1) % car.waypoints.length;
    return {
        coordinate: { ...car.waypoints[nextIdx] },
        waypointIndex: nextIdx,
    };
}

/**
 * Calculate movement interval in ms based on car speed
 * @param {number} speedKmh - Car speed in km/h
 * @param {number} waypointDistanceMeters - Approx distance between waypoints
 * @returns {number} Interval in milliseconds
 */
export function getMovementIntervalMs(speedKmh, waypointDistanceMeters = 150) {
    const speedMs = (speedKmh * 1000) / 3600; // km/h → m/s
    return (waypointDistanceMeters / speedMs) * 1000;
}

// TODO: future enhancement — add function for advanced route-based car prioritization if needed
