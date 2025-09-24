'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import {
    getBucketInfo,
    getFolderInfo,
    getFolderInfoFromBucketId, // New helper function
    isValidBucketId,
    isValidFolderId,

    useBucketStore
} from './use-bucket-store';

export function UrlStateSync() {
  const searchParams = useSearchParams();

  const {
    setSelectedFolder,
    setSelectedBucket,
    selectedFolderId,
    selectedBucketId,
    isLoading,
    folderTree
  } = useBucketStore();

  useEffect(() => {
    // 1. Exit early if data isn't ready yet.
    if (isLoading || folderTree.length === 0) {
      return;
    }

    const folderIdStr = searchParams.get('folderId');
    const bucketIdStr = searchParams.get('bucketId');

    // 2. Prioritize bucketId from URL if it exists and is valid.
    if (bucketIdStr) {
      const bucketIdNum = parseInt(bucketIdStr, 10);

      // Validate the ID before using it and check if a state change is needed.
      if (isValidBucketId(bucketIdNum) && bucketIdNum !== selectedBucketId) {
        const bucketInfo = getBucketInfo(bucketIdNum)!; // We know it's not null
        const folderInfo = getFolderInfoFromBucketId(bucketIdNum)!; // We know this exists too

        // Update both folder and bucket for perfect sync.
        setSelectedFolder(folderInfo.folder_id, folderInfo.folder_name);
        setSelectedBucket(bucketInfo.bucket_id, bucketInfo.bucket_name);
      }
      return; // Stop further processing if we synced based on bucketId
    }

    // 3. If no valid bucketId, fall back to folderId.
    if (folderIdStr) {
      const folderIdNum = parseInt(folderIdStr, 10);

      // Validate the ID and check if a state change is needed.
      if (isValidFolderId(folderIdNum) && folderIdNum !== selectedFolderId) {
        const folderInfo = getFolderInfo(folderIdNum)!; // We know it's not null

        // This action will set the folder and find the best default bucket.
        setSelectedFolder(folderInfo.folder_id, folderInfo.folder_name);
      }
    }

  }, [searchParams, isLoading, folderTree, selectedFolderId, selectedBucketId, setSelectedFolder, setSelectedBucket]);

  return null; // This component renders nothing.
}
