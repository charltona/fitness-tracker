import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const exercises = sqliteTable('exercises', {
  id: text('id').primaryKey(), // We'll use UUIDs
  name: text('name').notNull(),
  type: text('type').notNull(), // 'weight_reps', 'reps_only', 'time_based'
  defaultWeight: real('default_weight'),
  defaultReps: integer('default_reps'),
  defaultTimeSeconds: integer('default_time_seconds'),
  muscleGroups: text('muscle_groups'), // JSON string
  imageUri: text('image_uri'),
  createdAt: integer('created_at').notNull(), // Timestamp
});

export const workouts = sqliteTable('workouts', {
  id: text('id').primaryKey(),
  startTime: integer('start_time').notNull(),
  endTime: integer('end_time'),
  notes: text('notes'),
  status: text('status').notNull(), // 'active', 'completed'
  paused: integer('paused', { mode: 'boolean' }).notNull().default(false),
  elapsedSeconds: integer('elapsed_seconds').notNull().default(0),
  lastActiveTime: integer('last_active_time'),
});

export const workoutExercises = sqliteTable('workout_exercises', {
  id: text('id').primaryKey(),
  workoutId: text('workout_id').notNull().references(() => workouts.id, { onDelete: 'cascade' }),
  exerciseId: text('exercise_id').notNull().references(() => exercises.id, { onDelete: 'restrict' }),
  orderIndex: integer('order_index').notNull(),
});

export const sets = sqliteTable('sets', {
  id: text('id').primaryKey(),
  workoutExerciseId: text('workout_exercise_id').notNull().references(() => workoutExercises.id, { onDelete: 'cascade' }),
  reps: integer('reps'),
  weight: real('weight'),
  weightUnit: text('weight_unit').default('kg'),
  timeSeconds: integer('time_seconds'),
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
});
