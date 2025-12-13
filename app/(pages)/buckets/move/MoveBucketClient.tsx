'use client';


import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useBucketStore } from '@/hooks/use-bucket-store';
import { FolderNode } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { FolderOpen, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

const moveBucketSchema = z.object({
  bucketId: z.string().min(1, 'You must select a bucket.'),
  newFolderId: z.string().min(1, 'You must select a new folder.'),
});
type MoveBucketValues = z.infer<typeof moveBucketSchema>;

export default function EditBucketPage() {
  const router = useRouter();
  const { folderTree } = useBucketStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFolderName, setSelectedFolderName] = useState<string | null>(
    null,
  );
  const { selectedBucketId, isLoading } = useBucketStore();
  // Create a flat list of all buckets from the tree
  // Each bucket object is expected to at least contain `bucket_id` and `bucket_name`.
  type BucketOption = { bucket_id: number; bucket_name: string };
  const allBuckets = (nodes: FolderNode[]): BucketOption[] => {
    let buckets: BucketOption[] = [];
    nodes.forEach(node => {
      if (Array.isArray(node.buckets) && node.buckets.length > 0) {
        buckets = buckets.concat(node.buckets as BucketOption[]);
      }
      if (node.children) {
        buckets = buckets.concat(allBuckets(node.children));
      }
    });
    return buckets;
  };
  const bucketOptions = allBuckets(folderTree || []);

  const form = useForm<MoveBucketValues>({
    resolver: zodResolver(moveBucketSchema),
  });

  const handleMoveBucket = async (values: MoveBucketValues) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(
        process.env.NEXT_PUBLIC_APP_URL + '/api/buckets/postgres',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bucketId: Number(values.bucketId),
            newFolderId: Number(values.newFolderId),
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Bucket moved successfully!');
      // Refresh the store state after a successful move
      useBucketStore.getState().fetchFolderTree();
      router.push('/buckets');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Recursive component to render folder items and sub-menus
  // `onChange` accepts the selected folder id as a string.
  const renderFolderItems = (
    nodes: FolderNode[],
    onChange: (value: string) => void,
  ) => {
    return nodes.map(folder => {
      const hasChildren = folder.children && folder.children.length > 0;

      if (hasChildren) {
        return (
          <DropdownMenuSub key={folder.folder_id}>
            <DropdownMenuSubTrigger>
              <FolderOpen className="mr-2 h-4 w-4" />
              <span>{folder.folder_name}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                <DropdownMenuItem
                  onSelect={() => {
                    onChange(folder.folder_id.toString());
                    setSelectedFolderName(folder.folder_name);
                  }}
                >
                  <FolderOpen className="mr-2 h-4 w-4" />
                  <span>{folder.folder_name} (Select)</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {renderFolderItems(folder.children, onChange)}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        );
      }

      return (
        <DropdownMenuItem
          key={folder.folder_id}
          onSelect={() => {
            onChange(folder.folder_id.toString());
            setSelectedFolderName(folder.folder_name);
          }}
        >
          <FolderOpen className="mr-2 h-4 w-4" />
          <span>{folder.folder_name}</span>
        </DropdownMenuItem>
      );
    });
  };

  return (
    <div className="flex justify-center items-start min-h-screen p-4 md:p-8">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Move Bucket to a New Folder</CardTitle>
          <CardDescription>
            Select a bucket and its new parent folder.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleMoveBucket)}
              className="space-y-6"
            >
              <FormField
                control={form.control}
                name="bucketId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bucket to Move</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={
                        !isLoading && selectedBucketId
                          ? selectedBucketId.toString()
                          : field.value
                      }
                    >
                      <FormControl>
                        <Button
                          variant="outline"
                          className="w-full justify-start font-normal"
                          asChild
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a bucket..." />
                          </SelectTrigger>
                        </Button>
                      </FormControl>
                      <SelectContent>
                        {bucketOptions.map(bucket => (
                          <SelectItem
                            key={bucket.bucket_id}
                            value={bucket.bucket_id.toString()}
                          >
                            {bucket.bucket_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="newFolderId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Parent Folder</FormLabel>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className="w-full justify-start font-normal"
                          >
                            {selectedFolderName || 'Select a folder...'}
                          </Button>
                        </FormControl>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                        {renderFolderItems(folderTree, field.onChange)}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Move Bucket
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
