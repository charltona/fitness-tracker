import React, { useState, useMemo } from 'react';
import { View, StyleSheet, FlatList, Alert } from 'react-native';
import { Text, FAB, Card, useTheme, IconButton, Searchbar, Chip } from 'react-native-paper';
import { db } from '../../db';
import { exercises } from '../../db/schema';
import { useRouter } from 'expo-router';
import { eq } from 'drizzle-orm';
import { formatExerciseType, formatExerciseDefaults } from '../../utils/exerciseUtils';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

export default function LibraryScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'type' | 'recent'>('name');

  const { data: exerciseList } = useLiveQuery(db.select().from(exercises));

  const handleDeleteExercise = (exercise: any) => {
    Alert.alert(
      'Delete Exercise',
      `Are you sure you want to delete "${exercise.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await db.delete(exercises).where(eq(exercises.id, exercise.id));
            } catch (e: any) {
              // Foreign key constraint — exercise is used in a workout
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

  const handleEditExercise = (exerciseId: string) => {
    router.push({ pathname: '/exercise-modal', params: { exerciseId } });
  };

  const processedList = useMemo(() => {
    if (!exerciseList) return [];

    let list = exerciseList.filter((ex) =>
      ex.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (sortBy === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'type') {
      list.sort((a, b) => a.type.localeCompare(b.type));
    } else if (sortBy === 'recent') {
      list.sort((a, b) => b.createdAt - a.createdAt);
    }

    return list;
  }, [exerciseList, searchQuery, sortBy]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Searchbar
        placeholder="Search exercises..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchbar}
      />
      <View style={styles.chipContainer}>
        <Text style={styles.sortByText}>Sort by:</Text>
        <Chip
          selected={sortBy === 'name'}
          onPress={() => setSortBy('name')}
          style={styles.chip}
          showSelectedOverlay
        >
          A-Z
        </Chip>
        <Chip
          selected={sortBy === 'type'}
          onPress={() => setSortBy('type')}
          style={styles.chip}
          showSelectedOverlay
        >
          Type
        </Chip>
        <Chip
          selected={sortBy === 'recent'}
          onPress={() => setSortBy('recent')}
          style={styles.chip}
          showSelectedOverlay
        >
          Recent
        </Chip>
      </View>

      <FlatList
        data={processedList}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Card style={styles.card} onPress={() => handleEditExercise(item.id)}>
            <Card.Title
              title={item.name}
              subtitle={`${formatExerciseType(item.type)} · ${formatExerciseDefaults(item)}`}
              right={(props) => (
                <View style={styles.cardActions}>
                  <IconButton
                    {...props}
                    icon="delete-outline"
                    iconColor={theme.colors.error}
                    onPress={() => handleDeleteExercise(item)}
                  />
                  <IconButton {...props} icon="chevron-right" onPress={() => handleEditExercise(item.id)} />
                </View>
              )}
            />
          </Card>
        )}
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', marginTop: 40, color: theme.colors.onSurfaceVariant }}>
            {searchQuery ? 'No matching exercises found.' : 'No exercises found. Add some to get started!'}
          </Text>
        }
      />
      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primaryContainer }]}
        onPress={() => router.push('/exercise-modal')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchbar: { margin: 16, marginBottom: 8 },
  chipContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8, gap: 8 },
  sortByText: { fontSize: 14, marginRight: 4 },
  chip: { height: 32 },
  list: { padding: 16, paddingBottom: 100 },
  card: { marginBottom: 12 },
  fab: { position: 'absolute', margin: 16, right: 0, bottom: 0 },
  cardActions: { flexDirection: 'row', alignItems: 'center' },
});

