import { useFonts } from 'expo-font';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { registerBackgroundRefresh } from '@/lib/background';
import { isHeavyWork } from '@/lib/heavy';
import { useTheme } from '@/lib/hooks';
import { watchForSync } from '@/lib/account';
import { rescheduleAlerts, setupNotificationHandler, watchForReschedule } from '@/lib/notify';
import { loadPlanner } from '@/lib/planner';
import { loadTools, subscribeTools } from '@/lib/tools';
import { flushStore, load, subscribe, getState, useStore } from '@/lib/store';
import { FONT_FILES } from '@/lib/typefaces';
import { refreshWidget, syncFocusActivity, syncLiveActivity } from '@/widgets';

void SplashScreen.preventAutoHideAsync();
setupNotificationHandler();

/** A thrown error shows this instead of closing the app. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14, backgroundColor: '#0a0a0b' }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: '#f2eee6', textAlign: 'center' }}>Something went wrong</Text>
      <Text style={{ fontSize: 15, lineHeight: 21, color: 'rgba(242,238,230,0.6)', textAlign: 'center' }}>Your schedule and settings are safe. Tap below to go back.</Text>
      <Pressable accessibilityRole="button" onPress={() => void retry()} style={{ marginTop: 6, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 999, backgroundColor: '#e8b84b' }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#111111' }}>Try again</Text>
      </Pressable>
      {__DEV__ ? <Text style={{ fontSize: 12, color: 'rgba(242,238,230,0.4)', textAlign: 'center' }}>{error.message}</Text> : null}
    </View>
  );
}

export default function RootLayout() {
  const storeLoaded = useStore((s) => s.loaded);
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);
  // Never sit on a blank screen waiting for fonts: after 2.5 s show the app anyway.
  const [fontWait, setFontWait] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setFontWait(false), 2500);
    return () => clearTimeout(t);
  }, []);
  const loaded = storeLoaded && (fontsLoaded || !!fontError || !fontWait);
  const theme = useTheme();

  useEffect(() => {
    let stopWatch: (() => void) | null = null;
    let stopSync: (() => void) | null = null;
    void loadPlanner();
    void loadTools();
    void load().then(() => {
      stopWatch = watchForReschedule();
      stopSync = watchForSync();
      // Always refill the alert queue on launch, then pull the shared schedule.
      void rescheduleAlerts();
      void registerBackgroundRefresh();
      refreshWidget();
      void syncLiveActivity();
    });
    // Widget + Live Activity follow the schedule, theme and test mode (debounced).
    let key = '';
    let t: ReturnType<typeof setTimeout> | null = null;
    const stopWidgets = subscribe(() => {
      const s = getState();
      if (!s.loaded) return;
      const next = JSON.stringify([s.shared, s.personal, s.prefs.theme, s.prefs.h24, s.prefs.testPeriod3, s.prefs.liveActivity]);
      if (next === key) return;
      key = next;
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        refreshWidget();
        void syncLiveActivity();
      }, 1000);
    });
    let lastActive = Date.now();
    let focusTimer: ReturnType<typeof setTimeout> | null = null;
    const stopFocusWatch = subscribeTools(() => {
      if (focusTimer) clearTimeout(focusTimer);
      focusTimer = setTimeout(() => void syncFocusActivity(), 400);
    });
    const sub = AppState.addEventListener('change', (st) => {
      // Skip while a photo is being processed, and at most once every 20 s
      // (the camera and photo picker flip the app inactive/active).
      if (st === 'background' || st === 'inactive') void flushStore();
      if (st === 'active') void load();
      if (st === 'active' && !isHeavyWork() && Date.now() - lastActive > 20000) {
        lastActive = Date.now();
        void rescheduleAlerts();
        refreshWidget();
        void syncLiveActivity();
      }
    });
    return () => {
      sub.remove();
      stopWatch?.();
      stopSync?.();
      stopWidgets();
      stopFocusWatch();
      if (focusTimer) clearTimeout(focusTimer);
    };
  }, []);

  useEffect(() => {
    if (loaded) void SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  // Plain solid headers: the translucent blur + iOS 26 scroll-edge effect overlapped and looked broken.
  const header = {
    headerStyle: { backgroundColor: theme.bg },
    headerTintColor: theme.accent,
    headerTitleStyle: { color: theme.ink, fontWeight: '600' },
    headerShadowVisible: false,
    headerBackButtonDisplayMode: 'minimal',
    contentStyle: { backgroundColor: theme.bg },
  } as const;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar style={theme.light ? 'dark' : 'light'} />
      <Stack screenOptions={header}>
        <Stack.Screen name="index" options={{ headerShown: false, title: 'Studento' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="hub" options={{ title: 'Studento' }} />
        <Stack.Screen name="welcome" options={{ title: '', headerBackVisible: false, gestureEnabled: false }} />
        <Stack.Screen name="setup-schedule" options={{ title: 'Your Schedule' }} />
        <Stack.Screen name="schedule-review" options={{ title: 'Check Your Schedule' }} />
        <Stack.Screen name="today" options={{ title: 'Today' }} />
        <Stack.Screen name="planner" options={{ title: 'Planner' }} />
        <Stack.Screen name="widgets" options={{ title: 'Widgets' }} />
        <Stack.Screen name="focus" options={{ title: 'Focus' }} />
        <Stack.Screen name="week" options={{ title: 'This Week' }} />
        <Stack.Screen name="notes" options={{ title: 'Notes' }} />
        <Stack.Screen name="grades" options={{ title: 'Grades' }} />
        <Stack.Screen name="classes" options={{ title: 'My Classes' }} />
        <Stack.Screen name="themes" options={{ title: 'Themes' }} />
        <Stack.Screen name="app-icon" options={{ title: 'App Icon' }} />
        <Stack.Screen name="school" options={{ title: 'Your School' }} />
        <Stack.Screen name="schedule-publish" options={{ title: 'New Bell Schedule' }} />
        <Stack.Screen name="account" options={{ title: 'Account' }} />
        <Stack.Screen name="admin" options={{ title: 'Admin' }} />
        <Stack.Screen name="schedules" options={{ title: 'Schedules' }} />
        <Stack.Screen name="schedule-edit" options={{ title: 'Custom Day' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
