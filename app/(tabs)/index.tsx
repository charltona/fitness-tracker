import React, { useCallback, useState } from 'react';
import { View, StyleSheet, FlatList, Alert } from 'react-native';
import { Text, Button, Card, useTheme, ActivityIndicator, Chip } from 'react-native-paper';
import { useRouter, useFocusEffect } from 'expo-router';
import { db } from '../../db';
import { workouts, workoutExercises } from '../../db/schema';
import { desc, eq, sql } from 'drizzle-orm';
import { useWorkoutStore } from '../../store/workoutStore';
import * as crypto from 'expo-crypto';
import { formatDuration } from '../../utils/exerciseUtils';

export default function DashboardScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { startWorkout, activeWorkoutId } = useWorkoutStore();

  const [recentWorkouts, setRecentWorkouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadWorkouts();
    }, [])
  );

  const loadWorkouts = async () => {
    try {
      // Fetch workouts with exercise count
      const data = await db
        .select({
          id: workouts.id,
          startTime: workouts.startTime,
          endTime: workouts.endTime,
          notes: workouts.notes,
          status: workouts.status,
          elapsedSeconds: workouts.elapsedSeconds,
          exerciseCount: sql<number>`count(${workoutExercises.id})`.as('exercise_count'),
        })
        .from(workouts)
        .leftJoin(workoutExercises, eq(workouts.id, workoutExercises.workoutId))
        .groupBy(workouts.id)
        .orderBy(desc(workouts.startTime))
        .limit(20);

      setRecentWorkouts(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleStartWorkout = async () => {
    if (activeWorkoutId) {
      router.push('/workout');
      return;
    }

    const newId = crypto.randomUUID();
    const startTimeMs = Date.now();

    await db.insert(workouts).values({
      id: newId,
      startTime: startTimeMs,
      status: 'active',
      lastActiveTime: startTimeMs,
    });

    startWorkout(newId, startTimeMs);
    router.push('/workout');
  };

  const handleDeleteWorkout = (workout: any) => {
    Alert.alert(
      'Delete Workout',
      'Are you sure you want to delete this workout from your history? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await db.delete(workouts).where(eq(workouts.id, workout.id));
              loadWorkouts();
            } catch (e) {
              console.error('Failed to delete workout:', e);
              Alert.alert('Error', 'Failed to delete workout.');
            }
          },
        },
      ]
    );
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Button
          mode="contained"
          icon="play"
          onPress={handleStartWorkout}
          style={styles.startButton}
          contentStyle={styles.startButtonContent}
          labelStyle={styles.startButtonLabel}
        >
          {activeWorkoutId ? 'Resume Workout' : 'Start Workout'}
        </Button>
      </View>

      <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
        Recent Workouts
      </Text>

      {loading ? (
        <ActivityIndicator style={styles.loader} />
      ) : (
        <FlatList
          data={recentWorkouts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Card
              style={styles.card}
              onPress={() => router.push({ pathname: '/workout-detail', params: { workoutId: item.id } })}
              onLongPress={() => handleDeleteWorkout(item)}
            >
              <Card.Title
                title={formatDate(item.startTime)}
                subtitle={`${formatDuration(item.elapsedSeconds, item.status)} · ${item.exerciseCount} exercise${item.exerciseCount !== 1 ? 's' : ''}`}
                right={(props) => (
                  <Chip
                    {...props}
                    style={[
                      styles.statusChip,
                      {
                        backgroundColor:
                          item.status === 'completed'
                            ? theme.colors.secondaryContainer
                            : theme.colors.tertiaryContainer,
                      },
                    ]}
                    textStyle={{ fontSize: 11 }}
                  >
                    {item.status === 'completed' ? 'Completed' : 'Active'}
                  </Chip>
                )}
              />
            </Card>
          )}
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', marginTop: 20, color: theme.colors.onSurfaceVariant }}>
              No workouts yet. Start one above!
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, alignItems: 'center', marginVertical: 10 },
  startButton: { width: '100%', borderRadius: 16 },
  startButtonContent: { height: 72 },
  startButtonLabel: { fontSize: 20, fontWeight: 'bold' },
  sectionTitle: { paddingHorizontal: 20, marginBottom: 10, fontWeight: 'bold' },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  card: { marginBottom: 12 },
  loader: { marginTop: 40 },
  statusChip: { marginRight: 12 },
});

