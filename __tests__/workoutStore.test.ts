import { useWorkoutStore } from '../store/workoutStore';

describe('workoutStore', () => {
  beforeEach(() => {
    useWorkoutStore.getState().endWorkout();
  });

  it('starts a workout correctly', () => {
    const startTime = Date.now();
    useWorkoutStore.getState().startWorkout('test-id', startTime);

    const state = useWorkoutStore.getState();
    expect(state.activeWorkoutId).toBe('test-id');
    expect(state.startTime).toBe(startTime);
    expect(state.timerActive).toBe(true);
    expect(state.workoutDurationSeconds).toBe(0);
  });

  it('ends a workout correctly', () => {
    useWorkoutStore.getState().startWorkout('test-id', Date.now());
    useWorkoutStore.getState().endWorkout();

    const state = useWorkoutStore.getState();
    expect(state.activeWorkoutId).toBeNull();
    expect(state.startTime).toBeNull();
    expect(state.timerActive).toBe(false);
    expect(state.workoutDurationSeconds).toBe(0);
  });

  it('increments the workout timer duration seconds', () => {
    useWorkoutStore.getState().startWorkout('test-id', Date.now());
    useWorkoutStore.getState().incrementTimer();

    expect(useWorkoutStore.getState().workoutDurationSeconds).toBe(1);

    useWorkoutStore.getState().incrementTimer();
    expect(useWorkoutStore.getState().workoutDurationSeconds).toBe(2);
  });

  it('resumes a workout session correctly', () => {
    const startTime = Date.now() - 60000;
    useWorkoutStore.getState().resumeWorkout('resume-id', startTime, 60);

    const state = useWorkoutStore.getState();
    expect(state.activeWorkoutId).toBe('resume-id');
    expect(state.startTime).toBe(startTime);
    expect(state.timerActive).toBe(true);
    expect(state.workoutDurationSeconds).toBe(60);
  });
});
