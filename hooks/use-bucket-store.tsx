'use client'
import { Bucket, buildFolderTree, Folder, FolderNode } from '@/lib/utils';
import { useEffect } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface BucketState {
  // State for folder structure
  folderTree: FolderNode[];
  isLoading: boolean;
  error: string | null;
  fetchFolderTree: () => Promise<void>;

  // State for selected folder
  selectedFolderId: number | null;
  selectedFolderName: string;
  setSelectedFolder: (id: number, name: string) => void;

  // State for selected bucket
  selectedBucketId: number | null;
  selectedBucketName: string;
  setSelectedBucket: (id: number, name: string) => void;
}

export const useBucketStore = create<BucketState>()(
  persist(
    (set, get) => ({
      // Initial state
      folderTree: [],
      isLoading: true,
      error: null,
      selectedFolderId: 1,
      selectedFolderName: 'general',
      selectedBucketId: 9,
      selectedBucketName: 'cdn.kapil.app',

      // Action to set the selected bucket manually
      setSelectedBucket: (id: number, name: string) => set({
        selectedBucketId: id,
        selectedBucketName: name
      }),

      // --- CORRECTED ACTION ---
      // This action now correctly finds the folder and selects the best bucket.
      setSelectedFolder: (id: number, name: string) => {
        const { folderTree } = get();

        // 1. Find the folder node that the user clicked on in the tree.
        let startNode: FolderNode | null = null;
        const findStartNode = (nodes: FolderNode[]) => {
          for (const node of nodes) {
            if (startNode) return; // Optimization: stop searching once found
            // FIX: The property on the node is `folder_id`, not `id`.
            if (node.folder_id === id) {
              startNode = node;
              return;
            }
            if (node.children.length > 0) findStartNode(node.children);
          }
        };
        findStartNode(folderTree);


        // 2. Recursively find the bucket with the most available storage.
        let bestBucket: Bucket | null = null;
        if (startNode) {
          const traverse = (node: FolderNode) => {
            // Check buckets in the current folder
            node.buckets.forEach(bucket => {
              // FIX: Convert storage strings to numbers for correct numerical comparison.
              // This resolves both the wrong selection and the TypeScript 'never' type error.
              const currentBestStorage = bestBucket ? parseFloat(bestBucket.available_storage_gb as string) : -1;
              const candidateStorage = parseFloat(bucket.available_storage_gb as string);

              if (candidateStorage > currentBestStorage) {
                bestBucket = bucket;
              }
            });
            // Recurse into subfolders
            node.children.forEach(traverse);
          };
          traverse(startNode);
        }

        // 3. Update the state for BOTH the folder and the best bucket found.
        set({
          selectedFolderId: id,
          selectedFolderName: name,
          // @ts-ignore
          selectedBucketId: bestBucket ? bestBucket?.bucket_id : null,
          // @ts-ignore
          selectedBucketName: bestBucket ? bestBucket?.bucket_name : 'No buckets available',
        });
      },

      // Action to fetch and process folder data
      fetchFolderTree: async () => {
        if (get().folderTree.length > 0 && !get().isLoading) {
             return;
        }
        set({ isLoading: true, error: null });
        try {
          const [foldersResponse, bucketsResponse] = await Promise.all([
            fetch(process.env.NEXT_PUBLIC_APP_URL + '/api/folders/all'),
            fetch(process.env.NEXT_PUBLIC_APP_URL + '/api/buckets/postgres')
          ]);

          if (!foldersResponse.ok) throw new Error(`Failed to fetch folders: ${foldersResponse.statusText}`);
          if (!bucketsResponse.ok) throw new Error(`Failed to fetch buckets: ${bucketsResponse.statusText}`);

          const allFolders: Folder[] = await foldersResponse.json();
          const bucketData = await bucketsResponse.json();
          const tree = buildFolderTree(allFolders, bucketData.buckets);

          set({ folderTree: tree, isLoading: false });

        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
          set({ error: errorMessage, isLoading: false });
        }
      },
    }),
    {
      name: 'bucket-store',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        folderTree: state.folderTree,
        selectedFolderId: state.selectedFolderId,
        selectedFolderName: state.selectedFolderName,
        selectedBucketId: state.selectedBucketId,
        selectedBucketName: state.selectedBucketName,
      }),
    }
  )
);

// This component triggers the fetch action on the client side
export function BucketStoreInitializer() {
  useEffect(() => {
    // FIX: Wrap the rehydration and fetch logic in an async function
    // to correctly handle the void | Promise<void> return type.
    const rehydrateAndFetch = async () => {
      await useBucketStore.persist.rehydrate();
      useBucketStore.getState().fetchFolderTree();
    };

    rehydrateAndFetch();
  }, [])
  return null;
};


