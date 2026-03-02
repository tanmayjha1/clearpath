/**
 * Supabase Client for ClearPath
 *
 * Singleton client for all Supabase operations.
 * Handles dispatches + active_vehicles table CRUD and real-time subscriptions.
 */

import { createClient } from '@supabase/supabase-js';
import { Alert } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Validate URL before creating client — prevents crash with placeholder values
function isValidUrl(str) {
    try {
        const url = new URL(str);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

const SUPABASE_READY = isValidUrl(SUPABASE_URL) && SUPABASE_ANON_KEY.length > 20;

if (!SUPABASE_READY) {
    console.warn(
        'Supabase not configured. Add valid EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env. App will work in offline/demo mode.'
    );
}

// Singleton Supabase client — only initialized with valid credentials
export const supabase = SUPABASE_READY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        realtime: { params: { eventsPerSecond: 10 } },
    })
    : null;

// ═══════════════════════════════════════════════════════════════════
// Dispatches table operations
// ═══════════════════════════════════════════════════════════════════

/**
 * Insert a new active dispatch row
 * @param {Object} config - Values from AMBULANCE_CONFIG or selectedRoute
 * @returns {Object|null} The inserted row, or null on error
 */
export async function createDispatch(config) {
    if (!supabase) { console.warn('Supabase not configured, skipping dispatch insert'); return null; }
    try {
        const { data, error } = await supabase
            .from('dispatches')
            .insert({
                status: 'active',
                origin_label: config.origin.label,
                origin_lat: config.origin.lat,
                origin_lng: config.origin.lng,
                destination_label: config.destination.label,
                destination_lat: config.destination.lat,
                destination_lng: config.destination.lng,
                trip_duration_seconds: config.tripDurationSeconds,
            })
            .select()
            .single();

        if (error) {
            console.error('Supabase insert error:', error.message);
            showConnectionError();
            return null;
        }

        return data;
    } catch (err) {
        console.error('Supabase createDispatch error:', err);
        showConnectionError();
        return null;
    }
}

/**
 * Update a dispatch row to 'resolved'
 * @param {string} dispatchId - UUID of the dispatch row
 * @returns {boolean} True if successful
 */
export async function resolveDispatch(dispatchId) {
    if (!supabase) { console.warn('Supabase not configured, skipping resolve'); return false; }
    try {
        const { error } = await supabase
            .from('dispatches')
            .update({ status: 'resolved' })
            .eq('id', dispatchId);

        if (error) {
            console.error('Supabase resolve error:', error.message);
            showConnectionError();
            return false;
        }

        return true;
    } catch (err) {
        console.error('Supabase resolveDispatch error:', err);
        showConnectionError();
        return false;
    }
}

/**
 * Subscribe to real-time changes on the dispatches table
 * @param {Function} onInsert - Called when a new dispatch is inserted
 * @param {Function} onUpdate - Called when a dispatch is updated
 * @returns {Object} The channel subscription (call .unsubscribe() to clean up)
 */
export function subscribeToDispatches(onInsert, onUpdate) {
    if (!supabase) { console.warn('Supabase not configured, skipping real-time subscription'); return null; }

    console.log('Real-time: setting up subscription to dispatches table...');

    const channel = supabase
        .channel('dispatches-realtime')
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'dispatches' },
            (payload) => {
                console.log('✅ Dispatch INSERT received:', JSON.stringify(payload.new, null, 2));
                onInsert(payload.new);
            }
        )
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'dispatches' },
            (payload) => {
                console.log('✅ Dispatch UPDATE received:', payload.new.id, 'status:', payload.new.status);
                onUpdate(payload.new);
            }
        )
        .subscribe((status, err) => {
            console.log('Real-time subscription status:', status);
            if (status === 'SUBSCRIBED') {
                console.log('✅ Real-time: successfully subscribed to dispatches');
            } else if (status === 'TIMED_OUT') {
                console.error('❌ Real-time: subscription timed out — check that the dispatches table has Realtime enabled in Supabase dashboard');
            } else if (status === 'CLOSED') {
                console.warn('⚠️ Real-time: channel closed');
            } else if (status === 'CHANNEL_ERROR') {
                console.error('❌ Real-time: channel error:', err?.message || 'unknown');
                console.error('Make sure Realtime is enabled for the dispatches table in Supabase Dashboard → Database → Replication');
                showConnectionError();
            }
        });

    return channel;
}

/**
 * Fetch the currently active dispatch (if any)
 * @returns {Object|null} The active dispatch row, or null
 */
