/**
 * Ambulance Trip Configuration — Single Source of Truth
 *
 * This file contains ALL configurable trip details for ClearPath.
 * When trip details change, ONLY this file needs to be edited.
 *
 * TODO: Replace this entire config with a user-facing location
 * selector screen in a future step. The driver should be able to:
 * 1. Select origin from a list of SG fire stations / ambulance depots
 * 2. Select destination from a list of SG hospitals
 * 3. See the route preview before confirming dispatch
 * All AMBULANCE_CONFIG values below will be populated dynamically
 * from that selector instead of being hardcoded here.
 */

export const AMBULANCE_CONFIG = {
    // ─── Origin (ambulance start / station location) ────────────────────
    // TODO: replace with dynamic selection from fire station list
    origin: {
        label: 'Clementi Fire Station',
        lat: 1.3000,
        lng: 103.8000,
    },

    // ─── Destination hospital ───────────────────────────────────────────
    // TODO: replace with dynamic selection from hospital list
    destination: {
        label: 'Singapore General Hospital',
        lat: 1.2796,
        lng: 103.8353,
        shortName: 'SGH',
    },

    // ─── Trip duration in seconds (for animation) ──────────────────────
    // Controls how long the ambulance marker takes to travel the route
    // TODO: replace with real Google Directions API duration later
    tripDurationSeconds: 180,

    // ─── Proximity threshold (meters) ──────────────────────────────────
    // How close a car must be to the route polyline to be considered affected
    proximityThreshold: 300,

    // ─── Map zoom level ────────────────────────────────────────────────
    // Used for initial map region; higher = more zoomed in
    // TODO: adjust after testing on device to get proper road-level zoom
    mapZoomLevel: 15,

    // ─── Map camera padding when fitting route polyline ────────────────
    // Passed to fitToCoordinates() to ensure the route is fully visible
    // TODO: fine-tune after seeing real route on device
    mapPadding: {
        top: 80,
        right: 40,
        bottom: 80,
        left: 40,
    },
};

// ─── Helper: get origin as {latitude, longitude} for react-native-maps ──
export function getOriginCoord() {
    return {
        latitude: AMBULANCE_CONFIG.origin.lat,
        longitude: AMBULANCE_CONFIG.origin.lng,
    };
}

// ─── Helper: get destination as {latitude, longitude} for react-native-maps ──
export function getDestinationCoord() {
    return {
        latitude: AMBULANCE_CONFIG.destination.lat,
        longitude: AMBULANCE_CONFIG.destination.lng,
    };
}
