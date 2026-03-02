/**
 * Google Maps API service for ClearPath
 * Handles Directions API calls and polyline decoding
 */

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || '';

/**
 * Decode a Google Maps encoded polyline string into an array of coordinates
 * @param {string} encoded - Encoded polyline string from Directions API
 * @returns {Array} Array of { latitude, longitude }
 */
export function decodePolyline(encoded) {
    const points = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
        let shift = 0;
        let result = 0;
        let byte;

        // Decode latitude
        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);
        const dlat = result & 1 ? ~(result >> 1) : result >> 1;
        lat += dlat;

        // Decode longitude
        shift = 0;
        result = 0;
        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);
        const dlng = result & 1 ? ~(result >> 1) : result >> 1;
        lng += dlng;

        points.push({
            latitude: lat / 1e5,
            longitude: lng / 1e5,
        });
    }

    return points;
}

/**
 * Fetch route from Google Directions API
 * @param {Object} origin - { latitude, longitude }
 * @param {Object} destination - { latitude, longitude }
 * @returns {Object} { points: Array, duration: number, distance: string } or null on failure
 */
export async function getDirectionsRoute(origin, destination) {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&mode=driving&key=${API_KEY}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.status !== 'OK' || !data.routes || data.routes.length === 0) {
            console.warn('Directions API returned no routes:', data.status);
            return null;
        }

        const route = data.routes[0];
        const leg = route.legs[0];

        // Decode the overview polyline
        const points = decodePolyline(route.overview_polyline.points);

        return {
            points,
            duration: leg.duration.value, // seconds
            durationText: leg.duration.text,
            distance: leg.distance.text,
        };
    } catch (error) {
        console.error('Directions API error:', error);
        return null;
    }
}

/**
 * Generate a fallback straight-line route when Directions API fails
 * @param {Object} origin - { latitude, longitude }
 * @param {Object} destination - { latitude, longitude }
 * @param {number} numPoints - Number of interpolation points
 * @returns {Object} { points, duration, durationText, distance }
 */
export function generateFallbackRoute(origin, destination, numPoints = 300) {
    const points = [];
    for (let i = 0; i <= numPoints; i++) {
        const fraction = i / numPoints;
        points.push({
            latitude: origin.latitude + (destination.latitude - origin.latitude) * fraction,
            longitude: origin.longitude + (destination.longitude - origin.longitude) * fraction,
        });
    }

    return {
        points,
        duration: 300,
        durationText: '~5 min (demo)',
        distance: '~6 km (estimated)',
    };
}

/**
 * Check if a point is within a threshold distance of a polyline route
 * Equivalent to Google Maps geometry isLocationOnEdge()
 * @param {Object} point - { latitude, longitude }
 * @param {Array} routePoints - Array of { latitude, longitude }
 * @param {number} thresholdMeters - Tolerance in meters (default: 300)
 * @returns {boolean}
 */
export function isLocationOnEdge(point, routePoints, thresholdMeters = 300) {
    for (let i = 0; i < routePoints.length - 1; i++) {
        const dist = pointToSegmentDistance(
            point,
            routePoints[i],
            routePoints[i + 1]
        );
        if (dist <= thresholdMeters) {
            return true;
        }
    }
    return false;
}

/**
 * Haversine distance between two points in meters
 */
function haversineDistance(p1, p2) {
    const R = 6371000;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(p2.latitude - p1.latitude);
    const dLng = toRad(p2.longitude - p1.longitude);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(p1.latitude)) * Math.cos(toRad(p2.latitude)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Minimum distance from a point to a line segment in meters
 */
function pointToSegmentDistance(point, segA, segB) {
    const dx = segB.latitude - segA.latitude;
    const dy = segB.longitude - segA.longitude;
    const lenSq = dx * dx + dy * dy;

    if (lenSq === 0) return haversineDistance(point, segA);

    let t =
        ((point.latitude - segA.latitude) * dx +
            (point.longitude - segA.longitude) * dy) /
        lenSq;
    t = Math.max(0, Math.min(1, t));

    return haversineDistance(point, {
        latitude: segA.latitude + t * dx,
        longitude: segA.longitude + t * dy,
    });
}
