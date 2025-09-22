import { useEffect, useState } from 'react';
import { buildFolderTree, Folder, FolderNode } from '../lib/utils';

const STORAGE_KEY = 'folderStructure';

export function useFolderStructure() {
  const [folderTree, setFolderTree] = useState<FolderNode[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        // 1. Check session storage first
        const cachedData = sessionStorage.getItem(STORAGE_KEY);
        if (cachedData) {
          setFolderTree(JSON.parse(cachedData));
          setIsLoading(false);
          return;
        }

        // 2. If not cached, fetch from both APIs in parallel for efficiency
        const [foldersResponse, bucketsResponse] = await Promise.all([
          fetch('/api/folders/all'),
          fetch('/api/buckets/postgres')
        ]);

        if (!foldersResponse.ok) {
          throw new Error('Failed to fetch folder list');
        }
        if (!bucketsResponse.ok) {
          throw new Error('Failed to fetch bucket data');
        }

        const allFolders: Folder[] = await foldersResponse.json();
        const bucketsData = await bucketsResponse.json();

        // 3. Build the tree using both data sources
        const tree = buildFolderTree(allFolders, bucketsData.buckets);

        // 4. Save to session storage and update state
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tree));
        setFolderTree(tree);

      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred'));
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []); // Empty dependency array means this runs only once on mount

  return { folderTree, isLoading, error };
}
