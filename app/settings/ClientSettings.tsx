"use client";

import { StorageChart } from "@/components/data/StoragePieChart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { testSystemHealth } from "@/lib/actions";
import { buckets } from "@/service/bucket.config";
import { getS3StorageUsage } from "@/service/s3-tebi";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { useEffect, useState } from "react";

// Type Definitions
type StorageError = {
  bucket: string;
  message: string;
};

type PostgresError = {
  status: string;
  message?: string;
};

type HealthData = {
  storageErrors: StorageError[];
  postgresErrors: Record<string, PostgresError>;
};

type BucketUsageSuccess = {
  bucket: string;
  status: "Success";
  storageUsedGB: number;
  availableCapacityGB: number;
};

type BucketUsageError = {
  bucket: string;
  status: "Error";
  message: string;
};

type BucketUsage = BucketUsageSuccess | BucketUsageError;

export default function SettingsContent() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [usage, setUsage] = useState<BucketUsage[]>([]);
  const [loadingBuckets, setLoadingBuckets] = useState(true);
  const [loadingPostgres, setLoadingPostgres] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [healthResponse, usageResponse] = await Promise.all([
          testSystemHealth(),
          getS3StorageUsage()
        ]);

        // Type casting the usage response to match our corrected types
        const typedUsage = usageResponse.map(item => ({
          ...item,
          storageUsedGB: parseFloat(item.storageUsedGB!.replace(' GB', '')),
          availableCapacityGB: parseFloat(item.availableCapacityGB!.replace(' GB', ''))
        })) as BucketUsage[];

        const typedHealthResponse: HealthData = {
          storageErrors: healthResponse.storageErrors.map((error) => ({
            bucket: error.bucket,
            message: error.message || "Unknown error", // Ensure message is always a string
          })),
          postgresErrors: healthResponse.postgresErrors || {},
        };
        setHealth(typedHealthResponse);
        setUsage(typedUsage);
      } catch {
        setHealth({
          storageErrors: [],
          postgresErrors: {
            mainDB: { status: "error", message: "Connection failed" },
            fallbackDB: { status: "error", message: "Connection failed" }
          }
        });
        setUsage([]);
      } finally {
        setLoadingPostgres(false);
        setLoadingBuckets(false);
      }
    };

    fetchData();
  }, []);

  // Helper function to get bucket usage data.
  // If the bucket's status is "Error", include the error message.
  const getBucketData = (bucketId: string) => {
    const data = usage.find(u => u.bucket === bucketId);
    if (!data) {
      return { storageUsedGB: 0, availableCapacityGB: 0 };
    }
    if (data.status === "Error") {
      return { error: data.message, storageUsedGB: 0, availableCapacityGB: 0 };
    }
    if (data.status === "Success") {
      return {
        storageUsedGB: data.storageUsedGB,
        availableCapacityGB: data.availableCapacityGB
      };
    }
    return { storageUsedGB: 0, availableCapacityGB: 0 };
  };

  return (
    <Card>
      {/* S3 Buckets Section */}
      <CardHeader>
        <CardTitle>Configured S3 Buckets</CardTitle>
        <CardDescription>
          Status of test connections to your configured storage buckets.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col">
        {loadingBuckets ? (
          <div className="space-y-4">
            {Object.keys(buckets).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-md" />
            ))}
          </div>
        ) : (
          Object.entries(buckets).map(([bucketId, config]) => {
            // Check if there's an error from health or from the bucket usage data.
            const healthError = health?.storageErrors.find(e => e.bucket === bucketId);
            const bucketData = getBucketData(bucketId);
            const hasError = !!healthError || !!bucketData.error;

            return (
              <div key={bucketId} className="border-y px-2 py-1 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-6">
                      {hasError ? (
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                      ) : (
                        <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                      )}
                      <div>
                        <p>{config.name}</p>
                        <p className="text-sm text-gray-500">ID: {bucketId}</p>
                      </div>
                    </div>
                    {!hasError && (
                      <p className="text-sm text-gray-600 ml-11">
                        Used: {bucketData.storageUsedGB} GB / Available: {bucketData.availableCapacityGB} GB
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    {hasError ? (
                      <div className="flex items-center gap-2 px-6">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        <span className="text-sm text-red-500">
                          {healthError ? healthError.message : bucketData.error}
                        </span>
                      </div>
                    ) : (
                      <StorageChart
                        storageUsedGB={bucketData.storageUsedGB}
                        availableCapacityGB={bucketData.availableCapacityGB}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>

      {/* Database Section */}
      <CardHeader>
        <CardTitle>Configured Database</CardTitle>
        <CardDescription>
          Status of test connections to your configured Postgres database.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col">
        {loadingPostgres ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full rounded-md" />
          </div>
        ) : (
          <div className="border-y p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                {health?.postgresErrors && Object.values(health.postgresErrors).some(e => e.status === "Error") ? (
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                )}
                <div>
                  <p>PostgreSQL Database</p>
                  <p className="text-sm text-gray-500">Managed Service</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 px-6 mt-4">
              {["mainDB", "fallbackDB"].map((dbName) => {
                const error = health?.postgresErrors?.[dbName];
                const dbLabel = dbName === "mainDB" ? "AivenDB" : "NeonDB";

                return (
                  <div key={dbName} className="flex items-center gap-2">
                    {error?.status === "Error" ? (
                      <>
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        <span className="text-sm text-red-500">
                          {dbLabel}: {error?.message || "Connection error"}
                        </span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                        <span className="text-sm text-green-600 dark:text-green-400">
                          {dbLabel}: Healthy
                        </span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
