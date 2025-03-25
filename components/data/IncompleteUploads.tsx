// components/IncompleteUploads.tsx
"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useBucketStore } from "@/hooks/use-bucket-store";
import { toast } from "sonner";
import Loading from "@/app/loading";

type Upload = {
  Key: string;
  UploadId: string;
  Initiated?: string;
};

export default function IncompleteUploads() {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const { selectedBucket } = useBucketStore();
  // Function to fetch incomplete uploads
  const fetchUploads = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/upload/multipart/info?bucket=${selectedBucket}`);
      const data = await res.json();
      if (data.success) {
        setUploads(data.uploads);
      } else {
        setError(data.error || "Error fetching uploads");
      }
    } catch (err: any) {
      setError("Error fetching uploads");
    }
    setLoading(false);
  };

  // Function to abort a multipart upload
  const abortUpload = async (upload: Upload) => {
    if (!confirm(`Abort upload for ${upload.Key}?`)) return;
    try {
      const res = await fetch(`/api/upload/multipart/info?bucket=${selectedBucket}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bucket: selectedBucket, uploadId: upload.UploadId, key: upload.Key }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Aborted!', {
          description: `Upload for ${upload.Key} is aborted.`
        })
        fetchUploads();
      } else {
        toast.error(data.error || "Error aborting upload");
      }
    } catch (err: any) {
      toast.error("Error aborting upload");
    }
  };

  useEffect(() => {
    fetchUploads();
  }, [selectedBucket]);

  return (
    <div>
      {loading ? (
        <p className="text-sm text-primary/70">Loading...</p>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : uploads.length === 0 ? (
        <p className="text-sm text-primary/70">No incomplete uploads found.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Upload ID</TableHead>
              <TableHead>Initiated</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {uploads.map((upload) => (
              <TableRow key={upload.UploadId}>
                <TableCell>{upload.Key}</TableCell>
                <TableCell>{upload.UploadId}</TableCell>
                <TableCell>{upload.Initiated || "N/A"}</TableCell>
                <TableCell>
                  <Button variant="destructive" size="sm" onClick={() => abortUpload(upload)}>
                    Abort
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
