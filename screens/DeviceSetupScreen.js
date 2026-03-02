import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CAR_OPTIONS = [
    { id: 'car_a', label: 'Car A' },
    { id: 'car_b', label: 'Car B' },
    { id: 'car_c', label: 'Car C' },
    { id: 'car_d', label: 'Car D' },
    { id: 'car_e', label: 'Car E' },
];

export default function DeviceSetupScreen({ navigation }) {
    const [showCarSelector, setShowCarSelector] = useState(false);
    const [selectedCar, setSelectedCar] = useState(null);

    const handleDispatcherSelect = async () => {
        try {
            await AsyncStorage.setItem('clearpath_role', 'dispatcher');
            navigation.reset({
                index: 0,
                routes: [{ name: 'MainTabs', params: { initialTab: 'Dispatch' } }],
            });
        } catch (err) {
            console.error('Failed to save dispatcher role:', err);
        }
    };

    const handleDriverSelect = () => {
        setShowCarSelector(true);
    };

    const handleCarSelect = async (carId) => {
        try {
            setSelectedCar(carId);
            await AsyncStorage.setItem('clearpath_role', 'driver');
            await AsyncStorage.setItem('clearpath_car_id', carId);
            navigation.reset({
                index: 0,
                routes: [{ name: 'MainTabs', params: { initialTab: 'Driver' } }],
            });
        } catch (err) {
            console.error('Failed to save driver role:', err);
        }
    };

    const handleBack = () => {
        setShowCarSelector(false);
        setSelectedCar(null);
    };

    // ─── Car ID Selection Screen ───────────────────────────────────────
    if (showCarSelector) {
        return (
            <View style={styles.container}>
                <View style={styles.content}>
                    <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                        <Ionicons name="arrow-back" size={24} color="#94A3B8" />
                        <Text style={styles.backText}>Back</Text>
                    </TouchableOpacity>

                    <Text style={styles.carTitle}>Select your Car ID</Text>
                    <Text style={styles.carSubtitle}>
                        Choose which vehicle you are driving
                    </Text>

                    <View style={styles.carGrid}>
                        {CAR_OPTIONS.map((car) => (
                            <TouchableOpacity
                                key={car.id}
                                style={[
                                    styles.carButton,
                                    selectedCar === car.id && styles.carButtonSelected,
                                ]}
                                onPress={() => handleCarSelect(car.id)}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.carEmoji}>🚗</Text>
                                <Text style={styles.carLabel}>{car.label}</Text>
                                <Text style={styles.carId}>{car.id}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </View>
        );
    }

    // ─── Role Selection Screen ─────────────────────────────────────────
    return (
        <View style={styles.container}>
            <View style={styles.content}>
                {/* Logo / Title */}
                <View style={styles.logoContainer}>
                    <Text style={styles.logoIcon}>🚨</Text>
                    <Text style={styles.logoTitle}>ClearPath</Text>
                    <Text style={styles.logoSubtitle}>Select your role for this session</Text>
                </View>

                {/* Role Cards */}
                <View style={styles.cardsContainer}>
                    {/* Dispatcher Card */}
                    <TouchableOpacity
                        style={styles.roleCard}
                        onPress={handleDispatcherSelect}
                        activeOpacity={0.7}
                    >
                        <View style={styles.roleIconContainer}>
                            <Text style={styles.roleEmoji}>🚨</Text>
                        </View>
                        <Text style={styles.roleTitle}>Dispatcher</Text>
                        <Text style={styles.roleSubtitle}>
                            Control ambulance dispatch and view map
                        </Text>
                        <View style={styles.roleArrow}>
                            <Ionicons name="arrow-forward" size={20} color="#3B82F6" />
                        </View>
                    </TouchableOpacity>

                    {/* Driver Card */}
                    <TouchableOpacity
                        style={styles.roleCard}
                        onPress={handleDriverSelect}
                        activeOpacity={0.7}
                    >
                        <View style={styles.roleIconContainer}>
                            <Text style={styles.roleEmoji}>🚗</Text>
                        </View>
                        <Text style={styles.roleTitle}>Driver</Text>
                        <Text style={styles.roleSubtitle}>
                            Receive emergency vehicle alerts
                        </Text>
                        <View style={styles.roleArrow}>
                            <Ionicons name="arrow-forward" size={20} color="#3B82F6" />
                        </View>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F172A',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },

    // Logo
    logoContainer: {
        alignItems: 'center',
        marginBottom: 48,
    },
    logoIcon: {
        fontSize: 56,
        marginBottom: 12,
    },
    logoTitle: {
        color: '#F1F5F9',
        fontSize: 36,
        fontWeight: '900',
        letterSpacing: 1,
    },
    logoSubtitle: {
        color: '#64748B',
        fontSize: 16,
        fontWeight: '500',
        marginTop: 8,
    },

    // Role Cards
    cardsContainer: {
        width: '100%',
        gap: 16,
    },
    roleCard: {
        backgroundColor: '#1E293B',
        borderRadius: 20,
        padding: 24,
        borderWidth: 1,
        borderColor: '#334155',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    roleIconContainer: {
        width: 56,
        height: 56,
        borderRadius: 16,
        backgroundColor: '#0F172A',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    roleEmoji: {
        fontSize: 28,
    },
    roleTitle: {
        color: '#F1F5F9',
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 4,
    },
    roleSubtitle: {
        color: '#94A3B8',
        fontSize: 14,
        fontWeight: '500',
        lineHeight: 20,
    },
    roleArrow: {
        position: 'absolute',
        top: 24,
        right: 24,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Car Selector
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        marginBottom: 32,
        padding: 8,
    },
    backText: {
        color: '#94A3B8',
        fontSize: 16,
        fontWeight: '500',
        marginLeft: 8,
    },
    carTitle: {
        color: '#F1F5F9',
        fontSize: 28,
        fontWeight: '800',
        marginBottom: 8,
        textAlign: 'center',
    },
    carSubtitle: {
        color: '#64748B',
        fontSize: 15,
        fontWeight: '500',
        marginBottom: 32,
        textAlign: 'center',
    },
    carGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 12,
        width: '100%',
    },
    carButton: {
        backgroundColor: '#1E293B',
        borderRadius: 16,
        padding: 20,
        width: '45%',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#334155',
    },
    carButtonSelected: {
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
    },
    carEmoji: {
        fontSize: 32,
        marginBottom: 8,
    },
    carLabel: {
        color: '#F1F5F9',
        fontSize: 18,
        fontWeight: '700',
    },
    carId: {
        color: '#64748B',
        fontSize: 12,
        fontWeight: '500',
        marginTop: 4,
    },
});
