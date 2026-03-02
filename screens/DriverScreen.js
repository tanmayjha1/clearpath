import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDispatch } from '../context/DispatchContext';
import { USER_PREFERENCES } from '../constants/userPreferences';
import { getStrings } from '../constants/strings';
import { generateAlertMessage } from '../services/alertService';
import {
  subscribeToDispatches,
  subscribeToVehicles,
  updateVehicleCleared,
  getActiveDispatch,
  getVehicleState,
} from '../services/supabaseClient';

// TODO: future step — read user language preference from Supabase
// user profile instead of constants/userPreferences.js
const lang = USER_PREFERENCES.language;
const S = getStrings(lang);

export default function DriverScreen({ navigation }) {
  const {
    isDispatched,
    affectedCars,
    countdown,
    driverCleared,
    dispatchData,
    activeDispatchId,
    clearLane,
    triggerDispatch,
    resetDispatch,
  } = useDispatch();

  // ─── Car ID from AsyncStorage ──────────────────────────────────────
  const [myCarId, setMyCarId] = useState(null);
  const [carIdLoaded, setCarIdLoaded] = useState(false);

  const [deviceRole, setDeviceRole] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem('clearpath_car_id').then((id) => {
      setMyCarId(id || 'car_a');
      setCarIdLoaded(true);
    });
    AsyncStorage.getItem('clearpath_role').then((role) => {
      setDeviceRole(role);
    });
  }, []);

  // ─── Vehicle-level alert state ─────────────────────────────────────
  const [isNearest, setIsNearest] = useState(false);
  const [hasCleared, setHasCleared] = useState(false);

  const isAffected = affectedCars.includes(myCarId);
  // Show alert if either: old-style affected check OR new vehicle-level is_nearest
  const showAlert = (isDispatched && isAffected && !driverCleared) || (isNearest && !hasCleared);

  // AI message state
  const [aiMessage, setAiMessage] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState(false);

  // Flashing state — only flash for 5 seconds
  const [isFlashing, setIsFlashing] = useState(false);
  const flashTimerRef = useRef(null);

  // Pulsing animation
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const iconPulse = useRef(new Animated.Value(1)).current;

  // Vehicle subscription channel ref
  const vehicleChannelRef = useRef(null);

  // ─── Initial Sync on Mount ──────────────────────────────────────────
  useEffect(() => {
    // Only run this if we aren't already dispatched (e.g. from local DispatchScreen)
    if (!isDispatched) {
      getActiveDispatch().then((active) => {
        if (active) {
          console.log('Sync on mount: active dispatch found:', active.id);
          triggerDispatch(
            [myCarId],
            [],
            active.id,
            active
          );
        }
      });
    }
  }, [isDispatched, myCarId]);

  // ─── Initial Vehicle State Sync ────────────────────────────────────
  useEffect(() => {
    if (activeDispatchId && myCarId && !hasCleared) {
      getVehicleState(activeDispatchId, myCarId).then((state) => {
        if (state) {
          if (state.is_nearest) setIsNearest(true);
          if (state.has_cleared) setHasCleared(true);
        }
      });
    }
  }, [activeDispatchId, myCarId, hasCleared]);

  // ─── Refs for event listeners (avoiding stale closures) ────────────
  const deviceRoleRef = useRef(deviceRole);
  const activeDispatchIdRef = useRef(activeDispatchId);

  useEffect(() => {
    deviceRoleRef.current = deviceRole;
  }, [deviceRole]);

  useEffect(() => {
    activeDispatchIdRef.current = activeDispatchId;
  }, [activeDispatchId]);

  // ─── Supabase dispatch subscription ────────────────────────────────
  useEffect(() => {
    const channel = subscribeToDispatches(
      // On INSERT — new dispatch created
      (newRow) => {
        if (newRow.status === 'active') {
          // Prevent double-trigger if this IS the dispatcher device
          // Or if we are already dispatched for this specific ID
          if (
            deviceRoleRef.current === 'dispatcher' ||
            activeDispatchIdRef.current === newRow.id
          ) {
            console.log('Real-time: skipping trigger (already active or dispatcher role)');
            return;
          }

          console.log('Real-time: active dispatch detected, ID:', newRow.id);
          const tripDuration = newRow.trip_duration_seconds || 180;

          triggerDispatch(
            [myCarId], // Assume affected; vehicle-level check via active_vehicles
            [],
            newRow.id,
            newRow
          );
        }
      },
      // On UPDATE — dispatch resolved
      (updatedRow) => {
        if (updatedRow.status === 'resolved') {
          console.log('Real-time: dispatch resolved, ID:', updatedRow.id);
          setIsNearest(false);
          setHasCleared(false);
          resetDispatch();
        }
      }
    );

    return () => {
      if (channel) {
        channel.unsubscribe();
        console.log('Real-time: unsubscribed from dispatches');
      }
    };
  }, [myCarId, triggerDispatch, resetDispatch]);

  // ─── Supabase vehicle subscription ─────────────────────────────────
  useEffect(() => {
    if (!activeDispatchId || !myCarId || !carIdLoaded) return;

    // Clean up previous subscription
    if (vehicleChannelRef.current) {
      vehicleChannelRef.current.unsubscribe();
    }

    const channel = subscribeToVehicles(activeDispatchId, (updatedRow) => {
      if (updatedRow.car_id === myCarId) {
        if (updatedRow.is_nearest) {
          setIsNearest(true);
        } else {
          // Only dismiss if driver hasn't cleared
          if (!hasCleared) {
            setIsNearest(false);
          }
        }
        if (updatedRow.has_cleared) {
          setHasCleared(true);
        }
      }
    });

    vehicleChannelRef.current = channel;

    return () => {
      if (channel) {
        channel.unsubscribe();
        console.log('Real-time: unsubscribed from active_vehicles');
      }
    };
  }, [activeDispatchId, myCarId, carIdLoaded, hasCleared]);

  // ─── Fetch AI message when alert triggers ──────────────────────────
  useEffect(() => {
    if (showAlert && !aiMessage && !loadingMessage) {
      setLoadingMessage(true);
      setIsFlashing(true);

      flashTimerRef.current = setTimeout(() => {
        setIsFlashing(false);
      }, 5000);

      const tripCountdown = dispatchData
        ? dispatchData.trip_duration_seconds
        : countdown;

      generateAlertMessage(tripCountdown)
        .then((message) => {
          setAiMessage(message);
          setLoadingMessage(false);
        })
        .catch(() => {
          setAiMessage(S.fallbackMessage);
          setLoadingMessage(false);
        });
    }

    if (!isDispatched && !isNearest) {
      setAiMessage(null);
      setLoadingMessage(false);
      setIsFlashing(false);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    }
  }, [showAlert, isDispatched, isNearest]);

  // Cleanup flash timer
  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  // Pulsing red background animation
  useEffect(() => {
    if (showAlert) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1, duration: 1000,
            easing: Easing.inOut(Easing.ease), useNativeDriver: false,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0, duration: 1000,
            easing: Easing.inOut(Easing.ease), useNativeDriver: false,
          }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(iconPulse, {
            toValue: 1.15, duration: 800,
            easing: Easing.inOut(Easing.ease), useNativeDriver: true,
          }),
          Animated.timing(iconPulse, {
            toValue: 1, duration: 800,
            easing: Easing.inOut(Easing.ease), useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(0);
      iconPulse.setValue(1);
    }
  }, [showAlert]);

  const bgColor = isFlashing
    ? pulseAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['#7F1D1D', '#DC2626'],
    })
    : '#991B1B';

  // Format countdown to minutes
  const formatCountdown = (seconds) => {
    if (seconds <= 0) return S.lessThanMinute;
    const mins = Math.ceil(seconds / 60);
    if (mins <= 1) return `1 ${S.minuteLabel}`;
    return `${mins} ${S.minutesLabel}`;
  };

  // Get destination label from Supabase row if available
  const destinationLabel = dispatchData
    ? dispatchData.destination_label
    : 'Singapore General Hospital';

  // ─── Handle Lane Cleared ───────────────────────────────────────────
  const handleClearLane = useCallback(async () => {
    setHasCleared(true);
    clearLane();

    // Update Supabase
    if (activeDispatchId && myCarId) {
      await updateVehicleCleared(activeDispatchId, myCarId);
    }
  }, [activeDispatchId, myCarId, clearLane]);

  // ─── Reset Device Role ─────────────────────────────────────────────
  const handleResetRole = useCallback(async () => {
    await AsyncStorage.multiRemove(['clearpath_role', 'clearpath_car_id']);
    if (navigation && navigation.reset) {
      navigation.reset({ index: 0, routes: [{ name: 'DeviceSetup' }] });
    }
  }, [navigation]);

  // ─── Loading state ─────────────────────────────────────────────────
  if (!carIdLoaded) {
    return (
      <View style={styles.defaultContainer}>
        <ActivityIndicator color="#3B82F6" size="large" />
        <Text style={{ color: '#94A3B8', marginTop: 16, fontSize: 14 }}>
          Loading driver identity...
        </Text>
      </View>
    );
  }

  // ─── CLEARED STATE ─────────────────────────────────────────────────
  if (hasCleared && isDispatched) {
    return (
      <View style={styles.defaultContainer}>
        <View style={styles.defaultContent}>
          <View style={styles.statusCircle}>
            <Ionicons name="checkmark-circle" size={64} color="#22C55E" />
          </View>
          <Text style={styles.defaultTitle}>{S.clearedTitle}</Text>
          <View style={styles.statusBadge}>
            <View style={styles.greenDot} />
            <Text style={styles.defaultSubtext}>{S.clearedSubtext}</Text>
          </View>
        </View>
        <View style={styles.carIdBadge}>
          <Text style={styles.carIdText}>🚗 {myCarId?.toUpperCase().replace('_', ' ')}</Text>
        </View>
        <TouchableOpacity style={styles.settingsCorner} onPress={handleResetRole}>
          <Ionicons name="settings-outline" size={22} color="#475569" />
        </TouchableOpacity>
      </View>
    );
  }

  // ─── ALERT STATE ───────────────────────────────────────────────────
  if (showAlert) {
    // Use destination-templated message
    const templateMessage = S.alertMessageTemplate
      ? S.alertMessageTemplate(destinationLabel)
      : null;

    return (
      <Animated.View
        style={[
          styles.alertContainer,
          isFlashing ? { backgroundColor: bgColor } : { backgroundColor: '#991B1B' },
        ]}
      >
        <TouchableOpacity style={styles.settingsCorner} onPress={handleResetRole}>
          <Ionicons name="settings-outline" size={22} color="rgba(254,242,242,0.5)" />
        </TouchableOpacity>

        <Animated.View style={[styles.iconContainer, { transform: [{ scale: iconPulse }] }]}>
          <Ionicons name="warning" size={80} color="#FEF2F2" />
        </Animated.View>

        <Text style={styles.alertTitle}>{S.alertTitle}</Text>

        {/* Destination info */}
        {destinationLabel && (
          <Text style={styles.destinationText}>
            🏥 Heading to: {destinationLabel}
          </Text>
        )}

        {/* Templated message */}
        {templateMessage && (
          <View style={styles.templateCard}>
            <Text style={styles.templateText}>{templateMessage}</Text>
          </View>
        )}

        {/* AI Message or Loading */}
        <View style={styles.messageCard}>
          {loadingMessage ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#F59E0B" size="small" />
              <Text style={styles.loadingText}>{S.loadingAlert}</Text>
            </View>
          ) : (
            <>
              <Ionicons name="chatbubble-ellipses" size={20} color="#F59E0B"
                style={{ marginRight: 10, marginTop: 2 }} />
              <Text style={styles.messageText}>{aiMessage}</Text>
            </>
          )}
        </View>

        {/* Countdown */}
        <View style={styles.countdownContainer}>
          <Text style={styles.countdownLabel}>{S.countdownLabel}</Text>
          <Text style={styles.countdownValue}>{formatCountdown(countdown)}</Text>
        </View>

        {/* Car ID badge */}
        <View style={[styles.carIdBadge, { marginBottom: 16 }]}>
          <Text style={styles.carIdText}>🚗 {myCarId?.toUpperCase().replace('_', ' ')}</Text>
        </View>

        {/* Lane Cleared Button */}
        <TouchableOpacity style={styles.clearButton} onPress={handleClearLane} activeOpacity={0.8}>
          <Ionicons name="checkmark-circle" size={28} color="#FFF" style={{ marginRight: 10 }} />
          <Text style={styles.clearButtonText}>{S.clearButtonText}</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // ─── DEFAULT STATE ─────────────────────────────────────────────────
  return (
    <View style={styles.defaultContainer}>
      <TouchableOpacity style={styles.settingsCorner} onPress={handleResetRole}>
        <Ionicons name="settings-outline" size={22} color="#475569" />
      </TouchableOpacity>

      <View style={styles.defaultContent}>
        <View style={styles.statusCircle}>
          <Ionicons
            name={driverCleared ? 'checkmark-circle' : 'shield-checkmark'}
            size={64} color="#22C55E"
          />
        </View>

        <Text style={styles.defaultTitle}>
          {driverCleared ? S.clearedTitle : S.allClear}
        </Text>

        <View style={styles.statusBadge}>
          <View style={styles.greenDot} />
          <Text style={styles.defaultSubtext}>
            {driverCleared ? S.clearedSubtext : S.noEmergency}
          </Text>
        </View>

        {/* Car ID badge */}
        <View style={[styles.carIdBadge, { marginTop: 24 }]}>
          <Text style={styles.carIdText}>🚗 {myCarId?.toUpperCase().replace('_', ' ')}</Text>
        </View>
      </View>

      <View style={styles.branding}>
        <Text style={styles.brandingText}>{S.branding}</Text>
        <Text style={styles.brandingSubtext}>{S.brandingSubtext}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  alertContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 30, paddingTop: 60,
  },
  iconContainer: {
    marginBottom: 20, width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  alertTitle: {
    color: '#FEF2F2', fontSize: 26, fontWeight: '900',
    textAlign: 'center', letterSpacing: 0.5, marginBottom: 8,
  },
  destinationText: {
    color: 'rgba(254, 242, 242, 0.8)', fontSize: 15,
    fontWeight: '600', marginBottom: 12, textAlign: 'center',
  },
  templateCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: 12,
    padding: 14, marginBottom: 12, width: '100%',
    borderLeftWidth: 3, borderLeftColor: '#EF4444',
  },
  templateText: {
    color: '#FEF2F2', fontSize: 15, fontWeight: '600', lineHeight: 22,
  },
  messageCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)', borderRadius: 16,
    padding: 18, flexDirection: 'row', alignItems: 'flex-start',
    marginBottom: 30, width: '100%',
    borderLeftWidth: 3, borderLeftColor: '#F59E0B', minHeight: 60,
  },
  loadingRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  loadingText: { color: '#FEF2F2', fontSize: 15, fontWeight: '500', marginLeft: 12, opacity: 0.8 },
  messageText: { color: '#FEF2F2', fontSize: 16, fontWeight: '500', lineHeight: 24, flex: 1 },
  countdownContainer: { alignItems: 'center', marginBottom: 20 },
  countdownLabel: {
    color: 'rgba(254, 242, 242, 0.7)', fontSize: 14, fontWeight: '500',
    textTransform: 'uppercase', letterSpacing: 1,
  },
  countdownValue: { color: '#FEF2F2', fontSize: 48, fontWeight: '900', marginTop: 4 },
  clearButton: {
    backgroundColor: '#22C55E', borderRadius: 16,
    paddingVertical: 18, paddingHorizontal: 40,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    width: '100%',
    shadowColor: '#22C55E', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  clearButtonText: { color: '#FFF', fontSize: 20, fontWeight: '800' },
  defaultContainer: {
    flex: 1, backgroundColor: '#0F172A',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30,
  },
  defaultContent: { alignItems: 'center' },
  statusCircle: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center',
    marginBottom: 24, borderWidth: 2, borderColor: '#22C55E',
  },
  defaultTitle: { color: '#F1F5F9', fontSize: 24, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1E293B', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 30,
  },
  greenDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#22C55E', marginRight: 10 },
  defaultSubtext: { color: '#94A3B8', fontSize: 15, fontWeight: '500', textAlign: 'center', flex: 1 },
  carIdBadge: {
    backgroundColor: '#1E293B', borderRadius: 20,
    paddingVertical: 8, paddingHorizontal: 16,
    borderWidth: 1, borderColor: '#334155',
  },
  carIdText: { color: '#CBD5E1', fontSize: 14, fontWeight: '600' },
  branding: { position: 'absolute', bottom: 110, alignItems: 'center' },
  brandingText: { color: '#334155', fontSize: 18, fontWeight: '700' },
  brandingSubtext: { color: '#1E293B', fontSize: 12, fontWeight: '500', marginTop: 2 },
  settingsCorner: {
    position: 'absolute', top: 60, right: 20, zIndex: 20,
    padding: 8, borderRadius: 8,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
  },
});
