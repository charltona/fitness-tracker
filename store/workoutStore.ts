import { create } from 'zustand';

interface WorkoutState {
  activeWorkoutId: string | null;
  startTime: number | null;
  workoutDurationSeconds: number; // For the sticky timer
  timerActive: boolean;
  startWorkout: (id: string, startTime: number) => void;
  endWorkout: () => void;
  incrementTimer: () => void;
  resumeWorkout: (id: string, startTime: number, currentDuration: number) => void;
}

export const useWorkoutStore = create<WorkoutState>((set) => ({
  activeWorkoutId: null,
  startTime: null,
  workoutDurationSeconds: 0,
  timerActive: false,
  startWorkout: (id, startTime) => 
    set({ activeWorkoutId: id, startTime, timerActive: true, workoutDurationSeconds: 0 }),
  endWorkout: () => 
    set({ activeWorkoutId: null, startTime: null, timerActive: false, workoutDurationSeconds: 0 }),
  incrementTimer: () => 
    set((state) => ({ workoutDurationSeconds: state.workoutDurationSeconds + 1 })),
  resumeWorkout: (id, startTime, currentDuration) => 
    set({ activeWorkoutId: id, startTime, timerActive: true, workoutDurationSeconds: currentDuration }),
}));
