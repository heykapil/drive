"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {  Edit3, Globe, Lock, LockIcon, LockOpen, Plus } from "lucide-react"
import { BucketConfig, verifyPassword } from "@/service/bucket.config"
import { BucketForm } from "@/components/new-bucket"
import { useBucketStore } from "@/hooks/use-bucket-store"

export function S3BucketViewer({buckets}: {buckets: Record<string, BucketConfig>}) {
  const [password, setPassword] = useState("")
  const { isAuthenticated, setIsAuthenticated } = useBucketStore()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openSheet, setopenSheet] = useState<boolean>(false);
  const publicBuckets = Object.entries(buckets)
    .filter(([_, bucket]) => bucket.private === false) // Filter only public buckets
    .map(([key, config]) => ({
      value: key,
      config: config,
      label: key.charAt(0).toUpperCase() + key.slice(1), // Capitalizing the first letter
    }));

  const privateBuckets = Object.entries(buckets)
    .filter(([_, bucket]) => bucket.private === true) // Filter only private buckets
    .map(([key, config]) => ({
      value: key,
      config: config,
      label: key.charAt(0).toUpperCase() + key.slice(1), // Capitalizing the first letter
    }));
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const result = await verifyPassword(password)
      if (result.success) {
        setIsAuthenticated(true)
      } else {
        setError("Invalid password. Please try again.")
      }
    } catch (err: any) {
      setError(err || "An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  if (isAuthenticated) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between">S3 Buckets <Button variant={'outline'} className="w-fit" onClick={()=>setopenSheet(true)}>New Bucket <Plus /></Button></CardTitle>
          <CardDescription>View all S3 buckets configured in this project</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="public">
            <TabsList className="mb-4">
              <TabsTrigger value="public">Public Buckets <LockOpen /></TabsTrigger>
              <TabsTrigger value="private">Private Buckets <LockIcon /></TabsTrigger>
            </TabsList>
            <TabsContent value="public">
              <BucketList buckets={publicBuckets} type="public" />
            </TabsContent>
            <TabsContent value="private">
              <BucketList buckets={privateBuckets} type="private" />
            </TabsContent>
          </Tabs>
        </CardContent>
        {openSheet &&
          <BucketForm open={openSheet} onCloseAction={() => setopenSheet(false)} />
        }
      </Card>
    )
  }

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          Authentication Required
        </CardTitle>
        <CardDescription>Enter the password to view S3 bucket information</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Verifying..." : "Submit"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}


function BucketList({ buckets, type }: { buckets:  {
   value: string;
   config: BucketConfig;
   label: string;
}[], type: string }) {
  const [openSheet, setopenSheet] = useState(false);
  const [selectedBucket, setSelectedBucket] = useState<{ id: string, config: BucketConfig } | null>(null);
  return (
    <div className="space-y-2">
      {buckets.map((bucket) => (
        <Card key={bucket.label} className="overflow-hidden">
          <CardContent className="px-6 py-2">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium flex items-center gap-2">
                  {type === "public" ? (
                    <Globe className="h-4 w-4 text-green-500" />
                  ) : (
                    <LockIcon className="h-4 w-4 text-amber-500" />
                  )}
                  {bucket.label}
                </h3>
                <p className="text-sm text-muted-foreground">Region: {bucket?.config?.region}</p>
                <p className="text-xs text-muted-foreground mt-1">
                 Name : {bucket?.config?.name}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                 Provider : {bucket?.config?.provider}
                </p>
              </div>
              <Button variant={type === "public" ? "outline" : "secondary"} onClick={() => { setSelectedBucket({ id: bucket.value, config: bucket.config }); setopenSheet(true) }}>Edit <Edit3 /></Button>
            </div>
          </CardContent>
        </Card>
      ))}
      {openSheet && selectedBucket && (<BucketForm open={openSheet} id={selectedBucket?.id} bucketConfig={selectedBucket?.config} onCloseAction={() => setopenSheet(false)} />)}
    </div>
  )
}