export function getBucketIdsFromFolderId(folderId: number): number[] {
  const { folderTree } = useBucketStore.getState();
  const bucketIds: number[] = [];

  // 1. Find the starting folder node in the tree.
  let startNode: FolderNode | null = null;
  const findStartNode = (nodes: FolderNode[]) => {
    for (const node of nodes) {
      if (startNode) return; // Optimization
      if (node.folder_id === folderId) {
        startNode = node;
        return;
      }
      if (node.children.length > 0) findStartNode(node.children);
    }
  };
  findStartNode(folderTree);

  // 2. If the folder is found, traverse it and its children to collect bucket IDs.
  if (startNode) {
    const traverse = (node: FolderNode) => {
      // Add bucket IDs from the current node
      node.buckets.forEach(bucket => bucketIds.push(bucket.bucket_id));
      // Recurse into children
      node.children.forEach(traverse);
    };
    traverse(startNode);
  }

  return bucketIds;
}

/**
 * Finds and returns the complete information for a specific bucket by its ID.
 *
 * @param bucketId The ID of the bucket to find.
 * @returns The full Bucket object if found, otherwise null.
 */
export function getBucketInfo(bucketId: number): Bucket | null {
  const { folderTree } = useBucketStore.getState();
  let foundBucket: Bucket | null = null;

  const traverse = (nodes: FolderNode[]) => {
    for (const node of nodes) {
      if (foundBucket) return; // Optimization

      // Search for the bucket in the current node's bucket list
      const bucket = node.buckets.find(b => b.bucket_id === bucketId);
      if (bucket) {
        foundBucket = bucket;
        return;
      }

      // If not found, continue searching in children
      if (node.children.length > 0) {
        traverse(node.children);
      }
    }
  };

  traverse(folderTree);
  return foundBucket;
}

/**
 * Finds and returns the parent folder's information for a specific bucket by its ID.
 *
 * @param bucketId The ID of the bucket whose parent folder you want to find.
 * @returns An object with the folder's details if found, otherwise null.
 */
export function getFolderInfoFromBucketId(bucketId: number): { folder_id: number; folder_name: string; folder_parent_id: number | null } | null {
  const { folderTree } = useBucketStore.getState();
  let foundFolderInfo: { folder_id: number; folder_name: string; folder_parent_id: number | null } | null = null;

  const traverse = (nodes: FolderNode[]) => {
    for (const node of nodes) {
      if (foundFolderInfo) return; // Optimization

      // Check if the bucket exists in the current folder
      const bucketExists = node.buckets.some(b => b.bucket_id === bucketId);
      if (bucketExists) {
        foundFolderInfo = {
          folder_id: node.folder_id,
          folder_name: node.folder_name,
          folder_parent_id: node.folder_parent_id,
        };
        return;
      }

      // If not found, continue searching in children
      if (node.children.length > 0) {
        traverse(node.children);
      }
    }
  };

  traverse(folderTree);
  return foundFolderInfo;
}

/**
 * Checks if a bucket with the given ID exists in the folder tree.
 *
 * @param bucketId The ID of the bucket to validate.
 * @returns `true` if the bucket exists, otherwise `false`.
 */
export function isValidBucketId(bucketId: number): boolean {
  const { folderTree } = useBucketStore.getState();

  const findBucket = (nodes: FolderNode[]): boolean => {
    for (const node of nodes) {
      // Check if the bucket exists in the current folder
      if (node.buckets.some(b => b.bucket_id === bucketId)) {
        return true;
      }
      // If not found, recurse into children
      if (node.children.length > 0) {
        if (findBucket(node.children)) {
          return true; // Propagate the 'found' signal up
        }
      }
    }
    return false; // Not found in this branch
  };

  return findBucket(folderTree);
}

/**
 * Checks if a folder with the given ID exists in the folder tree.
 *
 * @param folderId The ID of the folder to validate.
 * @returns `true` if the folder exists, otherwise `false`.
 */
export function isValidFolderId(folderId: number): boolean {
  const { folderTree } = useBucketStore.getState();

  const findFolder = (nodes: FolderNode[]): boolean => {
    for (const node of nodes) {
      // Check if the current node is the one we're looking for
      if (node.folder_id === folderId) {
        return true;
      }
      // If not, recurse into children
      if (node.children.length > 0) {
        if (findFolder(node.children)) {
          return true; // Propagate the 'found' signal up
        }
      }
    }
    return false; // Not found in this branch
  };

  return findFolder(folderTree);
}

export function getFolderInfo(folderId: number): FolderNode | null {
  const { folderTree } = useBucketStore.getState();
  let foundFolder: FolderNode | null = null;

  const traverse = (nodes: FolderNode[]) => {
    for (const node of nodes) {
      if (foundFolder) return; // Optimization: stop once found

      if (node.folder_id === folderId) {
        foundFolder = node;
        return;
      }

      if (node.children.length > 0) {
        traverse(node.children);
      }
    }
  };

  traverse(folderTree);
  return foundFolder;
}
