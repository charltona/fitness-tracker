import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Button, Card, useTheme, IconButton, TextInput, Searchbar } from 'react-native-paper';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { db } from '../db';
import { workouts, workoutExercises, sets, exercises } from '../db/schema';
import { eq, asc } from 'drizzle-orm';
import { useWorkoutStore } from '../store/workoutStore';
import * as crypto from 'expo-crypto';
import { formatExerciseType } from '../utils/exerciseUtils';
import { startWorkoutNotification, pauseWorkoutNotification, stopWorkoutNotification } from '../utils/notificationUtils';


// Timer Component
const Timer = ({
  paused,
  elapsedSeconds,
  lastActiveTime,
}: {
  paused: boolean;
  elapsedSeconds: number;
  lastActiveTime: number | null;
}) => {
  const getElapsed = () => {
    const base = elapsedSeconds || 0;
    if (paused || !lastActiveTime) return base;
    return base + Math.floor((Date.now() - lastActiveTime) / 1000);
  };

  const [elapsed, setElapsed] = useState(getElapsed());

  useEffect(() => {
    setElapsed(getElapsed());
  }, [paused, elapsedSeconds, lastActiveTime]);

  useEffect(() => {
    if (paused || !lastActiveTime) return;

    const interval = setInterval(() => {
      setElapsed(getElapsed());
    }, 1000);

    return () => clearInterval(interval);
  }, [paused, elapsedSeconds, lastActiveTime]);

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
  };

  return <Text variant="titleLarge" style={styles.timerText}>{formatTime(elapsed)}</Text>;
};

// Editable Set Row Component
const SetRow = ({
  set,
  index,
  exType,
  theme,
  onUpdate,
  onToggleComplete,
  onDelete,
}: {
  set: any;
  index: number;
  exType: string;
  theme: any;
  onUpdate: (setId: string, field: string, value: string) => void;
  onToggleComplete: (setId: string, current: boolean) => void;
  onDelete: (setId: string) => void;
}) => {
  const [weight, setWeight] = useState(set.weight != null ? String(set.weight) : '');
  const [reps, setReps] = useState(set.reps != null ? String(set.reps) : '');
  const [time, setTime] = useState(set.timeSeconds != null ? String(set.timeSeconds) : '');

  return (
    <View style={styles.setRow}>
      <Text style={[styles.setIndex, { color: theme.colors.outline }]}>{index + 1}</Text>

      {exType === 'weight_reps' && (
        <>
          <TextInput
            style={styles.setInput}
            mode="outlined"
            dense
            keyboardType="numeric"
            value={weight}
            onChangeText={setWeight}
            onBlur={() => onUpdate(set.id, 'weight', weight)}
            placeholder="kg"
            right={<TextInput.Affix text="kg" />}
            selectTextOnFocus
          />
          <TextInput
            style={styles.setInput}
            mode="outlined"
            dense
            keyboardType="numeric"
            value={reps}
            onChangeText={setReps}
            onBlur={() => onUpdate(set.id, 'reps', reps)}
            placeholder="reps"
            right={<TextInput.Affix text="reps" />}
            selectTextOnFocus
          />
        </>
      )}

      {exType === 'reps_only' && (
        <TextInput
          style={[styles.setInput, { flex: 2 }]}
          mode="outlined"
          dense
          keyboardType="numeric"
          value={reps}
          onChangeText={setReps}
          onBlur={() => onUpdate(set.id, 'reps', reps)}
          placeholder="reps"
          right={<TextInput.Affix text="reps" />}
          selectTextOnFocus
        />
      )}

      {exType === 'time_based' && (
        <TextInput
          style={[styles.setInput, { flex: 2 }]}
          mode="outlined"
          dense
          keyboardType="numeric"
          value={time}
          onChangeText={setTime}
          onBlur={() => onUpdate(set.id, 'time', time)}
          placeholder="sec"
          right={<TextInput.Affix text="sec" />}
          selectTextOnFocus
        />
      )}

      <IconButton
        icon={set.completed ? 'check-circle' : 'circle-outline'}
        iconColor={set.completed ? theme.colors.primary : theme.colors.outline}
        size={24}
        onPress={() => onToggleComplete(set.id, set.completed)}
      />
      <IconButton
        icon="close"
        iconColor={theme.colors.error}
        size={18}
        onPress={() => onDelete(set.id)}
      />
    </View>
  );
};

