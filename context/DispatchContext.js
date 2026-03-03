import React, { createContext, useState, useContext, useCallback } from 'react';
import { AMBULANCE_CONFIG } from '../constants/ambulanceConfig';

const DispatchContext = createContext();

/**
 * Shared dispatch state between DispatchScreen (demo map) and DriverScreen (driver alert)
 * Includes activeDispatchId for Supabase row tracking and selectedRoute for custom routing
 */
export function DispatchProvider({ children }) {
    const [isDispatched, setIsDispatched] = useState(false);
    const [activeDispatchId, setActiveDispatchId] = useState(null);
    const [affectedCars, setAffectedCars] = useState([]);
    const [countdown, setCountdown] = useState(0);
    const [routePoints, setRoutePoints] = useState([]);
    const [ambulanceIndex, setAmbulanceIndex] = useState(0);
    // No driverCleared state — alerts auto-dismiss when car moves off-route
    const [dispatchData, setDispatchData] = useState(null); // Full Supabase row

    // Selected route from location selector (Part 1)
    const [selectedRoute, setSelectedRoute] = useState(null);
    // {
    //   origin: { label, lat, lng },
    //   destination: { label, lat, lng },
    //   routePoints: [...],
    //   distance: "12.3 km",
    //   duration: "18 mins",
    //   durationSeconds: 1080
    // }

    const triggerDispatch = useCallback((cars, route, dispatchId = null, rowData = null) => {
        setIsDispatched(true);
        setActiveDispatchId(dispatchId);
        setAffectedCars(cars);
        setRoutePoints(route);
        setAmbulanceIndex(0);
        setCountdown(route.length > 0 ? route.length : AMBULANCE_CONFIG.tripDurationSeconds);
        setDispatchData(rowData);
    }, []);

    const updateAmbulance = useCallback((index, remaining) => {
        setAmbulanceIndex(index);
        setCountdown(remaining);
    }, []);

    // No clearLane — alerts auto-dismiss when car moves off-route

    const resetDispatch = useCallback(() => {
        setIsDispatched(false);
        setActiveDispatchId(null);
        setAffectedCars([]);
        setCountdown(0);
        setRoutePoints([]);
        setAmbulanceIndex(0);
        setDispatchData(null);
        setSelectedRoute(null);
    }, []);

    return (
        <DispatchContext.Provider
            value={{
                isDispatched,
                activeDispatchId,
                affectedCars,
                countdown,
                routePoints,
                ambulanceIndex,
                dispatchData,
                selectedRoute,
                setSelectedRoute,
                triggerDispatch,
                updateAmbulance,
                resetDispatch,
            }}
        >
            {children}
        </DispatchContext.Provider>
    );
}

export function useDispatch() {
    const context = useContext(DispatchContext);
    if (!context) {
        throw new Error('useDispatch must be used within a DispatchProvider');
    }
    return context;
}
