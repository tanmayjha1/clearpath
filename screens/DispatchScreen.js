import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDispatch } from '../context/DispatchContext';
import {
    getDirectionsRoute,
    generateFallbackRoute,
    isLocationOnEdge,
} from '../services/googleMapsService';
import {
    AMBULANCE_CONFIG,
    getOriginCoord,
    getDestinationCoord,
} from '../constants/ambulanceConfig';
import {
    createDispatch,
    resolveDispatch,
    insertVehicles,
    updateVehiclePositions,
} from '../services/supabaseClient';
import {
    generateCarsNearRoute,
    advanceCarToNextWaypoint,
    getMovementIntervalMs,
    findNearestCar,
    haversineDistance,
    isNearRoute,
} from '../utils/carMovementUtils';

const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || '';

// Fallback defaults from config
const DEFAULT_ORIGIN = getOriginCoord();
const DEFAULT_DESTINATION = getDestinationCoord();

const INITIAL_REGION = {
    latitude: (DEFAULT_ORIGIN.latitude + DEFAULT_DESTINATION.latitude) / 2,
    longitude: (DEFAULT_ORIGIN.longitude + DEFAULT_DESTINATION.longitude) / 2,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
};

export default function DispatchScreen({ navigation }) {
    const {
        isDispatched,
        activeDispatchId,
        affectedCars,
        countdown,
        triggerDispatch,
        updateAmbulance,
        resetDispatch,
    } = useDispatch();

    // ─── Role guard ─────────────────────────────────────────────────────
    const [deviceRole, setDeviceRole] = useState(null);
    const [roleLoaded, setRoleLoaded] = useState(false);

    useEffect(() => {
        AsyncStorage.getItem('clearpath_role').then((role) => {
            setDeviceRole(role);
            setRoleLoaded(true);
        });
    }, []);

    // ─── Location inputs ───────────────────────────────────────────────
    const [originLocation, setOriginLocation] = useState(null);
    const [destLocation, setDestLocation] = useState(null);
    const originRef = useRef(null);
    const destRef = useRef(null);

    // ─── Route state ───────────────────────────────────────────────────
    const [selectedRoute, setSelectedRoute] = useState(null);
    const [routePoints, setRoutePoints] = useState([]);
    const [routeInfo, setRouteInfo] = useState(null);
    const [routeLoading, setRouteLoading] = useState(false);

    // ─── Ambulance animation ───────────────────────────────────────────
    const [ambulanceIdx, setAmbulanceIdx] = useState(0);
    const [animComplete, setAnimComplete] = useState(false);
    const [loading, setLoading] = useState(false);

    // ─── Civilian cars ─────────────────────────────────────────────────
    const [civilianCars, setCivilianCars] = useState([]);
    const [nearestCarId, setNearestCarId] = useState(null);
    const [clearedCarIds, setClearedCarIds] = useState([]);
    const [flashVisible, setFlashVisible] = useState(true);

    // ─── Refs ───────────────────────────────────────────────────────────
    const mapRef = useRef(null);
    const ambulanceIntervalRef = useRef(null);
    const carIntervalsRef = useRef([]);
    const nearestCheckRef = useRef(null);
    const flashRef = useRef(null);
    const animPointsRef = useRef([]);

    // ─── Get Route ─────────────────────────────────────────────────────
    const handleGetRoute = useCallback(async () => {
        if (!originLocation || !destLocation) return;
        setRouteLoading(true);

        const origin = { latitude: originLocation.lat, longitude: originLocation.lng };
        const destination = { latitude: destLocation.lat, longitude: destLocation.lng };

        let route = await getDirectionsRoute(origin, destination);

        if (!route) {
            console.warn('Directions API failed, using fallback route');
            route = generateFallbackRoute(origin, destination, AMBULANCE_CONFIG.tripDurationSeconds);
            Alert.alert(
                'API Fallback',
                'Using straight-line route. Check your Google Maps API key in .env for real routing.',
                [{ text: 'OK' }]
            );
        }

        setRoutePoints(route.points);
        setRouteInfo(route);

        // Build selectedRoute object
        const routeData = {
            origin: { label: originLocation.label, lat: originLocation.lat, lng: originLocation.lng },
            destination: { label: destLocation.label, lat: destLocation.lat, lng: destLocation.lng },
            routePoints: route.points,
            distance: route.distance,
            duration: route.durationText,
            durationSeconds: route.duration,
        };
        setSelectedRoute(routeData);

        // Auto-zoom map
        if (mapRef.current && route.points.length > 0) {
            mapRef.current.fitToCoordinates(route.points, {
                edgePadding: AMBULANCE_CONFIG.mapPadding,
                animated: true,
            });
        }

        // Generate 5 civilian cars near the route
        const cars = generateCarsNearRoute(route.points, 5);
        setCivilianCars(cars);
        setClearedCarIds([]);
        setNearestCarId(null);

        setRouteLoading(false);
    }, [originLocation, destLocation]);

    // ─── Trigger Dispatch ──────────────────────────────────────────────
    const handleDispatch = useCallback(async () => {
        if (isDispatched || !selectedRoute) return;
        setLoading(true);

        // Subsample route points for animation (1 point per second)
        const totalPoints = selectedRoute.routePoints.length;
        const targetSteps = selectedRoute.durationSeconds || AMBULANCE_CONFIG.tripDurationSeconds;
        const step = Math.max(1, Math.floor(totalPoints / targetSteps));
        const animPoints = [];
        for (let i = 0; i < totalPoints; i += step) {
            animPoints.push(selectedRoute.routePoints[i]);
        }
        if (animPoints[animPoints.length - 1] !== selectedRoute.routePoints[totalPoints - 1]) {
            animPoints.push(selectedRoute.routePoints[totalPoints - 1]);
        }
        animPointsRef.current = animPoints;

        setAmbulanceIdx(0);
        setAnimComplete(false);

        // Determine initially affected cars
        const affected = civilianCars
            .filter((car) =>
                isLocationOnEdge(car.coordinate, selectedRoute.routePoints, AMBULANCE_CONFIG.proximityThreshold)
            )
            .map((car) => car.id);

        // Create Supabase dispatch row
        const dispatchConfig = {
            origin: selectedRoute.origin,
            destination: selectedRoute.destination,
            tripDurationSeconds: selectedRoute.durationSeconds || AMBULANCE_CONFIG.tripDurationSeconds,
        };
        const dispatchRow = await createDispatch(dispatchConfig);

        // Insert vehicles into Supabase
        if (dispatchRow) {
            const vehicleRows = civilianCars.map((car) => ({
                id: car.id,
                lat: car.coordinate.latitude,
                lng: car.coordinate.longitude,
                onRoute: car.onRoute,
            }));
            await insertVehicles(dispatchRow.id, vehicleRows);
        }

        setLoading(false);

        // Trigger shared dispatch context
        triggerDispatch(
            affected,
            animPoints,
            dispatchRow ? dispatchRow.id : null,
            dispatchRow
        );

        // Start ambulance animation — 1 step per second
        let currentIdx = 0;
        ambulanceIntervalRef.current = setInterval(() => {
            currentIdx += 1;
            if (currentIdx >= animPoints.length) {
                clearInterval(ambulanceIntervalRef.current);
                setAnimComplete(true);
                setAmbulanceIdx(animPoints.length - 1);
                updateAmbulance(animPoints.length - 1, 0);
                return;
            }
            setAmbulanceIdx(currentIdx);
            updateAmbulance(currentIdx, animPoints.length - currentIdx);
        }, 1000);

        // Start car movement — each car gets its own interval
        carIntervalsRef.current.forEach(clearInterval);
        carIntervalsRef.current = [];

        civilianCars.forEach((car, idx) => {
            const intervalMs = getMovementIntervalMs(car.speed, 150);
            const carInterval = setInterval(() => {
                setCivilianCars((prevCars) => {
                    const updated = [...prevCars];
                    if (updated[idx]) {
                        const next = advanceCarToNextWaypoint(updated[idx]);
                        updated[idx] = {
                            ...updated[idx],
                            coordinate: next.coordinate,
                            waypointIndex: next.waypointIndex,
                            onRoute: isNearRoute(next.coordinate, selectedRoute.routePoints, 300),
                        };
                    }
                    return updated;
                });
            }, intervalMs);
            carIntervalsRef.current.push(carInterval);
        });

        // Start nearest car detection every 3 seconds
        const currentDispatchId = dispatchRow ? dispatchRow.id : null;
        nearestCheckRef.current = setInterval(() => {
            setAmbulanceIdx((currentAmbIdx) => {
                const ambulancePos = animPointsRef.current[currentAmbIdx] || animPointsRef.current[0];
                if (!ambulancePos) return currentAmbIdx;

                setCivilianCars((currentCars) => {
                    const nearest = findNearestCar(ambulancePos, currentCars, selectedRoute.routePoints);
                    if (nearest) {
                        setNearestCarId(nearest.id);
                    }

                    // Update Supabase with current positions
                    if (currentDispatchId) {
                        const vehicleUpdates = currentCars.map((car) => ({
                            id: car.id,
                            lat: car.coordinate.latitude,
                            lng: car.coordinate.longitude,
                            isNearest: nearest ? car.id === nearest.id : false,
                            onRoute: car.onRoute,
                        }));
                        updateVehiclePositions(currentDispatchId, vehicleUpdates).catch(console.error);
                    }

                    return currentCars;
                });

                return currentAmbIdx;
            });
        }, 3000);
    }, [isDispatched, selectedRoute, civilianCars, triggerDispatch, updateAmbulance]);

    // ─── Resolve Dispatch ──────────────────────────────────────────────
    const handleResolve = useCallback(async () => {
        if (activeDispatchId) {
            await resolveDispatch(activeDispatchId);
        }
        // Clear all intervals
        if (ambulanceIntervalRef.current) clearInterval(ambulanceIntervalRef.current);
        if (nearestCheckRef.current) clearInterval(nearestCheckRef.current);
        if (flashRef.current) clearInterval(flashRef.current);
        carIntervalsRef.current.forEach(clearInterval);
        carIntervalsRef.current = [];

        setRoutePoints([]);
        setAmbulanceIdx(0);
        setAnimComplete(false);
        setRouteInfo(null);
        setSelectedRoute(null);
        setCivilianCars([]);
        setNearestCarId(null);
        setClearedCarIds([]);
        setOriginLocation(null);
        setDestLocation(null);
        animPointsRef.current = [];

        if (originRef.current) originRef.current.clear();
        if (destRef.current) destRef.current.clear();

        resetDispatch();
    }, [activeDispatchId, resetDispatch]);

    // ─── Flash animation for nearest car marker ────────────────────────
    useEffect(() => {
        if (isDispatched && nearestCarId && !animComplete) {
            flashRef.current = setInterval(() => {
                setFlashVisible((prev) => !prev);
            }, 500);
            return () => clearInterval(flashRef.current);
        } else {
            setFlashVisible(true);
        }
    }, [isDispatched, nearestCarId, animComplete]);

    // ─── Cleanup on unmount ────────────────────────────────────────────
    useEffect(() => {
        return () => {
            if (ambulanceIntervalRef.current) clearInterval(ambulanceIntervalRef.current);
            if (nearestCheckRef.current) clearInterval(nearestCheckRef.current);
            if (flashRef.current) clearInterval(flashRef.current);
            carIntervalsRef.current.forEach(clearInterval);
        };
    }, []);

    // ─── Reset Device Role ─────────────────────────────────────────────
    const handleResetRole = useCallback(async () => {
        await AsyncStorage.multiRemove(['clearpath_role', 'clearpath_car_id']);
        if (navigation && navigation.reset) {
            navigation.reset({ index: 0, routes: [{ name: 'DeviceSetup' }] });
        }
    }, [navigation]);

    // ─── Get ambulance position ────────────────────────────────────────
    const { routePoints: contextRoute } = useDispatch();
    const ambulancePos =
        contextRoute.length > 0 && ambulanceIdx < contextRoute.length
            ? contextRoute[ambulanceIdx]
            : originLocation
                ? { latitude: originLocation.lat, longitude: originLocation.lng }
                : DEFAULT_ORIGIN;

    // ─── Car marker color logic ────────────────────────────────────────
    const getCarPinColor = (car) => {
        if (clearedCarIds.includes(car.id)) return 'green';
        if (car.id === nearestCarId && isDispatched && !animComplete) {
            return flashVisible ? 'yellow' : 'orange';
        }
        return 'blue';
    };

    // ─── Role guard render ─────────────────────────────────────────────
    if (roleLoaded && deviceRole === 'driver') {
        return (
            <View style={styles.guardContainer}>
                <Ionicons name="alert-circle" size={64} color="#F59E0B" />
                <Text style={styles.guardTitle}>This device is set as a Driver</Text>
                <Text style={styles.guardSubtext}>
                    You cannot dispatch from a Driver device.
                </Text>
                <TouchableOpacity
                    style={styles.guardButton}
                    onPress={() => navigation && navigation.navigate('Driver')}
                >
                    <Text style={styles.guardButtonText}>Go to Driver Tab</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.resetButton} onPress={handleResetRole}>
                    <Ionicons name="refresh" size={16} color="#94A3B8" />
                    <Text style={styles.resetButtonText}>Reset Device Role</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={INITIAL_REGION}
                showsUserLocation={false}
            >
                {/* Route polyline */}
                {routePoints.length > 0 && (
                    <Polyline
                        coordinates={routePoints}
                        strokeColor="#EF4444"
                        strokeWidth={5}
                    />
                )}

                {/* Ambulance marker */}
                <Marker
                    coordinate={ambulancePos}
                    title="🚑 Ambulance"
                    description={
                        animComplete
                            ? `Arrived at ${selectedRoute?.destination?.label || AMBULANCE_CONFIG.destination.shortName}`
                            : 'En route'
                    }
                    pinColor="red"
                />

                {/* Destination marker */}
                {selectedRoute && (
                    <Marker
                        coordinate={{
                            latitude: selectedRoute.destination.lat,
                            longitude: selectedRoute.destination.lng,
                        }}
                        title={`🏥 ${selectedRoute.destination.label}`}
                        pinColor="green"
                    />
                )}

                {/* Civilian car markers */}
                {civilianCars.map((car) => (
                    <Marker
                        key={car.id}
                        coordinate={car.coordinate}
                        title={`🚗 ${car.name}`}
                        description={
                            car.id === nearestCarId && isDispatched
                                ? '⚠️ ALERT: Clear the route!'
                                : car.onRoute
                                    ? 'On route'
                                    : 'Not on route'
                        }
                        pinColor={getCarPinColor(car)}
                    />
                ))}
            </MapView>

            {/* Header with reset button */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>🚨 ClearPath Demo</Text>
                    <Text style={styles.headerSubtitle}>Dispatch View</Text>
                </View>
                <TouchableOpacity onPress={handleResetRole} style={styles.settingsButton}>
                    <Ionicons name="settings-outline" size={22} color="#94A3B8" />
                </TouchableOpacity>
            </View>

            {/* Location selector — only show before dispatch */}
            {!isDispatched && !selectedRoute && (
                <View style={styles.selectorContainer}>
                    <View style={styles.inputWrapper}>
                        <Text style={styles.inputLabel}>Ambulance From</Text>
                        <GooglePlacesAutocomplete
                            ref={originRef}
                            placeholder={AMBULANCE_CONFIG.origin.label}
                            onPress={(data, details = null) => {
                                if (details) {
                                    setOriginLocation({
                                        label: data.description,
                                        lat: details.geometry.location.lat,
                                        lng: details.geometry.location.lng,
                                    });
                                }
                            }}
                            query={{
                                key: GOOGLE_MAPS_KEY,
                                language: 'en',
                                components: 'country:sg',
                            }}
                            fetchDetails={true}
                            enablePoweredByContainer={false}
                            styles={autocompleteStyles}
                            renderRightButton={() =>
                                originLocation ? (
                                    <TouchableOpacity
                                        onPress={() => {
                                            setOriginLocation(null);
                                            if (originRef.current) originRef.current.clear();
                                        }}
                                        style={styles.clearInputBtn}
                                    >
                                        <Ionicons name="close-circle" size={18} color="#94A3B8" />
                                    </TouchableOpacity>
                                ) : null
                            }
                            textInputProps={{
                                placeholderTextColor: '#64748B',
                            }}
                        />
                    </View>

                    <View style={styles.inputWrapper}>
                        <Text style={styles.inputLabel}>Ambulance To</Text>
                        <GooglePlacesAutocomplete
                            ref={destRef}
                            placeholder={AMBULANCE_CONFIG.destination.label}
                            onPress={(data, details = null) => {
                                if (details) {
                                    setDestLocation({
                                        label: data.description,
                                        lat: details.geometry.location.lat,
                                        lng: details.geometry.location.lng,
                                    });
                                }
                            }}
                            query={{
                                key: GOOGLE_MAPS_KEY,
                                language: 'en',
                                components: 'country:sg',
                            }}
                            fetchDetails={true}
                            enablePoweredByContainer={false}
                            styles={autocompleteStyles}
                            renderRightButton={() =>
                                destLocation ? (
                                    <TouchableOpacity
                                        onPress={() => {
                                            setDestLocation(null);
                                            if (destRef.current) destRef.current.clear();
                                        }}
                                        style={styles.clearInputBtn}
                                    >
                                        <Ionicons name="close-circle" size={18} color="#94A3B8" />
                                    </TouchableOpacity>
                                ) : null
                            }
                            textInputProps={{
                                placeholderTextColor: '#64748B',
                            }}
                        />
                    </View>

                    {/* Get Route button — shown when both locations selected */}
                    {originLocation && destLocation && (
                        <TouchableOpacity
                            style={styles.getRouteButton}
                            onPress={handleGetRoute}
                            disabled={routeLoading}
                            activeOpacity={0.8}
                        >
                            {routeLoading ? (
                                <ActivityIndicator color="#FFF" size="small" />
                            ) : (
                                <>
                                    <Ionicons name="navigate" size={20} color="#FFF" style={{ marginRight: 8 }} />
                                    <Text style={styles.getRouteButtonText}>Get Route</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {/* Route info card — shown after route loaded */}
            {selectedRoute && !isDispatched && (
                <View style={styles.routeInfoCard}>
                    <Ionicons name="navigate" size={16} color="#3B82F6" style={{ marginRight: 8 }} />
                    <Text style={styles.routeInfoText}>
                        🚑 {selectedRoute.origin.label} → {selectedRoute.destination.label}
                    </Text>
                </View>
            )}

            {/* Route details card */}
            {selectedRoute && !isDispatched && (
                <View style={styles.routeDetailsCard}>
                    <Text style={styles.routeDetailText}>
                        📏 {selectedRoute.distance} • ⏱ {selectedRoute.duration}
                    </Text>
                    <Text style={styles.routeDetailSubtext}>
                        {civilianCars.length} civilian vehicles generated near route
                    </Text>
                </View>
            )}

            {/* Dispatch button — only show after route loaded and before dispatch */}
            {selectedRoute && !isDispatched && (
                <View style={styles.dispatchOverlay}>
                    <TouchableOpacity
                        style={styles.dispatchButton}
                        onPress={handleDispatch}
                        activeOpacity={0.8}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#FFF" size="small" style={{ marginRight: 10 }} />
                        ) : (
                            <Ionicons name="alert-circle" size={24} color="#FFF" style={{ marginRight: 10 }} />
                        )}
                        <Text style={styles.dispatchButtonText}>
                            {loading ? 'Dispatching...' : 'Trigger Ambulance Dispatch'}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Active dispatch status */}
            {isDispatched && (
                <View style={styles.statusOverlay}>
                    <View style={[styles.statusBar, animComplete && styles.statusBarComplete]}>
                        <View style={styles.statusRow}>
                            <View style={[styles.statusDot, { backgroundColor: animComplete ? '#22C55E' : '#EF4444' }]} />
                            <Text style={styles.statusText}>
                                {animComplete
                                    ? `🏥 Ambulance arrived at ${selectedRoute?.destination?.label || 'destination'}`
                                    : `🚑 Ambulance en route — ${nearestCarId ? `nearest: ${nearestCarId}` : 'detecting...'}`}
                            </Text>
                        </View>
                        {!animComplete && (
                            <Text style={styles.countdownText}>
                                ETA: {Math.ceil(countdown / 60)} min
                            </Text>
                        )}
                        {routeInfo && (
                            <Text style={styles.routeDetailText}>
                                {routeInfo.distance} • {routeInfo.durationText}
                            </Text>
                        )}
                    </View>

                    <TouchableOpacity style={styles.resolveButton} onPress={handleResolve}>
                        <Ionicons name="checkmark-circle-outline" size={18} color="#FFF" style={{ marginRight: 6 }} />
                        <Text style={styles.resolveButtonText}>Resolve Dispatch</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

// ─── Autocomplete styles ───────────────────────────────────────────────
const autocompleteStyles = {
    container: { flex: 0, zIndex: 10 },
    textInputContainer: { backgroundColor: 'transparent' },
    textInput: {
        backgroundColor: '#1E293B',
        color: '#F1F5F9',
        fontSize: 14,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#334155',
        paddingHorizontal: 12,
        height: 42,
    },
    listView: {
        backgroundColor: '#1E293B',
        borderRadius: 10,
        marginTop: 2,
        borderWidth: 1,
        borderColor: '#334155',
    },
    row: { backgroundColor: '#1E293B', paddingVertical: 10 },
    description: { color: '#CBD5E1', fontSize: 13 },
    separator: { backgroundColor: '#334155', height: 0.5 },
    poweredContainer: { display: 'none' },
};

// ─── Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0F172A' },
    map: { flex: 1 },
    header: {
        position: 'absolute', top: 54, left: 16, right: 16, zIndex: 20,
        backgroundColor: 'rgba(15, 23, 42, 0.92)', borderRadius: 16,
        paddingVertical: 12, paddingHorizontal: 20,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
    },
    headerTitle: { color: '#F8FAFC', fontSize: 20, fontWeight: '700' },
    headerSubtitle: { color: '#94A3B8', fontSize: 14, fontWeight: '500' },
    settingsButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: 'rgba(148, 163, 184, 0.1)',
    },

    // Location selector
    selectorContainer: {
        position: 'absolute', top: 112, left: 16, right: 16, zIndex: 15,
        backgroundColor: 'rgba(15, 23, 42, 0.95)', borderRadius: 14,
        padding: 14,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
    },
    inputWrapper: { marginBottom: 10, zIndex: 10 },
    inputLabel: { color: '#94A3B8', fontSize: 12, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
    clearInputBtn: {
        justifyContent: 'center', alignItems: 'center',
        paddingHorizontal: 8,
    },
    getRouteButton: {
        backgroundColor: '#3B82F6', borderRadius: 12,
        paddingVertical: 12, flexDirection: 'row',
        alignItems: 'center', justifyContent: 'center', marginTop: 4,
    },
    getRouteButtonText: { color: '#FFF', fontSize: 15, fontWeight: '700' },

    // Route info
    routeInfoCard: {
        position: 'absolute', top: 112, alignSelf: 'center', zIndex: 10,
        backgroundColor: 'rgba(15, 23, 42, 0.9)', borderRadius: 10,
        paddingVertical: 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4,
    },
    routeInfoText: { color: '#CBD5E1', fontSize: 13, fontWeight: '600', flexShrink: 1 },
    routeDetailsCard: {
        position: 'absolute', top: 152, alignSelf: 'center', zIndex: 10,
        backgroundColor: 'rgba(15, 23, 42, 0.9)', borderRadius: 10,
        paddingVertical: 8, paddingHorizontal: 14, alignItems: 'center',
    },
    routeDetailText: { color: '#94A3B8', fontSize: 12, textAlign: 'center' },
    routeDetailSubtext: { color: '#64748B', fontSize: 11, marginTop: 2 },

    // Dispatch / status
    dispatchOverlay: { position: 'absolute', bottom: 110, left: 20, right: 20, zIndex: 10 },
    dispatchButton: {
        backgroundColor: '#EF4444', borderRadius: 16,
        paddingVertical: 18, paddingHorizontal: 24,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        shadowColor: '#EF4444', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8,
    },
    dispatchButtonText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
    statusOverlay: { position: 'absolute', bottom: 100, left: 16, right: 16, zIndex: 10 },
    statusBar: {
        backgroundColor: 'rgba(15, 23, 42, 0.92)', borderRadius: 14,
        paddingVertical: 14, paddingHorizontal: 18, borderWidth: 1, borderColor: '#EF4444',
    },
    statusBarComplete: { borderColor: '#22C55E' },
    statusRow: { flexDirection: 'row', alignItems: 'center' },
    statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
    statusText: { color: '#F1F5F9', fontSize: 14, fontWeight: '600', flex: 1 },
    countdownText: { color: '#EF4444', fontSize: 22, fontWeight: '800', textAlign: 'center', marginTop: 8 },
    resolveButton: {
        alignSelf: 'center', marginTop: 10,
        backgroundColor: '#22C55E', borderRadius: 12,
        paddingVertical: 10, paddingHorizontal: 20,
        flexDirection: 'row', alignItems: 'center',
        shadowColor: '#22C55E', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
    },
    resolveButtonText: { color: '#FFF', fontSize: 14, fontWeight: '700' },

    // Role guard
    guardContainer: {
        flex: 1, backgroundColor: '#0F172A',
        justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30,
    },
    guardTitle: { color: '#F1F5F9', fontSize: 22, fontWeight: '700', marginTop: 20, textAlign: 'center' },
    guardSubtext: { color: '#94A3B8', fontSize: 15, marginTop: 8, textAlign: 'center' },
    guardButton: {
        marginTop: 24, backgroundColor: '#3B82F6', borderRadius: 12,
        paddingVertical: 14, paddingHorizontal: 30,
    },
    guardButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
    resetButton: {
        marginTop: 16, flexDirection: 'row', alignItems: 'center',
        padding: 10,
    },
    resetButtonText: { color: '#94A3B8', fontSize: 14, marginLeft: 6 },
});
