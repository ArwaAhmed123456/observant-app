import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  Home, Phone, MapPin, Calendar,
  LayoutDashboard, Users, FileText, Settings, Route, User
} from 'lucide-react-native';
import { COLORS } from './src/theme';

import { AppProvider, useApp } from './src/context/AppContext';
import { seedIfEmpty } from './src/data/store';

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

const TAB_BAR = {
  backgroundColor: COLORS.bgCard,
  borderTopColor:  COLORS.borderSubtle,
  borderTopWidth:  1,
  paddingBottom:   6,
  paddingTop:      6,
  height:          62,
};

const TAB_SCREEN_OPTIONS = ({ route }) => ({
  headerShown: false,
  tabBarActiveTintColor:   COLORS.brand,
  tabBarInactiveTintColor: COLORS.textDisabled,
  tabBarStyle: TAB_BAR,
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
      Roster:      <Users            color={color} size={size} />,
      Reports:     <FileText         color={color} size={size} />,
      Checkpoints: <Settings         color={color} size={size} />,
    };
    return icons[route.name] || null;
  },
});

// ── Guard Tabs ────────────────────────────────────────────────────────────────
function GuardTabs() {
  const { activeCheckCall } = useApp();
  return (
    <Tab.Navigator screenOptions={TAB_SCREEN_OPTIONS}>
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
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
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
  const unreadCount = getUnreadAlerts(currentUser?.id || currentUser?._id)?.length || 0;
  return (
    <Tab.Navigator screenOptions={TAB_SCREEN_OPTIONS}>
      <Tab.Screen
        name="Dashboard"
        component={ManagerDashboardScreen}
        options={{
          tabBarBadge:      unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: COLORS.missed, color: '#fff', fontSize: 10 },
        }}
      />
      <Tab.Screen name="Roster"      component={ManagerRosterScreen} />
      <Tab.Screen name="Reports"     component={ManagerReportsScreen} />
      <Tab.Screen name="Checkpoints" component={ManagerCheckpointScreen} />
    </Tab.Navigator>
  );
}

// ── Root Navigator ────────────────────────────────────────────────────────────
function RootNavigator() {
  const { currentUser, authLoading } = useApp();

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
      ) : currentUser.role === 'guard' ? (
        <Stack.Screen name="GuardApp"      component={GuardTabs} />
      ) : currentUser.role === 'superadmin' || currentUser.role === 'admin' ? (
        <Stack.Screen name="SuperAdminApp" component={SuperAdminScreen} />
      ) : (
        <Stack.Screen name="ManagerApp"    component={ManagerStack} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  useEffect(() => { seedIfEmpty(); }, []);
  return (
    <SafeAreaProvider>
      <AppProvider>
        <NavigationContainer>
          <StatusBar style="light" backgroundColor={COLORS.bgRoot} />
          <RootNavigator />
        </NavigationContainer>
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, backgroundColor: COLORS.bgRoot, alignItems: 'center', justifyContent: 'center' },
});
