import { create } from 'zustand';


// Define types for the Zustand store
interface BucketStore {
  selectedBucket: string;
  setSelectedBucket: (newBucket: string) => void;
}

// Define Zustand store for bucket state
export const useBucketStore = create<BucketStore>( (set) => ({
  selectedBucket: 'default',
  setSelectedBucket: (newBucket: string) => set({ selectedBucket: newBucket }),
}));
