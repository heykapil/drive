export function StorageProgress({ used, total, breakdown }: {
  used: number,
  total: number,
  breakdown: {
    images_size_gb: number,
    documents_size_gb: number,
    videos_size_gb: number
  }
}) {

  const parsedBreakdown = {
     images_size_gb: Number(breakdown.images_size_gb),
     documents_size_gb: Number(breakdown.documents_size_gb),
     videos_size_gb: Number(breakdown.videos_size_gb)
   };

  const percentageUsed = (used / total) * 100;
  const categories = [
      {
        name: 'images',
        value: parsedBreakdown.images_size_gb,
        color: 'bg-primary',
        percentage: (parsedBreakdown.images_size_gb / total) * 100
      },
      {
        name: 'documents',
        value: parsedBreakdown.documents_size_gb,
        color: 'bg-blue-500',
        percentage: (parsedBreakdown.documents_size_gb / total) * 100
      },
      {
        name: 'videos',
        value: parsedBreakdown.videos_size_gb,
        color: 'bg-amber-500',
        percentage: (parsedBreakdown.videos_size_gb / total) * 100
      }
    ];

  const validCategories = categories.filter(c => c.value >= 0);
  const remainingPercentage = 100 - percentageUsed;

  return (
    <div className="space-y-4">
      <div className="flex justify-between text-sm">
        <span>{used.toFixed(2)}GB of {total.toFixed(2)}GB used</span>
        <span>{percentageUsed.toFixed(2)}%</span>
      </div>

      <div className="relative h-3 w-full rounded-full overflow-hidden bg-gray-200">
        {/* Remaining (unused) space */}
        <div
          className="absolute right-0 h-full bg-gray-200"
          style={{ width: `${remainingPercentage}%` }}
        />

        {/* Used space segments */}
        {validCategories.map((category, index) => {
          const leftPosition = validCategories
            .slice(0, index)
            .reduce((acc, c) => acc + c.percentage, 0);

          return (
            <div
              key={category.name}
              className={`absolute h-full ${category.color}`}
              style={{
                width: `${category.percentage}%`,
                left: `${leftPosition}%`
              }}
            />
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-4 text-sm">
        {validCategories.map(category => (
          <div key={category.name} className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1">
              <div className={`h-3 w-3 rounded-full ${category.color}`} />
              <span className="capitalize">{category.name}</span>
            </div>
            <span className="font-medium">{category.value.toFixed(2)} GB</span>
            <span className="text-muted-foreground">
              {(category.percentage).toFixed(2)}%
            </span>
          </div>
        ))}
        {/* {remainingPercentage > 0 && (
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-full bg-gray-200" />
              <span>Available</span>
            </div>
            <span className="font-medium">{(total - used).toFixed(2)} GB</span>
            <span className="text-muted-foreground">
              {remainingPercentage.toFixed(1)}%
            </span>
          </div>
        )} */}
      </div>
    </div>
  );
}
