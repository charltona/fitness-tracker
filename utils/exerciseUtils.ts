/**
 * Maps internal exercise type identifiers to human-readable labels.
 */
export function formatExerciseType(type: string): string {
  switch (type) {
    case 'weight_reps':
      return 'Weight & Reps';
    case 'reps_only':
      return 'Reps Only';
    case 'time_based':
      return 'Time Based';
    default:
      return type;
  }
}

/**
 * Formats an exercise's default values into a readable summary string.
 */
export function formatExerciseDefaults(exercise: {
  type: string;
  defaultWeight?: number | null;
  defaultReps?: number | null;
  defaultTimeSeconds?: number | null;
}): string {
  switch (exercise.type) {
    case 'weight_reps': {
      const parts: string[] = [];
      if (exercise.defaultWeight != null) parts.push(`${exercise.defaultWeight}kg`);
      if (exercise.defaultReps != null) parts.push(`${exercise.defaultReps} reps`);
      return parts.length > 0 ? parts.join(' × ') : 'No defaults set';
    }
    case 'reps_only':
      return exercise.defaultReps != null ? `${exercise.defaultReps} reps` : 'No defaults set';
    case 'time_based':
      return exercise.defaultTimeSeconds != null ? `${exercise.defaultTimeSeconds} sec` : 'No defaults set';
    default:
      return '';
  }
}

/**
 * Formats a duration in seconds to a human-readable string like "45m" or "1h 12m".
 */
export function formatDuration(elapsedSeconds: number | null, status?: string): string {
  if (status === 'active' || elapsedSeconds == null) return 'In progress';
  const totalMinutes = Math.floor(elapsedSeconds / 60);
  if (totalMinutes < 1) return '<1m';
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

/**
 * Handles saving/updating exercises and linking them to active workouts.
 */
export async function saveExerciseLogic({
  name,
  type,
  defaultWeight,
  defaultReps,
  defaultTimeSeconds,
  activeWorkoutId,
  isEditing,
  exerciseId,
  db,
  exercisesTable,
  workoutExercisesTable,
  eqFn,
  uuidFn,
}: {
  name: string;
  type: string;
  defaultWeight?: number | null;
  defaultReps?: number | null;
  defaultTimeSeconds?: number | null;
  activeWorkoutId?: string;
  isEditing: boolean;
  exerciseId?: string;
  db: any;
  exercisesTable: any;
  workoutExercisesTable: any;
  eqFn: any;
  uuidFn: () => string;
}) {
  const values = {
    name: name.trim(),
    type,
    defaultWeight: defaultWeight || null,
    defaultReps: defaultReps || null,
    defaultTimeSeconds: defaultTimeSeconds || null,
  };

  if (isEditing && exerciseId) {
    await db.update(exercisesTable).set(values).where(eqFn(exercisesTable.id, exerciseId));
  } else {
    const newExerciseId = uuidFn();
    await db.insert(exercisesTable).values({
      id: newExerciseId,
      ...values,
      createdAt: Date.now(),
    });

    if (activeWorkoutId) {
      const existing = await db
        .select()
        .from(workoutExercisesTable)
        .where(eqFn(workoutExercisesTable.workoutId, activeWorkoutId));

      await db.insert(workoutExercisesTable).values({
        id: uuidFn(),
        workoutId: activeWorkoutId,
        exerciseId: newExerciseId,
        orderIndex: existing.length,
      });
    }
  }
}