export async function getActiveDispatch() {
    if (!supabase) return null;
    try {
        const { data, error } = await supabase
            .from('dispatches')
            .select('*')
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error('Supabase getActiveDispatch error:', error.message);
            return null;
        }

        return data;
    } catch (err) {
        console.error('Supabase getActiveDispatch catch:', err);
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════════
// Active Vehicles table operations
// ═══════════════════════════════════════════════════════════════════

/**
 * Bulk insert vehicles into active_vehicles for a dispatch
 * @param {string} dispatchId - UUID of the dispatch
 * @param {Array} cars - Array of { id, lat, lng, onRoute }
 * @returns {boolean} True if successful
 */
export async function insertVehicles(dispatchId, cars) {
    if (!supabase) { console.warn('Supabase not configured, skipping vehicle insert'); return false; }
    try {
        const rows = cars.map((car) => ({
            dispatch_id: dispatchId,
            car_id: car.id,
            lat: car.lat,
            lng: car.lng,
            on_route: car.onRoute || false,
            is_nearest: false,
            has_cleared: false,
        }));

        const { error } = await supabase
            .from('active_vehicles')
            .insert(rows);

        if (error) {
            console.error('Supabase insertVehicles error:', error.message);
            return false;
        }

        console.log(`✅ Inserted ${cars.length} vehicles for dispatch ${dispatchId}`);
        return true;
    } catch (err) {
        console.error('Supabase insertVehicles error:', err);
        return false;
    }
}

/**
 * Bulk update vehicle positions and nearest status
 * Uses upsert-like logic: update each car's row in active_vehicles
 * @param {string} dispatchId - UUID of the dispatch
 * @param {Array} cars - Array of { id, lat, lng, isNearest, onRoute }
 * @returns {boolean} True if successful
 */
export async function updateVehiclePositions(dispatchId, cars) {
    if (!supabase) { console.warn('Supabase not configured, skipping vehicle update'); return false; }
    try {
        // Batch into two calls: one for nearest, one for all others
        const nearestCar = cars.find((c) => c.isNearest);
        const otherCars = cars.filter((c) => !c.isNearest);

        const promises = [];

        // Update nearest car
        if (nearestCar) {
            promises.push(
                supabase
                    .from('active_vehicles')
                    .update({
                        lat: nearestCar.lat,
                        lng: nearestCar.lng,
                        is_nearest: true,
                        on_route: nearestCar.onRoute || false,
                        last_updated: new Date().toISOString(),
                    })
                    .eq('dispatch_id', dispatchId)
                    .eq('car_id', nearestCar.id)
            );
        }

        // Update all other cars in one call per car
        // TODO: optimize to batch update if Supabase supports multi-row conditional updates
        for (const car of otherCars) {
            promises.push(
                supabase
                    .from('active_vehicles')
                    .update({
                        lat: car.lat,
                        lng: car.lng,
                        is_nearest: false,
                        on_route: car.onRoute || false,
                        last_updated: new Date().toISOString(),
                    })
                    .eq('dispatch_id', dispatchId)
                    .eq('car_id', car.id)
            );
        }

        const results = await Promise.all(promises);
        const hasError = results.some((r) => r.error);
        if (hasError) {
            console.error('Supabase updateVehiclePositions: some updates failed');
            return false;
        }

        return true;
    } catch (err) {
        console.error('Supabase updateVehiclePositions error:', err);
        return false;
    }
}

/**
 * Subscribe to real-time changes on active_vehicles for a specific dispatch
 * @param {string} dispatchId - UUID of the dispatch to filter by
 * @param {Function} onUpdate - Called with the updated row on any change
 * @returns {Object} The channel subscription (call .unsubscribe() to clean up)
 */
export function subscribeToVehicles(dispatchId, onUpdate) {
    if (!supabase) { console.warn('Supabase not configured, skipping vehicle subscription'); return null; }

    console.log('Real-time: subscribing to active_vehicles for dispatch', dispatchId);

    const channel = supabase
        .channel(`vehicles-${dispatchId}`)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'active_vehicles',
                filter: `dispatch_id=eq.${dispatchId}`,
            },
            (payload) => {
                onUpdate(payload.new);
            }
        )
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'active_vehicles',
                filter: `dispatch_id=eq.${dispatchId}`,
            },
            (payload) => {
                onUpdate(payload.new);
            }
        )
        .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
                console.log('✅ Real-time: subscribed to active_vehicles for dispatch', dispatchId);
            } else if (status === 'CHANNEL_ERROR') {
                console.error('❌ Real-time: vehicle channel error:', err?.message || 'unknown');
            }
        });

    return channel;
}

/**
 * Mark a specific vehicle as has_cleared = true
 * @param {string} dispatchId - UUID of the dispatch
 * @param {string} carId - The car_id string (e.g. "car_a")
 * @returns {boolean} True if successful
 */
export async function updateVehicleCleared(dispatchId, carId) {
    if (!supabase) { console.warn('Supabase not configured, skipping vehicle cleared update'); return false; }
    try {
        const { error } = await supabase
            .from('active_vehicles')
            .update({ has_cleared: true, last_updated: new Date().toISOString() })
            .eq('dispatch_id', dispatchId)
            .eq('car_id', carId);

        if (error) {
            console.error('Supabase updateVehicleCleared error:', error.message);
            return false;
        }

        console.log(`✅ Vehicle ${carId} marked as cleared for dispatch ${dispatchId}`);
        return true;
    } catch (err) {
        console.error('Supabase updateVehicleCleared error:', err);
        return false;
    }
}

/**
 * Fetch initial state of a vehicle for a specific dispatch
 * @param {string} dispatchId - UUID of the dispatch
 * @param {string} carId - The car_id string
 * @returns {Object|null} The vehicle row, or null
 */
export async function getVehicleState(dispatchId, carId) {
    if (!supabase) return null;
    try {
        const { data, error } = await supabase
            .from('active_vehicles')
            .select('*')
            .eq('dispatch_id', dispatchId)
            .eq('car_id', carId)
            .maybeSingle();

        if (error) {
            console.error('Supabase getVehicleState error:', error.message);
            return null;
        }

        return data;
    } catch (err) {
        console.error('Supabase getVehicleState catch:', err);
        return null;
    }
}


// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

function showConnectionError() {
    Alert.alert(
        'Connection Error',
        'Connection error — please check your internet connection.',
        [{ text: 'OK' }]
    );
}
