"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, Save, TestTube2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { toast } from "sonner";
import { z } from "zod";
import { getBucketDetails, updateBucket, verifyBucketConfig } from "./actions";
import { useBucketStore } from "@/hooks/use-bucket-store";

// Schema - similar to creation but keys are optional
const bucketConfigSchema = z.object({
    name: z.string().min(3, "Bucket name must be at least 3 characters."),
    region: z.string().min(1, "Region is required."),
    endpoint: z.string().url("Must be a valid URL."),
    provider: z.string().min(1, "Provider name is required."),
    total_capacity_gb: z.coerce.number().min(1, "Capacity must be at least 1 GB."),
    accessKey: z.string().optional(),
    secretKey: z.string().optional(),
});

type BucketConfigValues = z.infer<typeof bucketConfigSchema>;

export default function EditBucketPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const bucketIdParam = searchParams.get('bucketId');
    const bucketId = bucketIdParam ? parseInt(bucketIdParam) : null;

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);

    const form = useForm<BucketConfigValues>({
        resolver: zodResolver(bucketConfigSchema),
        defaultValues: {
            name: "",
            provider: "",
            region: "",
            endpoint: "",
            total_capacity_gb: 25,
            accessKey: "",
            secretKey: "",
        }
    });

    useEffect(() => {
        if (!bucketId) {
            toast.error("No bucket ID provided");
            router.push('/buckets');
            return;
        }

        async function fetchDetails() {
            try {
                const details = await getBucketDetails(bucketId!);
                if (!details) {
                    toast.error("Bucket not found");
                    router.push('/buckets');
                    return;
                }
                form.reset({
                    name: details.name,
                    provider: details.provider,
                    region: details.region,
                    endpoint: details.endpoint,
                    total_capacity_gb: details.total_capacity_gb,
                    accessKey: "", // Don't show existing keys
                    secretKey: ""
                });
            } catch (error) {
                toast.error("Failed to fetch bucket details");
                console.error(error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchDetails();
    }, [bucketId, router, form]);

    const onSubmit = async (values: BucketConfigValues) => {
        if (!bucketId) return;
        setIsSaving(true);
        try {
            await updateBucket({
                id: bucketId,
                ...values,
                // Only send keys if they have length
                accessKey: values.accessKey || undefined,
                secretKey: values.secretKey || undefined,
            });
            toast.success("Bucket configuration updated successfully");
            useBucketStore.getState().fetchFolderTree(); // Force refresh
            router.push('/buckets');
        } catch (error: any) {
            toast.error("Failed to update bucket: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleTestConnection = async (e: React.MouseEvent) => {
        e.preventDefault();
        // Trigger validation fields related to connection
        const isValid = await form.trigger(['name', 'region', 'endpoint']);
        if (!isValid) return;

        const values = form.getValues();
        setIsTesting(true);
        try {
            const result = await verifyBucketConfig({
                id: bucketId!,
                ...values,
                // Ensure we pass string (empty means use existing in backend)
                accessKey: values.accessKey || "",
                secretKey: values.secretKey || "",
            });

            if (result.success) {
                toast.success(result.message);
            } else {
                toast.error(result.message);
            }
        } catch (error: any) {
            toast.error("Connection test error");
        } finally {
            setIsTesting(false);
        }
    };

    if (isLoading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
    }

    return (
        <div className="flex justify-center items-start min-h-screen p-4 md:p-8">
            <Card className="w-full max-w-2xl">
                <CardHeader>
                    <Button variant="ghost" size="sm" className="justify-start p-0 h-auto mb-2 w-fit" onClick={() => router.back()}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Buckets
                    </Button>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Configure Bucket</CardTitle>
                            <CardDescription>Update settings for {form.getValues().name}</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="name" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Bucket Name</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="provider" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Provider</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="region" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Region</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="total_capacity_gb" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Total Capacity (GB)</FormLabel>
                                        <FormControl><Input type="number" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>

                            <FormField control={form.control} name="endpoint" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Endpoint URL</FormLabel>
                                    <FormControl><Input {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <div className="space-y-4 pt-4 border-t">
                                <h3 className="text-sm font-medium text-muted-foreground">Credentials (Leave blank to keep unchanged)</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField control={form.control} name="accessKey" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Access Key</FormLabel>
                                            <FormControl><Input type="password" placeholder="••••••••••••••••" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="secretKey" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Secret Key</FormLabel>
                                            <FormControl><Input type="password" placeholder="••••••••••••••••••••••••" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <Button type="submit" disabled={isSaving || isTesting} className="flex-1">
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    Save Changes
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleTestConnection}
                                    disabled={isSaving || isTesting}
                                >
                                    {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TestTube2 className="mr-2 h-4 w-4" />}
                                    Test Connection
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}