export default function WorkoutScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { activeWorkoutId, startTime, endWorkout } = useWorkoutStore();

  const [workout, setWorkout] = useState<any>(null);
  const [activeExercises, setActiveExercises] = useState<any[]>([]);
  const [exerciseOptions, setExerciseOptions] = useState<any[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (!activeWorkoutId) {
        router.replace('/');
        return;
      }
      
      const init = async () => {
        const currentWorkout = await loadWorkoutData();
        if (currentWorkout && currentWorkout.status === 'active') {
          if (currentWorkout.paused) {
            pauseWorkoutNotification(currentWorkout.elapsedSeconds || 0);
          } else {
            const startTimeMs = (currentWorkout.lastActiveTime || Date.now()) - (currentWorkout.elapsedSeconds || 0) * 1000;
            startWorkoutNotification(startTimeMs);
          }
        }
      };

      init();
      loadExerciseLibrary();
    }, [activeWorkoutId])
  );

  const loadWorkoutData = async () => {
    if (!activeWorkoutId) return null;

    // Load workout general info
    const wResult = await db.select().from(workouts).where(eq(workouts.id, activeWorkoutId));
    let currentWorkout = null;
    if (wResult.length > 0) {
      currentWorkout = wResult[0];
      setWorkout(currentWorkout);
    }

    const data = await db
      .select({
        weId: workoutExercises.id,
        exId: exercises.id,
        exName: exercises.name,
        exType: exercises.type,
        defaultReps: exercises.defaultReps,
        defaultWeight: exercises.defaultWeight,
        defaultTime: exercises.defaultTimeSeconds,
        orderIndex: workoutExercises.orderIndex,
      })
      .from(workoutExercises)
      .innerJoin(exercises, eq(workoutExercises.exerciseId, exercises.id))
      .where(eq(workoutExercises.workoutId, activeWorkoutId))
      .orderBy(asc(workoutExercises.orderIndex));

    // Fetch sets for each (order sets by createdAt)
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

    setActiveExercises(fullData);
    return currentWorkout;
  };

  const loadExerciseLibrary = async () => {
    const data = await db.select().from(exercises);
    setExerciseOptions(data);
  };

  const handleAddExerciseToWorkout = async (exercise: any) => {
    if (!activeWorkoutId) return;

    const weId = crypto.randomUUID();
    await db.insert(workoutExercises).values({
      id: weId,
      workoutId: activeWorkoutId,
      exerciseId: exercise.id,
      orderIndex: activeExercises.length,
    });

    setShowPicker(false);
    loadWorkoutData();
  };

  const handleRemoveExerciseFromWorkout = (we: any) => {
    Alert.alert('Remove Exercise', `Remove "${we.exName}" and all its sets from this workout?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          // Cascade delete will remove sets
          await db.delete(workoutExercises).where(eq(workoutExercises.id, we.weId));
          loadWorkoutData();
        },
      },
    ]);
  };

  const handleAddSet = async (we: any) => {
    let reps = we.defaultReps;
    let weight = we.defaultWeight;
    let timeSeconds = we.defaultTime;

    if (we.sets && we.sets.length > 0) {
      const lastSet = we.sets[we.sets.length - 1];
      reps = lastSet.reps;
      weight = lastSet.weight;
      timeSeconds = lastSet.timeSeconds;
    }

    await db.insert(sets).values({
      id: crypto.randomUUID(),
      workoutExerciseId: we.weId,
      reps,
      weight,
      timeSeconds,
      createdAt: Date.now(),
    });
    loadWorkoutData();
  };

  const handleUpdateSet = async (setId: string, field: string, value: string) => {
    const numValue = value ? parseFloat(value) : null;
    let updateData: any = {};

    switch (field) {
      case 'weight':
        updateData = { weight: numValue };
        break;
      case 'reps':
        updateData = { reps: numValue != null ? Math.round(numValue) : null };
        break;
      case 'time':
        updateData = { timeSeconds: numValue != null ? Math.round(numValue) : null };
        break;
    }

    await db.update(sets).set(updateData).where(eq(sets.id, setId));
    // Don't reload — the local state in SetRow is already updated via onChangeText
  };

  const handleDeleteSet = async (setId: string) => {
    await db.delete(sets).where(eq(sets.id, setId));
    loadWorkoutData();
  };

  const toggleSetComplete = async (setId: string, current: boolean) => {
    await db.update(sets).set({ completed: !current }).where(eq(sets.id, setId));
    loadWorkoutData();
  };

  const toggleAllSetsComplete = async (we: any, completed: boolean) => {
    await db
      .update(sets)
      .set({ completed })
      .where(eq(sets.workoutExerciseId, we.weId));
    loadWorkoutData();
  };

  const handleTogglePause = async () => {
    if (!workout) return;

    const now = Date.now();
    let newPaused = !workout.paused;
    let newElapsedSeconds = workout.elapsedSeconds || 0;

    if (newPaused) {
      const delta = workout.lastActiveTime
        ? Math.floor((now - workout.lastActiveTime) / 1000)
        : 0;
      newElapsedSeconds += delta > 0 ? delta : 0;
    }

    await db
      .update(workouts)
      .set({
        paused: newPaused,
        elapsedSeconds: newElapsedSeconds,
        lastActiveTime: newPaused ? null : now,
      })
      .where(eq(workouts.id, workout.id));

    if (newPaused) {
      pauseWorkoutNotification(newElapsedSeconds);
    } else {
      const startTimeMs = now - newElapsedSeconds * 1000;
      startWorkoutNotification(startTimeMs);
    }

    loadWorkoutData();
  };

  const handleMoveExercise = async (we: any, direction: 'up' | 'down') => {
    const currentIndex = activeExercises.findIndex((item) => item.weId === we.weId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= activeExercises.length) return;

    const currentItem = activeExercises[currentIndex];
    const targetItem = activeExercises[targetIndex];

    await db
      .update(workoutExercises)
      .set({ orderIndex: targetItem.orderIndex })
      .where(eq(workoutExercises.id, currentItem.weId));

    await db
      .update(workoutExercises)
      .set({ orderIndex: currentItem.orderIndex })
      .where(eq(workoutExercises.id, targetItem.weId));

    loadWorkoutData();
  };

  const handleFinishWorkout = () => {
    Alert.alert('Finish Workout', 'Are you sure you want to finish this workout?', [
      { text: 'Keep Going', style: 'cancel' },
      {
        text: 'Finish',
        onPress: async () => {
          if (!activeWorkoutId) return;

          const now = Date.now();
          let finalElapsed = workout?.elapsedSeconds || 0;
          if (workout && !workout.paused && workout.lastActiveTime) {
            const delta = Math.floor((now - workout.lastActiveTime) / 1000);
            finalElapsed += delta > 0 ? delta : 0;
          }

          await db
            .update(workouts)
            .set({
              endTime: now,
              status: 'completed',
              paused: false,
              elapsedSeconds: finalElapsed,
            })
            .where(eq(workouts.id, activeWorkoutId));

          stopWorkoutNotification();
          endWorkout();
          router.replace('/');
        },
      },
    ]);
  };

  const handleCancelWorkout = () => {
    Alert.alert(
      'Cancel Workout',
      'This will discard the workout and all logged sets. Are you sure?',
      [
        { text: 'Keep Going', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            if (!activeWorkoutId) return;
            // Cascade deletes will handle workout_exercises and sets
            await db.delete(workouts).where(eq(workouts.id, activeWorkoutId));
            stopWorkoutNotification();
            endWorkout();
            router.replace('/');
          },
        },
      ]
    );
  };

  if (!activeWorkoutId || !startTime) return null;

  const filteredExercises = exerciseOptions.filter((ex) =>
    ex.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '',
          headerTitleAlign: 'center',
          headerTitle: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Timer
                paused={workout?.paused}
                elapsedSeconds={workout?.elapsedSeconds}
                lastActiveTime={workout?.lastActiveTime}
              />
              {workout && (
                <IconButton
                  icon={workout.paused ? 'play-circle-outline' : 'pause-circle-outline'}
                  iconColor={theme.colors.primary}
                  size={20}
                  onPress={handleTogglePause}
                  style={{ margin: 0 }}
                />
              )}
            </View>
          ),
          headerLeft: () => (
            <Button
              mode="text"
              onPress={handleCancelWorkout}
              textColor={theme.colors.error}
              compact
            >
              Cancel
            </Button>
          ),
          headerRight: () => (
            <Button
              mode="contained"
              onPress={handleFinishWorkout}
              buttonColor={theme.colors.primary}
              compact
              labelStyle={{ fontSize: 13 }}
              style={{ marginRight: 8 }}
            >
              Finish
            </Button>
          ),
        }}
      />
      <ScrollView style={styles.scroll}>
        {showPicker ? (
          <View style={styles.pickerContainer}>
            <Text variant="titleMedium" style={{ marginBottom: 10 }}>
              Select Exercise
            </Text>
            <Searchbar
              placeholder="Search exercises..."
              onChangeText={setSearchQuery}
              value={searchQuery}
              style={{ marginBottom: 12 }}
            />
            <Button
              mode="contained-tonal"
              icon="plus"
              onPress={() => {
                setShowPicker(false);
                setSearchQuery('');
                router.push({
                  pathname: '/exercise-modal',
                  params: { activeWorkoutId },
                });
              }}
              style={{ marginBottom: 12 }}
            >
              Create New Exercise
            </Button>
            {filteredExercises.length === 0 ? (
              <View style={styles.emptyPicker}>
                <Text style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12, textAlign: 'center' }}>
                  No exercises found.
                </Text>
              </View>
            ) : (
              filteredExercises.map((ex) => (
                <Button
                  key={ex.id}
                  mode="outlined"
                  style={styles.pickerItem}
                  onPress={() => {
                    setSearchQuery('');
                    handleAddExerciseToWorkout(ex);
                  }}
                >
                  {ex.name}
                </Button>
              ))
            )}
            <Button
              onPress={() => {
                setSearchQuery('');
                setShowPicker(false);
              }}
              style={{ marginTop: 8 }}
            >
              Cancel
            </Button>
          </View>
        ) : (
          <View>
            {activeExercises.length === 0 && (
              <Text
                style={{
                  textAlign: 'center',
                  marginTop: 40,
                  marginBottom: 20,
                  color: theme.colors.onSurfaceVariant,
                }}
              >
                No exercises added yet. Tap below to get started!
              </Text>
            )}

            {activeExercises.map((we) => {
              const isAllComplete = we.sets.length > 0 && we.sets.every((s: any) => s.completed);
              return (
                <Card key={we.weId} style={styles.exerciseCard}>
                  <Card.Title
                    title={we.exName}
                    subtitle={formatExerciseType(we.exType)}
                    right={(props) => (
                      <View style={styles.cardActions}>
                        <IconButton
                          {...props}
                          icon={isAllComplete ? 'check-circle' : 'circle-outline'}
                          iconColor={isAllComplete ? theme.colors.primary : theme.colors.outline}
                          onPress={() => toggleAllSetsComplete(we, !isAllComplete)}
                        />
                        <IconButton
                          {...props}
                          icon="arrow-up"
                          onPress={() => handleMoveExercise(we, 'up')}
                          disabled={activeExercises.indexOf(we) === 0}
                        />
                        <IconButton
                          {...props}
                          icon="arrow-down"
                          onPress={() => handleMoveExercise(we, 'down')}
                          disabled={activeExercises.indexOf(we) === activeExercises.length - 1}
                        />
                        <IconButton
                          {...props}
                          icon="delete-outline"
                          iconColor={theme.colors.error}
                          onPress={() => handleRemoveExerciseFromWorkout(we)}
                        />
                      </View>
                    )}
                  />
                  <Card.Content>
                    {we.sets.map((set: any, index: number) => (
                      <SetRow
                        key={set.id}
                        set={set}
                        index={index}
                        exType={we.exType}
                        theme={theme}
                        onUpdate={handleUpdateSet}
                        onToggleComplete={toggleSetComplete}
                        onDelete={handleDeleteSet}
                      />
                    ))}
                    <Button mode="text" icon="plus" onPress={() => handleAddSet(we)}>
                      Add Set
                    </Button>
                  </Card.Content>
                </Card>
              );
            })}

            <Button
              mode="contained-tonal"
              icon="plus"
              style={styles.addExerciseBtn}
              onPress={() => {
                loadExerciseLibrary(); // Refresh library in case new ones were added
                setShowPicker(true);
              }}
            >
              Add Exercise
            </Button>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  timerText: { fontWeight: 'bold' },
  scroll: { flex: 1, padding: 16 },
  addExerciseBtn: { marginVertical: 20 },
  exerciseCard: { marginBottom: 16 },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  setIndex: { width: 24, fontWeight: 'bold', textAlign: 'center' },
  setInput: { flex: 1, marginHorizontal: 4, height: 40 },
  pickerContainer: { padding: 10 },
  pickerItem: { marginBottom: 10 },
  emptyPicker: { alignItems: 'center', paddingVertical: 20 },
  cardActions: { flexDirection: 'row', alignItems: 'center' },
});
