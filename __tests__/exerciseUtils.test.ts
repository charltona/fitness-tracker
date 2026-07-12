import { formatExerciseType, formatExerciseDefaults, formatDuration, saveExerciseLogic } from '../utils/exerciseUtils';

describe('exerciseUtils', () => {
  describe('formatExerciseType', () => {
    it('returns formatted label for weight_reps', () => {
      expect(formatExerciseType('weight_reps')).toBe('Weight & Reps');
    });

    it('returns formatted label for reps_only', () => {
      expect(formatExerciseType('reps_only')).toBe('Reps Only');
    });

    it('returns formatted label for time_based', () => {
      expect(formatExerciseType('time_based')).toBe('Time Based');
    });

    it('returns raw type string for unknown types', () => {
      expect(formatExerciseType('unknown')).toBe('unknown');
    });
  });

  describe('formatExerciseDefaults', () => {
    it('formats weight and reps defaults correctly', () => {
      expect(
        formatExerciseDefaults({
          type: 'weight_reps',
          defaultWeight: 60.5,
          defaultReps: 10,
        })
      ).toBe('60.5kg × 10 reps');
    });

    it('formats reps only defaults correctly', () => {
      expect(
        formatExerciseDefaults({
          type: 'reps_only',
          defaultReps: 15,
        })
      ).toBe('15 reps');
    });

    it('formats time based defaults correctly', () => {
      expect(
        formatExerciseDefaults({
          type: 'time_based',
          defaultTimeSeconds: 45,
        })
      ).toBe('45 sec');
    });

    it('returns fallback string when defaults are missing', () => {
      expect(formatExerciseDefaults({ type: 'weight_reps' })).toBe('No defaults set');
      expect(formatExerciseDefaults({ type: 'reps_only' })).toBe('No defaults set');
      expect(formatExerciseDefaults({ type: 'time_based' })).toBe('No defaults set');
    });
  });

  describe('formatDuration', () => {
    it('returns In progress if elapsed seconds is null', () => {
      expect(formatDuration(null)).toBe('In progress');
      expect(formatDuration(120, 'active')).toBe('In progress');
    });

    it('formats seconds less than a minute correctly', () => {
      expect(formatDuration(45, 'completed')).toBe('<1m');
    });

    it('formats minutes correctly', () => {
      expect(formatDuration(120, 'completed')).toBe('2m');
      expect(formatDuration(3599, 'completed')).toBe('59m');
    });

    it('formats hours and minutes correctly', () => {
      expect(formatDuration(3600, 'completed')).toBe('1h');
      expect(formatDuration(4500, 'completed')).toBe('1h 15m');
      expect(formatDuration(7200, 'completed')).toBe('2h');
    });
  });

  describe('saveExerciseLogic', () => {
    let mockDb: any;
    let mockExercisesTable: any;
    let mockWorkoutExercisesTable: any;
    let mockEqFn: any;
    let mockUuidFn: any;

    beforeEach(() => {
      mockDb = {
        update: jest.fn(() => ({
          set: jest.fn(() => ({
            where: jest.fn(() => Promise.resolve()),
          })),
        })),
        insert: jest.fn(() => ({
          values: jest.fn(() => Promise.resolve()),
        })),
        select: jest.fn(() => ({
          from: jest.fn(() => ({
            where: jest.fn(() => Promise.resolve([{ id: 'existing-we-id' }])),
          })),
        })),
      };
      mockExercisesTable = { id: 'ex-col-id' };
      mockWorkoutExercisesTable = { id: 'we-col-id', workoutId: 'we-workout-col-id' };
      mockEqFn = jest.fn((a, b) => `eq(${a}, ${b})`);
      mockUuidFn = jest.fn(() => 'new-uuid');
    });

    it('updates an existing exercise if isEditing is true', async () => {
      await saveExerciseLogic({
        name: 'Bench Press',
        type: 'weight_reps',
        defaultWeight: 80,
        defaultReps: 8,
        isEditing: true,
        exerciseId: 'old-ex-id',
        db: mockDb,
        exercisesTable: mockExercisesTable,
        workoutExercisesTable: mockWorkoutExercisesTable,
        eqFn: mockEqFn,
        uuidFn: mockUuidFn,
      });

      expect(mockDb.update).toHaveBeenCalledWith(mockExercisesTable);
      expect(mockEqFn).toHaveBeenCalledWith(mockExercisesTable.id, 'old-ex-id');
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('inserts a new exercise and links it to activeWorkoutId if provided', async () => {
      await saveExerciseLogic({
        name: 'Deadlift',
        type: 'weight_reps',
        defaultWeight: 140,
        defaultReps: 5,
        activeWorkoutId: 'active-workout-id',
        isEditing: false,
        db: mockDb,
        exercisesTable: mockExercisesTable,
        workoutExercisesTable: mockWorkoutExercisesTable,
        eqFn: mockEqFn,
        uuidFn: mockUuidFn,
      });

      // Assert exercise insert
      expect(mockDb.insert).toHaveBeenNthCalledWith(1, mockExercisesTable);

      // Assert linking mapping insert
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenNthCalledWith(2, mockWorkoutExercisesTable);
    });
  });
});
