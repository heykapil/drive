"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useBucketStore } from "@/hooks/use-bucket-store";
import { FolderNode } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, FolderOpen, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

// --- Zod Schemas for Form Validation ---
const newFolderSchema = z.object({
    folderName: z.string().min(1, "Folder name is required."),
    parentFolder: z.string().optional(),
});
const bucketDetailsSchema = z.object({
    name: z.string().min(3, "Bucket name must be at least 3 characters."),
    region: z.string().min(1, "Region is required."),
    endpoint: z.string().url("Must be a valid URL."),
    provider: z.string().min(1, "Provider name is required."),
    total_capacity_gb: z.coerce.number().min(1, "Capacity must be at least 1 GB."),
    accessKey: z.string().min(1, "Access Key is required."),
    secretKey: z.string().min(1, "Secret Key is required."),
});

type NewFolderValues = z.infer<typeof newFolderSchema>;
type BucketDetailsValues = z.infer<typeof bucketDetailsSchema>;

// --- Main Component ---
export default function AddNewBucketPage() {
    const router = useRouter();
    const { folderTree } = useBucketStore();
    const [step, setStep] = useState(1);
    const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [parentFolderName, setParentFolderName] = useState<string | null>(null);

    // --- Form Instances ---
    const newFolderForm = useForm<NewFolderValues>({ resolver: zodResolver(newFolderSchema) });
    const bucketDetailsForm = useForm<BucketDetailsValues>({ resolver: zodResolver(bucketDetailsSchema) });

    // --- Recursive Render Function for Folder Dropdowns ---
    const renderFolderItems = (nodes: FolderNode[], onSelect: (id: number, name: string) => void) => {
        return nodes.map(folder => {
            const hasChildren = folder.children && folder.children.length > 0;
            if (hasChildren) {
                return (
                    <DropdownMenuSub key={folder.folder_id}>
                        <DropdownMenuSubTrigger><FolderOpen className="mr-2 h-4 w-4" />{folder.folder_name}</DropdownMenuSubTrigger>
                        <DropdownMenuPortal>
                            <DropdownMenuSubContent>
                                <DropdownMenuItem onSelect={() => onSelect(folder.folder_id, folder.folder_name)}>
                                    <FolderOpen className="mr-2 h-4 w-4" />{folder.folder_name} (Select)
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {renderFolderItems(folder.children, onSelect)}
                            </DropdownMenuSubContent>
                        </DropdownMenuPortal>
                    </DropdownMenuSub>
                );
            }
            return (
                <DropdownMenuItem key={folder.folder_id} onSelect={() => onSelect(folder.folder_id, folder.folder_name)}>
                    <FolderOpen className="mr-2 h-4 w-4" />{folder.folder_name}
                </DropdownMenuItem>
            );
        });
    };

    // --- Handler for creating a new folder ---
    const handleCreateFolder = async (values: NewFolderValues) => {
        setIsSubmitting(true);
        try {
            const res = await fetch(process.env.NEXT_PUBLIC_APP_URL+'/api/folders/new', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: values.folderName, parentId: values.parentFolder }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast.success("Folder created successfully!");
            setSelectedFolderId(data.folder.id);
            useBucketStore.getState().fetchFolderTree(); // Force refresh
            setStep(3);
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- Handler for creating the new bucket ---
    const handleCreateBucket = async (values: BucketDetailsValues) => {
        if (!selectedFolderId) return;
        setIsSubmitting(true);
        try {
            const res = await fetch(process.env.NEXT_PUBLIC_APP_URL+'/api/buckets/postgres', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...values, folderId: selectedFolderId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast.success("Bucket created successfully!");
            useBucketStore.getState().fetchFolderTree(); // Force refresh
            router.push('/buckets');
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex justify-center items-start min-h-screen p-4 md:p-8">
            <Card className="w-full max-w-2xl">
                <CardHeader>
                    {step > 1 && <Button variant="ghost" size="sm" className="justify-start p-0 h-auto mb-2" onClick={() => setStep(step - 1)}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>}
                    <CardTitle>{step === 1 ? "Step 1: Choose a Folder" : step === 2 ? "Step 2: Create New Folder" : "Step 3: Add Bucket Details"}</CardTitle>
                    <CardDescription>{step === 1 ? "Choose where to add your new S3 bucket." : step === 2 ? "Provide a name and optional parent for your new folder." : "Enter the credentials and details for your new S3 bucket."}</CardDescription>
                </CardHeader>
                <CardContent>
                    {step === 1 && (
                        <div className="space-y-4">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start font-normal">Select an existing folder...</Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                                    {renderFolderItems(folderTree, (id) => { setSelectedFolderId(id); setStep(3); })}
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <div className="relative"><div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Or</span></div></div>
                            <Button variant="secondary" className="w-full" onClick={() => setStep(2)}>Create a New Folder</Button>
                        </div>
                    )}
                    {step === 2 && (
                        <Form {...newFolderForm}>
                            <form onSubmit={newFolderForm.handleSubmit(handleCreateFolder)} className="space-y-6">
                                <FormField control={newFolderForm.control} name="folderName" render={({ field }) => (<FormItem><FormLabel>New Folder Name</FormLabel><FormControl><Input placeholder="e.g., Client Projects" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={newFolderForm.control} name="parentFolder" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Parent Folder (Optional)</FormLabel>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <FormControl><Button variant="outline" className="w-full justify-start font-normal">{parentFolderName || "Select a parent..."}</Button></FormControl>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                                                {renderFolderItems(folderTree, (id, name) => { field.onChange(id.toString()); setParentFolderName(name); })}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                        <FormDescription>Place this new folder inside an existing one.</FormDescription><FormMessage />
                                    </FormItem>
                                )} />
                                <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create Folder & Continue</Button>
                            </form>
                        </Form>
                    )}
                    {step === 3 && (
                        <Form {...bucketDetailsForm}>
                            <form onSubmit={bucketDetailsForm.handleSubmit(handleCreateBucket)} className="space-y-6">
                                <FormField control={bucketDetailsForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Bucket Name</FormLabel><FormControl><Input placeholder="my-awesome-bucket" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                                <FormField control={bucketDetailsForm.control} name="provider" render={({ field }) => (<FormItem><FormLabel>Provider</FormLabel><FormControl><Input placeholder="e.g., AWS, Cloudflare, Tebi" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField control={bucketDetailsForm.control} name="region" render={({ field }) => (<FormItem><FormLabel>Region</FormLabel><FormControl><Input placeholder="us-east-1" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                                    <FormField control={bucketDetailsForm.control} name="total_capacity_gb" render={({ field }) => (<FormItem><FormLabel>Total Capacity (GB)</FormLabel><FormControl><Input type="number" placeholder="25" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                                </div>
                                <FormField control={bucketDetailsForm.control} name="endpoint" render={({ field }) => (<FormItem><FormLabel>Endpoint URL</FormLabel><FormControl><Input placeholder="https://s3.us-east-1.amazonaws.com" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                                <FormField control={bucketDetailsForm.control} name="accessKey" render={({ field }) => (<FormItem><FormLabel>Access Key</FormLabel><FormControl><Input type="password" placeholder="••••••••••••••••" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                                <FormField control={bucketDetailsForm.control} name="secretKey" render={({ field }) => (<FormItem><FormLabel>Secret Key</FormLabel><FormControl><Input type="password" placeholder="••••••••••••••••••••••••" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                                <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add Bucket</Button>
                            </form>
                        </Form>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
