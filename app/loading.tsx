import { DashboardSkeleton } from "@/components/data/DashboardPage";

export default function Loading() {
  return (
    <div className="w-[93vw] md:2xl lg:w-4xl mx-auto py-6 space-y-6">
      <div className="h-8 w-48 bg-gray-100 rounded animate-pulse" />
      <DashboardSkeleton />
    </div>
  );
}
