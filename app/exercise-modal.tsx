import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, ScrollView } from 'react-native';
import { TextInput, Button, SegmentedButtons, useTheme, Text } from 'react-native-paper';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { db } from '../db';
import { exercises, workoutExercises } from '../db/schema';
import { eq } from 'drizzle-orm';
import * as crypto from 'expo-crypto';
import { saveExerciseLogic } from '../utils/exerciseUtils';

export default function ExerciseModal() {
  const router = useRouter();
  const theme = useTheme();
  const { exerciseId, activeWorkoutId } = useLocalSearchParams<{ exerciseId?: string; activeWorkoutId?: string }>();
  const isEditing = !!exerciseId;

  const [name, setName] = useState('');
  const [type, setType] = useState('weight_reps');
  const [defaultWeight, setDefaultWeight] = useState('');
  const [defaultReps, setDefaultReps] = useState('');
  const [defaultTime, setDefaultTime] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isEditing) {
      loadExercise();
    }
  }, [exerciseId]);

  const loadExercise = async () => {
    if (!exerciseId) return;
    try {
      const result = await db.select().from(exercises).where(eq(exercises.id, exerciseId));
      if (result.length > 0) {
        const ex = result[0];
        setName(ex.name);
        setType(ex.type);
        setDefaultWeight(ex.defaultWeight != null ? String(ex.defaultWeight) : '');
        setDefaultReps(ex.defaultReps != null ? String(ex.defaultReps) : '');
        setDefaultTime(ex.defaultTimeSeconds != null ? String(ex.defaultTimeSeconds) : '');
      }
    } catch (e) {
      console.error('Failed to load exercise:', e);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Exercise name is required.');
      return;
    }

    setLoading(true);
    try {
      await saveExerciseLogic({
        name,
        type,
        defaultWeight: defaultWeight ? parseFloat(defaultWeight) : null,
        defaultReps: defaultReps ? parseInt(defaultReps) : null,
        defaultTimeSeconds: defaultTime ? parseInt(defaultTime) : null,
        activeWorkoutId,
        isEditing,
        exerciseId,
        db,
        exercisesTable: exercises,
        workoutExercisesTable: workoutExercises,
        eqFn: eq,
        uuidFn: crypto.randomUUID,
      });

      router.back();
    } catch (e) {
      console.error('Failed to save exercise:', e);
      Alert.alert('Error', 'Failed to save exercise. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!exerciseId) return;

    Alert.alert(
      'Delete Exercise',
      `Are you sure you want to delete "${name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await db.delete(exercises).where(eq(exercises.id, exerciseId));
              router.back();
            } catch (e: any) {
              if (e?.message?.includes('FOREIGN KEY')) {
                Alert.alert(
                  'Cannot Delete',
                  'This exercise is used in one or more workouts. Remove it from those workouts first.'
                );
              } else {
                Alert.alert('Error', 'Failed to delete exercise.');
                console.error(e);
              }
            }
          },
        },
      ]
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: isEditing ? 'Edit Exercise' : 'Add Exercise' }} />
      <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <TextInput
          label="Exercise Name"
          mode="outlined"
          value={name}
          onChangeText={setName}
          style={styles.input}
        />

        <SegmentedButtons
          value={type}
          onValueChange={setType}
          buttons={[
            { value: 'weight_reps', label: 'Weight/Reps' },
            { value: 'reps_only', label: 'Reps Only' },
            { value: 'time_based', label: 'Time Based' },
          ]}
          style={styles.segmented}
        />

        {type === 'weight_reps' && (
          <>
            <TextInput
              label="Default Weight (kg)"
              mode="outlined"
              keyboardType="numeric"
              value={defaultWeight}
              onChangeText={setDefaultWeight}
              style={styles.input}
            />
            <TextInput
              label="Default Reps"
              mode="outlined"
              keyboardType="numeric"
              value={defaultReps}
              onChangeText={setDefaultReps}
              style={styles.input}
            />
          </>
        )}

        {type === 'reps_only' && (
          <TextInput
            label="Default Reps"
            mode="outlined"
            keyboardType="numeric"
            value={defaultReps}
            onChangeText={setDefaultReps}
            style={styles.input}
          />
        )}

        {type === 'time_based' && (
          <TextInput
            label="Default Time (sec)"
            mode="outlined"
            keyboardType="numeric"
            value={defaultTime}
            onChangeText={setDefaultTime}
            style={styles.input}
          />
        )}

        <Button
          mode="contained"
          onPress={handleSave}
          style={styles.saveButton}
          loading={loading}
          disabled={loading}
        >
          {isEditing ? 'Update Exercise' : 'Save Exercise'}
        </Button>

        <Button mode="text" onPress={() => router.back()} style={styles.cancelButton}>
          Cancel
        </Button>

        {isEditing && (
          <Button
            mode="outlined"
            onPress={handleDelete}
            style={styles.deleteButton}
            textColor={theme.colors.error}
          >
            Delete Exercise
          </Button>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  input: { marginBottom: 15 },
  segmented: { marginBottom: 20 },
  saveButton: { marginTop: 10 },
  cancelButton: { marginTop: 10 },
  deleteButton: { marginTop: 30, borderColor: '#d32f2f' },
});
