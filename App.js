import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import DriverScreen from './screens/DriverScreen';
import DispatchScreen from './screens/DispatchScreen';
import DeviceSetupScreen from './screens/DeviceSetupScreen';
import { DispatchProvider } from './context/DispatchContext';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// TODO: [Step 3] Add AuthContext for dispatcher authentication
// TODO: [Step 3] Add NotificationProvider for push notifications

function MainTabs({ route }) {
  const initialTab = route?.params?.initialTab || 'Dispatch';

  return (
    <Tab.Navigator
      initialRouteName={initialTab}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Dispatch') {
            iconName = focused ? 'map' : 'map-outline';
          } else if (route.name === 'Driver') {
            iconName = focused ? 'car' : 'car-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#EF4444',
        tabBarInactiveTintColor: '#64748B',
        tabBarStyle: {
          backgroundColor: '#1E293B',
          borderTopColor: '#334155',
          borderTopWidth: 1,
          height: 88,
          paddingBottom: 28,
          paddingTop: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 10,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          letterSpacing: 0.3,
        },
      })}
    >
      <Tab.Screen
        name="Dispatch"
        component={DispatchScreen}
        options={{ tabBarLabel: 'Dispatch' }}
      />
      <Tab.Screen
        name="Driver"
        component={DriverScreen}
        options={{ tabBarLabel: 'Driver' }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null);
  const [initialTabParams, setInitialTabParams] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('clearpath_role')
      .then((role) => {
        if (role === 'dispatcher') {
          setInitialRoute('MainTabs');
          setInitialTabParams({ initialTab: 'Dispatch' });
        } else if (role === 'driver') {
          setInitialRoute('MainTabs');
          setInitialTabParams({ initialTab: 'Driver' });
        } else {
          setInitialRoute('DeviceSetup');
        }
        setIsLoading(false);
      })
      .catch(() => {
        setInitialRoute('DeviceSetup');
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#3B82F6" size="large" />
        <Text style={styles.loadingText}>Loading ClearPath...</Text>
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <DispatchProvider>
      <View style={styles.container}>
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName={initialRoute}
            screenOptions={{ headerShown: false, animation: 'fade' }}
          >
            <Stack.Screen
              name="DeviceSetup"
              component={DeviceSetupScreen}
            />
            <Stack.Screen
              name="MainTabs"
              component={MainTabs}
              initialParams={initialTabParams}
            />
          </Stack.Navigator>
        </NavigationContainer>
        <StatusBar style="light" />
      </View>
    </DispatchProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#64748B',
    fontSize: 14,
    marginTop: 16,
    fontWeight: '500',
  },
});
