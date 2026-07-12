import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, useTheme, ActivityIndicator, IconButton, Button } from 'react-native-paper';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { db } from '../db';
import { workouts, workoutExercises, sets, exercises } from '../db/schema';
import { eq, asc } from 'drizzle-orm';
import { formatExerciseType, formatDuration } from '../utils/exerciseUtils';
import { useWorkoutStore } from '../store/workoutStore';
import { startWorkoutNotification } from '../utils/notificationUtils';


export default function WorkoutDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>();
  const { resumeWorkout, activeWorkoutId } = useWorkoutStore();

  const [workout, setWorkout] = useState<any>(null);
  const [workoutData, setWorkoutData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWorkoutDetail();
  }, [workoutId]);

  const loadWorkoutDetail = async () => {
    if (!workoutId) return;
    try {
      // Fetch workout general info
      const workoutResult = await db.select().from(workouts).where(eq(workouts.id, workoutId));
      if (workoutResult.length === 0) {
        setLoading(false);
        return;
      }
      setWorkout(workoutResult[0]);

      // Fetch exercises and sets
      const data = await db
        .select({
          weId: workoutExercises.id,
          exName: exercises.name,
          exType: exercises.type,
        })
        .from(workoutExercises)
        .innerJoin(exercises, eq(workoutExercises.exerciseId, exercises.id))
        .where(eq(workoutExercises.workoutId, workoutId))
        .orderBy(asc(workoutExercises.orderIndex));

      const fullData = await Promise.all(
        data.map(async (we) => {
          const weSets = await db
            .select()
            .from(sets)
            .where(eq(sets.workoutExerciseId, we.weId))
            .orderBy(asc(sets.createdAt));
          return { ...we, sets: weSets };
        })
      );

      setWorkoutData(fullData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleEditWorkout = () => {
    if (activeWorkoutId && activeWorkoutId !== workout.id) {
      Alert.alert(
        'Workout in Progress',
        'You already have an active workout in progress. Please finish or cancel it first.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Resume Workout',
      'Do you want to resume and edit this completed workout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resume',
          onPress: async () => {
            try {
              await db
                .update(workouts)
                .set({
                  status: 'active',
                  endTime: null,
                  paused: false,
                  lastActiveTime: Date.now(),
                })
                .where(eq(workouts.id, workout.id));

              const currentDuration = workout.elapsedSeconds || 0;

              resumeWorkout(workout.id, workout.startTime, currentDuration);
              startWorkoutNotification(Date.now() - currentDuration * 1000);
              router.replace('/workout');
            } catch (e) {
              console.error('Failed to resume workout:', e);
              Alert.alert('Error', 'Failed to resume workout.');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!workout) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
        <Text>Workout not found.</Text>
      </View>
    );
  }

  const workoutDate = new Date(workout.startTime).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Workout Details',
          headerRight: () => (
            <Button mode="text" onPress={handleEditWorkout}>
              Edit
            </Button>
          ),
        }}
      />
      <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Card style={styles.summaryCard}>
          <Card.Content>
            <Text variant="headlineSmall" style={styles.title}>
              {workoutDate}
            </Text>
            <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
              Duration: {formatDuration(workout.elapsedSeconds, workout.status)}
            </Text>
            {workout.notes && (
              <Text variant="bodyMedium" style={{ marginTop: 12, fontStyle: 'italic' }}>
                Notes: {workout.notes}
              </Text>
            )}
          </Card.Content>
        </Card>

        <Text variant="titleMedium" style={styles.sectionTitle}>
          Exercises Completed
        </Text>

        {workoutData.map((we) => (
          <Card key={we.weId} style={styles.exerciseCard}>
            <Card.Title title={we.exName} subtitle={formatExerciseType(we.exType)} />
            <Card.Content>
              {we.sets.map((set: any, index: number) => (
                <View key={set.id} style={styles.setRow}>
                  <Text style={[styles.setIndex, { color: theme.colors.outline }]}>{index + 1}</Text>
                  {we.exType === 'weight_reps' && (
                    <Text style={styles.setDetails}>
                      {set.weight != null ? `${set.weight} kg` : '—'} x {set.reps != null ? `${set.reps} reps` : '—'}
                    </Text>
                  )}
                  {we.exType === 'reps_only' && (
                    <Text style={styles.setDetails}>
                      {set.reps != null ? `${set.reps} reps` : '—'}
                    </Text>
                  )}
                  {we.exType === 'time_based' && (
                    <Text style={styles.setDetails}>
                      {set.timeSeconds != null ? `${set.timeSeconds} sec` : '—'}
                    </Text>
                  )}
                  {set.completed && (
                    <IconButton icon="check-circle" iconColor={theme.colors.primary} size={18} style={styles.checkIcon} />
                  )}
                </View>
              ))}
            </Card.Content>
          </Card>
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  summaryCard: { margin: 16, marginBottom: 8 },
  title: { fontWeight: 'bold' },
  sectionTitle: { paddingHorizontal: 20, marginTop: 16, marginBottom: 8, fontWeight: 'bold' },
  exerciseCard: { marginHorizontal: 16, marginBottom: 12 },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  setIndex: { width: 30, fontWeight: 'bold' },
  setDetails: { flex: 1, fontSize: 16 },
  checkIcon: { margin: 0, padding: 0 },
});
