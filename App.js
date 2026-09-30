import 'react-native-gesture-handler';
import React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  Home, Phone, MapPin, Calendar,
  LayoutDashboard, FileText, Settings, Route, User
} from 'lucide-react-native';
import { COLORS } from './src/theme';

import { AppProvider, useApp } from './src/context/AppContext';

// ── Screens ───────────────────────────────────────────────────────────────────
import { LoginScreen }             from './src/native/screens/LoginScreen';
import { GuardHomeScreen }         from './src/native/screens/GuardHomeScreen';
import { CheckCallScreen }         from './src/native/screens/CheckCallScreen';
import { CheckCallPathScreen }     from './src/native/screens/CheckCallPathScreen';
import { PatrolScreen }            from './src/native/screens/PatrolScreen';
import { GuardScheduleScreen }     from './src/native/screens/GuardScheduleScreen';
import { ProfileScreen }           from './src/native/screens/ProfileScreen';
import { ManagerDashboardScreen }  from './src/native/screens/ManagerDashboardScreen';
import { ManagerRosterScreen }     from './src/native/screens/ManagerRosterScreen';
import { ManagerReportsScreen }    from './src/native/screens/ManagerReportsScreen';
import { ManagerCheckpointScreen } from './src/native/screens/ManagerCheckpointScreen';
import { SuperAdminScreen }        from './src/native/screens/SuperAdminScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

const APP_NAV_THEME = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: COLORS.bgRoot,
    card: COLORS.bgCard,
    text: COLORS.textPrimary,
    border: COLORS.borderSubtle,
    primary: COLORS.brand,
  },
};

const tabScreenOptions = insets => ({ route }) => ({
  headerShown: false,
  tabBarActiveTintColor:   '#D97706',
  tabBarInactiveTintColor: '#FFFFFF',
  tabBarStyle: {
    backgroundColor: '#0B192C',
    borderTopColor: '#23344C',
    borderTopWidth: 1,
    paddingBottom: Math.max(insets.bottom, 16),
    paddingTop: 8,
    height: 58 + Math.max(insets.bottom, 16),
  },
  tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
  tabBarIcon: ({ color, size }) => {
    const icons = {
      Home:        <Home             color={color} size={size} />,
      'Check Call':<Phone            color={color} size={size} />,
      'Call Path': <Route            color={color} size={size} />,
      Patrol:      <MapPin           color={color} size={size} />,
      Shifts:      <Calendar         color={color} size={size} />,
      Profile:     <User             color={color} size={size} />,
      Dashboard:   <LayoutDashboard  color={color} size={size} />,
      Schedule:    <Calendar         color={color} size={size} />,
      Reports:     <FileText         color={color} size={size} />,
      Checkpoints: <Settings         color={color} size={size} />,
    };
    return icons[route.name] || null;
  },
});

// ── Guard Tabs ────────────────────────────────────────────────────────────────
function GuardTabs() {
  const { activeCheckCall } = useApp();
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator screenOptions={tabScreenOptions(insets)}>
      <Tab.Screen name="Home"        component={GuardHomeScreen} />
      <Tab.Screen
        name="Check Call"
        component={CheckCallScreen}
        options={{
          tabBarBadge:      activeCheckCall ? '!' : undefined,
          tabBarBadgeStyle: { backgroundColor: COLORS.missed, color: '#fff', fontSize: 10 },
        }}
      />
      <Tab.Screen name="Call Path"   component={CheckCallPathScreen} />
      <Tab.Screen name="Patrol"      component={PatrolScreen} />
      <Tab.Screen name="Shifts"      component={GuardScheduleScreen} />
      <Tab.Screen name="Profile"     component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// ── Manager Stack (tabs + guard path drill-down) ──────────────────────────────
function ManagerStack() {
  return (
    <Stack.Navigator initialRouteName="ManagerTabs" screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="ManagerTabs"       component={ManagerTabs} />
      <Stack.Screen
        name="GuardCheckCallPath"
        component={CheckCallPathScreen}
        initialParams={{ readOnly: true }}
      />
    </Stack.Navigator>
  );
}

function ManagerTabs() {
  const { getUnreadAlerts, currentUser } = useApp();
  const insets = useSafeAreaInsets();
  const unreadCount = getUnreadAlerts(currentUser?.id || currentUser?._id)?.length || 0;
  return (
    <Tab.Navigator initialRouteName="Dashboard" screenOptions={tabScreenOptions(insets)}>
      <Tab.Screen
        name="Dashboard"
        component={ManagerDashboardScreen}
        options={{
          tabBarBadge:      unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: COLORS.missed, color: '#fff', fontSize: 10 },
        }}
      />
      <Tab.Screen name="Schedule"    component={ManagerRosterScreen} />
      <Tab.Screen name="Reports"     component={ManagerReportsScreen} />
      <Tab.Screen name="Checkpoints" component={ManagerCheckpointScreen} />
    </Tab.Navigator>
  );
}

// ── Root Navigator ────────────────────────────────────────────────────────────
function RootNavigator() {
  const { currentUser, authLoading } = useApp();
  const role = String(currentUser?.role || '').toLowerCase();

  if (authLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={COLORS.brand} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      {!currentUser ? (
        <Stack.Screen name="Login"         component={LoginScreen} />
      ) : role === 'guard' ? (
        <Stack.Screen name="GuardApp"      component={GuardTabs} />
      ) : role === 'superadmin' || role === 'admin' ? (
        <Stack.Screen name="SuperAdminApp" component={SuperAdminScreen} />
      ) : role === 'manager' ? (
        <Stack.Screen name="ManagerApp"    component={ManagerStack} />
      ) : (
        <Stack.Screen name="Login"         component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <NavigationContainer
          theme={APP_NAV_THEME}
          linking={{
            prefixes: ['observant://'],
            config: { screens: {
              Login: 'login',
              ManagerApp: { screens: {
                ManagerTabs: { screens: {
                  Dashboard: 'manager/dashboard',
                  Schedule: 'manager/schedule',
                  Reports: 'manager/reports',
                  Checkpoints: 'manager/checkpoints',
                } },
                GuardCheckCallPath: 'manager/guards/:guardId/check-call-path',
              } },
              GuardApp: { screens: {
                Home: 'guard/home',
                'Check Call': 'guard/check-call',
                Patrol: 'guard/patrol',
                Shifts: 'guard/schedule',
                Profile: 'guard/profile',
              } },
            } },
          }}
        >
          <StatusBar style="dark" backgroundColor={COLORS.bgRoot} />
          <SafeAreaView style={styles.safeRoot} edges={['top']}>
            <RootNavigator />
          </SafeAreaView>
        </NavigationContainer>
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, backgroundColor: COLORS.bgRoot, alignItems: 'center', justifyContent: 'center' },
  safeRoot: { flex: 1, backgroundColor: COLORS.bgRoot },
});
