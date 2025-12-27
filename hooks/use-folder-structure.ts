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
        const [foldersResponse, s3Response, tbResponse] = await Promise.all([
          fetch(process.env.NEXT_PUBLIC_APP_URL + '/api/folders/all'),
          fetch(process.env.NEXT_PUBLIC_APP_URL + '/api/buckets/postgres'),
          fetch(process.env.NEXT_PUBLIC_APP_URL + '/api/buckets/terabox/postgres')
        ]);

        if (!foldersResponse.ok) {
          throw new Error('Failed to fetch folder list');
        }
        if (!s3Response.ok) {
          throw new Error('Failed to fetch bucket data');
        }

        const allFolders: Folder[] = await foldersResponse.json();
        const s3Data = await s3Response.json();
        const tbData = await tbResponse.ok ? await tbResponse.json() : { buckets: [] };

        const s3Buckets = (s3Data.buckets || []).map((b: any) => ({ ...b, bucketType: 'S3', uniqueId: `s3_${b.bucket_id}` }));
        const tbBuckets = (tbData.buckets || []).map((b: any) => ({ ...b, bucketType: 'TB', uniqueId: `tb_${b.bucket_id}` }));

        // 3. Build the tree using both data sources
        const tree = buildFolderTree(allFolders, [...s3Buckets, ...tbBuckets]);

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
