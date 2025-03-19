// Determine chunk size based on file size.
export function calculateChunkSize(fileSize: number): number {
  const chunkSizeMap = [
    { limit: 100 * 1024 * 1024, size: 5 * 1024 * 1024 },
    { limit: 500 * 1024 * 1024, size: 15 * 1024 * 1024 },
    { limit: 1024 * 1024 * 1024, size: 25 * 1024 * 1024 },
  ];
  return chunkSizeMap.find(({ limit }) => fileSize < limit)?.size || 50 * 1024 * 1024;
}
