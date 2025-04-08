"use client"

import { useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { CheckCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { addBucketformSchema } from "@/lib/schema"
import { BucketConfig } from "@/service/bucket.config"
import { verifyBucketConnection } from "@/service/s3-tebi"
import { addredisBucket } from "@/lib/actions"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog"

const generateDefaultId = () => {
  const year = new Date().getFullYear().toString();
  const randomNum = Math.floor(1000 + Math.random() * 9000); // 4-digit number
  return `${year},${randomNum}`;
};

interface BucketFormProps {
  open: boolean;
  onCloseAction: () => void;
  id?: string;
  bucketConfig?: BucketConfig;
}

export function BucketForm({ open, onCloseAction, id, bucketConfig }: BucketFormProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  console.log(id, bucketConfig)
  const initialValues = useMemo(() => {
    if (id && bucketConfig) {
      return { id, ...bucketConfig };
    }
    return {
      id: generateDefaultId(),
      name: "",
      accessKey: "",
      secretKey: "",
      region: "",
      endpoint: "",
      private: false,
      cdnUrl: "",
      provider: "",
      availableCapacity: 0,
    };
  }, [id, bucketConfig]);

  // Initialize the form with the initial values.
  const form = useForm<z.infer<typeof addBucketformSchema>>({
    resolver: zodResolver(addBucketformSchema),
    defaultValues: initialValues,
  });

  // Reset form values when initialValues change.
  useEffect(() => {
    form.reset(initialValues);
  }, [initialValues, form]);

  // Handler to verify the bucket connection.
  const handleVerify = async () => {
    const values = form.getValues();
    const bucketConfig: BucketConfig = {
      name: values.name,
      accessKey: values.accessKey,
      secretKey: values.secretKey,
      region: values.region,
      endpoint: values.endpoint,
      private: values.private,
      cdnUrl: values.cdnUrl,
      provider: values.provider,
      availableCapacity: values.availableCapacity,
    };

    setIsVerifying(true);
    try {
      const isValid = await verifyBucketConnection(bucketConfig);
      setIsVerified(isValid);
      if (isValid) {
        toast.success("Bucket verified", {
          description: "Connection to the bucket was successful.",
        });
      } else {
        toast.error("Verification failed", {
          description: "Could not connect to the bucket with the provided credentials.",
        });
      }
    } catch {
      toast.error("Verification error", {
        description: "An error occurred during verification.",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Handle form submission.
  const onSubmit = async (values: z.infer<typeof addBucketformSchema>) => {
    if (!isVerified) {
      toast.info("Verification required", {
        description: "Please verify the bucket connection before submitting.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const bucketConfig: BucketConfig = {
        name: values.name,
        accessKey: values.accessKey,
        secretKey: values.secretKey,
        region: values.region,
        endpoint: values.endpoint,
        private: values.private,
        cdnUrl: values.cdnUrl,
        provider: values.provider,
        availableCapacity: values.availableCapacity,
      };

      await addredisBucket(values.id, bucketConfig);
      toast.success("Bucket added", {
        description: "The bucket has been successfully added to Redis.",
      });

      // Reset form with new default ID and clear other fields.
      form.reset({
        id: generateDefaultId(),
        name: "",
        accessKey: "",
        secretKey: "",
        region: "",
        endpoint: "",
        private: false,
        cdnUrl: "",
        provider: "",
        availableCapacity: 0,
      });
      setIsVerified(false);
    } catch (error) {
      toast.error("Submission error", {
        description: error instanceof Error ? error.message : "Failed to add bucket to Redis.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onCloseAction}>
      <DialogHeader>
        <DialogTitle>{id ? "Edit S3 Bucket" : "Add S3 Bucket"}</DialogTitle>
        <DialogDescription>Configure S3 bucket to Redis.</DialogDescription>
      </DialogHeader>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="after:content-['*'] after:-ml-1 after:text-red-500">
                      ID
                    </FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormDescription>Unique identifier for this bucket</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="after:content-['*'] after:-ml-1 after:text-red-500">
                      Bucket Name
                    </FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormDescription>Same as used creating bucket</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="accessKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="after:content-['*'] after:-ml-1 after:text-red-500">
                      Access Key
                    </FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormDescription>Access key of the bucket</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="secretKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="after:content-['*'] after:-ml-1 after:text-red-500">
                      Secret Key
                    </FormLabel>
                    <FormControl>
                      <Input {...field} type="password" />
                    </FormControl>
                    <FormDescription>Secret key of this bucket</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="region"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="after:content-['*'] after:-ml-1 after:text-red-500">
                      Region
                    </FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endpoint"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="after:content-['*'] after:-ml-1 after:text-red-500">
                      Endpoint
                    </FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="provider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Provider</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormDescription>S3 provider (e.g., AWS, DigitalOcean)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="availableCapacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Available Capacity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) =>
                          field.onChange(e.target.value ? Number(e.target.value) : undefined)
                        }
                      />
                    </FormControl>
                    <FormDescription>Available storage in GB</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cdnUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CDN URL</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormDescription>Optional CDN URL for the bucket</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="private"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-6 rounded-lg">
                    <div className="space-y-0">
                      <FormLabel>Private Bucket</FormLabel>
                      <FormDescription>Set it to true if bucket is private</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleVerify}
                disabled={isVerifying || isSubmitting}
                className="flex items-center gap-2"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verifying
                  </>
                ) : isVerified ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Verified
                  </>
                ) : (
                  "Verify Bucket"
                )}
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || isVerifying || !isVerified}
                className="flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting
                  </>
                ) : (
                  "Add Bucket"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
      <DialogFooter className="flex flex-col text-sm text-muted-foreground">
        <p>Fields marked with * are required.</p>
        <p>Bucket must be verified before submission.</p>
      </DialogFooter>
    </Dialog>
  );
}
