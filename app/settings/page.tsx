import HeaderNav from "@/components/header-nav";
import { StorageChart } from "@/components/StoragePieChart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { testSystemHealth } from "@/lib/actions";
import { getSession } from "@/lib/auth";
import { buckets } from "@/service/bucket.config";
import { getS3StorageUsage } from "@/service/s3-tebi";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { notFound } from "next/navigation";
import { Suspense } from "react";
export default async function SettingsPage() {
  const production = process.env.NODE_ENV === 'production';
  const session = await getSession();
  if(production && session?.user?.username !== 'admin'){
    return notFound()
  }
  const health = await testSystemHealth()
  const usage = await getS3StorageUsage();
  return (
    <Suspense>
    <HeaderNav />
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-0 gap-2 font-[family-name:var(--font-geist-sans)]">
    <main className="flex flex-col gap-2 row-start-2 items-center sm:items-start">
    <div className="w-full md:w-2xl lg:w-4xl mx-auto py-6 px-2 md:px-0 space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <Card>
          <CardHeader>
              <CardTitle>Configured S3 Buckets</CardTitle>
              <CardDescription>Status of test connections to your configured storage buckets.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col">
              {Object.entries(buckets).map(([id, config]) => {
                const error = health.storageErrors.find(({ bucket }) => bucket === id);
                const data = usage.find(({ bucket }) => bucket === id) ?? null;
                const storageUsedGB = data ? parseFloat(data.storageUsedGB as string) : 0;
                const availableCapacityGB = data ? parseFloat(data.availableCapacityGB as string) : 25;
                return (
                  <div key={id} className="rounded-md border-y p-4 flex flex-col gap-4">
                    {/* Bucket Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        {error ? (
                          <AlertTriangle className="w-5 h-5 text-red-500" />
                        ) : (
                          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                        )}
                        <div>
                          <p>{config.name}</p>
                          <p className="text-sm text-gray-500">id: {id}</p>
                        </div>
                      </div>

                      {/* Error Message or Pie Chart */}
                      <div className="flex items-center gap-4">
                        {error ? (
                          <div className="flex items-center gap-2 px-6">
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                            <span className="text-sm text-red-500">{error.message}</span>
                          </div>
                        ) : (
                          <StorageChart
                            storageUsedGB={storageUsedGB}
                            availableCapacityGB={availableCapacityGB}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
            <CardHeader>
                <CardTitle>Configured Database</CardTitle>
                <CardDescription>Status of test connections to your configured postgres database.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col">
                <div className="rounded-md border-y p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      {health.postgresError ? (
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                      ) : (
                        <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                      )}
                      <div>
                        <p>Postgres</p>
                        <p className="text-sm text-gray-500">Database</p>
                      </div>
                    </div>
                    {health.postgresError ? (
                      <div className="flex items-start gap-2 px-6">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        <span className="text-sm text-red-500">{health.postgresError.message}</span>
                      </div>
                    ): (
                      <div className="flex items-start gap-2 px-6">
                        <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                        <span className="text-sm text-green-600 dark:text-green-400">Database is ready</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
          </Card>
    </div>
    </main>
    </div>
    </Suspense>
  );
}
