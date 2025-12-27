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
  selectedUniqueId: string | null;
  selectedBucketName: string;
  setSelectedBucket: (uniqueId: string, name: string) => void;
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
      selectedUniqueId: 's3_9',
      selectedBucketName: 'cdn.kapil.app',

      // Action to set the selected bucket manually
      setSelectedBucket: (uniqueId: string, name: string) => set({
        selectedUniqueId: uniqueId,
        selectedBucketName: name
      }),

      // Action now correctly finds the folder and selects the best bucket.
      setSelectedFolder: (id: number, name: string) => {
        const { folderTree } = get();

        // 1. Find the folder node that the user clicked on in the tree.
        let startNode: FolderNode | null = null;
        const findStartNode = (nodes: FolderNode[]) => {
          for (const node of nodes) {
            if (startNode) return; // Optimization: stop searching once found
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
            node.buckets.forEach((bucket: Bucket) => {
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
          selectedUniqueId: bestBucket ? (bestBucket as Bucket).uniqueId : null,
          selectedBucketName: bestBucket ? (bestBucket as Bucket).bucket_name : 'No buckets available',
        });
      },

      // Action to fetch and process folder data
      fetchFolderTree: async () => {
        if (get().folderTree.length > 0 && !get().isLoading) {
          return;
        }
        set({ isLoading: true, error: null });
        try {
          const [foldersResponse, s3Response, tbResponse] = await Promise.all([
            fetch(process.env.NEXT_PUBLIC_APP_URL + '/api/folders/all'),
            fetch(process.env.NEXT_PUBLIC_APP_URL + '/api/buckets/postgres'),
            fetch(process.env.NEXT_PUBLIC_APP_URL + '/api/buckets/terabox/postgres')
          ]);

          if (!foldersResponse.ok) throw new Error(`Failed to fetch folders: ${foldersResponse.statusText}`);
          if (!s3Response.ok) throw new Error(`Failed to fetch S3 buckets`);

          const allFolders: Folder[] = await foldersResponse.json();
          const s3Data = await s3Response.json();

          let tbBuckets: any[] = [];
          if (tbResponse.ok) {
            const tbData = await tbResponse.json();
            tbBuckets = tbData.buckets || [];
          }

          // Merge and Transform buckets
          const s3Buckets = (s3Data.buckets || []).map((b: any) => ({
            ...b,
            bucketType: 'S3',
            uniqueId: `s3_${b.bucket_id}`
          }));

          const teraboxBuckets = tbBuckets.map((b: any) => ({
            ...b,
            bucketType: 'TB',
            uniqueId: `tb_${b.bucket_id}`
          }));

          const allBuckets = [...s3Buckets, ...teraboxBuckets];

          const tree = buildFolderTree(allFolders, allBuckets);

          set({ folderTree: tree, isLoading: false });

        } catch (err) {
          console.error(err);
          const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
          set({ error: errorMessage, isLoading: false });
        }
      },
    }),
    {
      name: 'bucket-store',
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? sessionStorage : { getItem: () => null, setItem: () => { }, removeItem: () => { } })),
      partialize: (state) => ({
        folderTree: state.folderTree,
        selectedFolderId: state.selectedFolderId,
        selectedFolderName: state.selectedFolderName,
        selectedUniqueId: state.selectedUniqueId,
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
 * Finds and returns the complete information for a specific bucket by its uniqueID (or numeric ID legacy).
 *
 * @param bucketId The uniqueID (string) or ID (number) of the bucket to find.
 * @returns The full Bucket object if found, otherwise null.
 */
export function getBucketInfo(bucketIdentifier: string | number): Bucket | null {
  const { folderTree } = useBucketStore.getState();
  let foundBucket: Bucket | null = null;
  const isNumeric = typeof bucketIdentifier === 'number' || (typeof bucketIdentifier === 'string' && !isNaN(Number(bucketIdentifier)) && !bucketIdentifier.includes('_'));
  const numericId = isNumeric ? Number(bucketIdentifier) : -1;

  const traverse = (nodes: FolderNode[]) => {
    for (const node of nodes) {
      if (foundBucket) return; // Optimization

      // Search (try uniqueId match first, then fallback to bucket_id match for S3 backward compat)
      const bucket = node.buckets.find(b => {
        if (b.uniqueId === bucketIdentifier) return true;
        // Legacy: if passing number, assume S3 or first match
        if (isNumeric && b.bucket_id === numericId) return true;
        return false;
      });

      if (bucket) {
        foundBucket = bucket;
        return;
      }

      if (node.children.length > 0) traverse(node.children);
    }
  };

  traverse(folderTree);
  return foundBucket;
}

/**
 * Finds and returns the parent folder's information for a specific bucket.
 */
export function getFolderInfoFromBucketId(bucketIdentifier: string | number): { folder_id: number; folder_name: string; folder_parent_id: number | null } | null {
  const { folderTree } = useBucketStore.getState();
  let foundFolderInfo: { folder_id: number; folder_name: string; folder_parent_id: number | null } | null = null;
  const isNumeric = typeof bucketIdentifier === 'number' || (typeof bucketIdentifier === 'string' && !isNaN(Number(bucketIdentifier)) && !bucketIdentifier.includes('_'));
  const numericId = isNumeric ? Number(bucketIdentifier) : -1;

  const traverse = (nodes: FolderNode[]) => {
    for (const node of nodes) {
      if (foundFolderInfo) return;

      const bucketExists = node.buckets.some(b => {
        if (b.uniqueId === bucketIdentifier) return true;
        if (isNumeric && b.bucket_id === numericId) return true;
        return false;
      });

      if (bucketExists) {
        foundFolderInfo = {
          folder_id: node.folder_id,
          folder_name: node.folder_name,
          folder_parent_id: node.folder_parent_id,
        };
        return;
      }

      if (node.children.length > 0) traverse(node.children);
    }
  };

  traverse(folderTree);
  return foundFolderInfo;
}

/**
 * Checks if a bucket with the given ID exists.
 */
export function isValidBucketId(bucketIdentifier: string | number): boolean {
  return getBucketInfo(bucketIdentifier) !== null;
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
