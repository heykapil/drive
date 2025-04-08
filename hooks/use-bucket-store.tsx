'use client'
import { useEffect } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface BucketStore {
  selectedBucket: string;
  setSelectedBucket: (newBucket: string) => void;
  // accessCode: string | null;
  // setAccessCode: (code: string) => void;
  // clearSession: () => void;
  isAuthenticated: boolean;
  setIsAuthenticated: (auth: boolean) => void;
}

export const useBucketStore = create<BucketStore>()(
  persist(
    (set) => ({
      selectedBucket: 'default',
      setSelectedBucket: (newBucket: string) => set({ selectedBucket: newBucket }),
      // accessCode: null,
      // setAccessCode: (code: string) => set({ accessCode: code }),
      // clearSession: () => set({  accessCode: null })
      isAuthenticated: false,
      setIsAuthenticated: (auth: boolean) => set({ isAuthenticated: auth }),
    }),
    {
      name: 'bucket-store', // Unique name for the storage
      storage: createJSONStorage(() => sessionStorage), // Use sessionStorage
    }
  )
);

export function HydrationZustand() {
  useEffect(() => {
    useBucketStore.persist.rehydrate();
  }, []);

  return null;
}
