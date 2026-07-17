import React, { useState } from 'react';
import { View, StyleSheet, Alert, ScrollView } from 'react-native';
import { Text, TextInput, Button, useTheme, Divider } from 'react-native-paper';
import { db } from '../../db';
import { exercises, workouts, workoutExercises, sets } from '../../db/schema';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

export default function SettingsScreen() {
  const theme = useTheme();
  const [geminiKey, setGeminiKey] = useState('');
  const [loading, setLoading] = useState(false);

  const handleExportBackup = async () => {
    setLoading(true);
    try {
      // Query all tables
      const allExercises = await db.select().from(exercises);
      const allWorkouts = await db.select().from(workouts);
      const allWorkoutExercises = await db.select().from(workoutExercises);
      const allSets = await db.select().from(sets);

      const backupObj = {
        backupVersion: 1,
        exportedAt: Date.now(),
        exercises: allExercises,
        workouts: allWorkouts,
        workout_exercises: allWorkoutExercises,
        sets: allSets,
      };

      const backupStr = JSON.stringify(backupObj, null, 2);
      const file = new File(Paths.cache, 'legend_backup.json');

      await file.write(backupStr);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/json',
          dialogTitle: 'Export Workout Backup',
          UTI: 'public.json',
        });
      } else {
        Alert.alert('Error', 'Sharing is not available on this device');
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to export backup.');
    } finally {
      setLoading(false);
    }
  };

  const handleImportRestore = async () => {
    Alert.alert(
      'Restore Data',
      'This will clear your current workouts and exercises and replace them with the backup. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const res = await DocumentPicker.getDocumentAsync({
                type: 'application/json',
                copyToCacheDirectory: true,
              });

              if (res.canceled || !res.assets || res.assets.length === 0) {
                setLoading(false);
                return;
              }

              const fileUri = res.assets[0].uri;
              const importedFile = new File(fileUri);
              const content = await importedFile.text();
              const data = JSON.parse(content);

              if (!data.backupVersion || !Array.isArray(data.exercises) || !Array.isArray(data.workouts)) {
                Alert.alert('Error', 'Invalid backup file format.');
                setLoading(false);
                return;
              }

              await db.transaction(async (tx) => {
                // Delete existing data in topological order
                await tx.delete(sets);
                await tx.delete(workoutExercises);
                await tx.delete(workouts);
                await tx.delete(exercises);

                // Batch insert data
                if (data.exercises.length > 0) {
                  await tx.insert(exercises).values(data.exercises);
                }
                if (data.workouts.length > 0) {
                  await tx.insert(workouts).values(data.workouts);
                }
                if (data.workout_exercises && data.workout_exercises.length > 0) {
                  await tx.insert(workoutExercises).values(data.workout_exercises);
                }
                if (data.sets && data.sets.length > 0) {
                  await tx.insert(sets).values(data.sets);
                }
              });

              Alert.alert('Success', 'Backup restored successfully!');
            } catch (e) {
              console.error(e);
              Alert.alert('Error', 'Failed to restore backup. Please ensure it is a valid backup file.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text variant="headlineSmall" style={styles.title}>AI Integrations</Text>
      <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
        Configure your API keys for the stretch goals (Gemini image generation and muscle group analysis).
      </Text>
      
      <TextInput
        label="Gemini API Key"
        mode="outlined"
        secureTextEntry
        value={geminiKey}
        onChangeText={setGeminiKey}
        style={styles.input}
      />
      
      <Button mode="contained" onPress={() => {}} style={styles.button}>
        Save Settings
      </Button>

      <Divider style={styles.divider} />

      <Text variant="headlineSmall" style={styles.title}>Data Management</Text>
      <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
        Export your workouts and exercises library to a JSON file, or restore them from a previous backup.
      </Text>

      <View style={styles.dataButtons}>
        <Button
          mode="outlined"
          icon="export"
          onPress={handleExportBackup}
          loading={loading}
          disabled={loading}
          style={styles.dataBtn}
        >
          Export Backup
        </Button>
        <Button
          mode="contained-tonal"
          icon="import"
          onPress={handleImportRestore}
          loading={loading}
          disabled={loading}
          style={styles.dataBtn}
        >
          Import Restore
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontWeight: 'bold', marginBottom: 10 },
  subtitle: { marginBottom: 20 },
  input: { marginBottom: 20 },
  button: { marginTop: 10 },
  divider: { marginVertical: 30 },
  dataButtons: { flexDirection: 'column', gap: 12, paddingBottom: 40 },
  dataBtn: { flex: 1 },
});
