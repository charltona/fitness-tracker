import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '../drizzle/migrations';
import { db } from '../db';
import { workouts } from '../db/schema';
import { eq } from 'drizzle-orm';
import { useWorkoutStore } from '../store/workoutStore';
import { PaperProvider, MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const { success: migrationSuccess, error: migrationError } = useMigrations(db, migrations);

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
    if (migrationError) throw migrationError;
  }, [error, migrationError]);

  useEffect(() => {
    if (loaded && migrationSuccess) {
      SplashScreen.hideAsync();
    }
  }, [loaded, migrationSuccess]);

  if (!loaded || !migrationSuccess) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const paperTheme = colorScheme === 'dark' ? MD3DarkTheme : MD3LightTheme;
  const { resumeWorkout } = useWorkoutStore();

  useEffect(() => {
    const checkForActiveWorkout = async () => {
      try {
        const active = await db
          .select()
          .from(workouts)
          .where(eq(workouts.status, 'active'))
          .limit(1);

        if (active.length > 0) {
          const workout = active[0];
          const duration = Math.floor((Date.now() - workout.startTime) / 1000);
          resumeWorkout(workout.id, workout.startTime, duration > 0 ? duration : 0);
        }
      } catch (e) {
        console.error('Failed to recover active workout:', e);
      }
    };

    checkForActiveWorkout();
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <PaperProvider theme={paperTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="exercise-modal" options={{ presentation: 'modal', title: 'Add Exercise' }} />
          <Stack.Screen name="workout" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
          <Stack.Screen name="workout-detail" options={{ title: 'Workout Details' }} />
        </Stack>
      </PaperProvider>
    </ThemeProvider>
  );
}

