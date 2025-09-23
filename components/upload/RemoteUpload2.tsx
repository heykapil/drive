'use client'
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { getBucketInfo, useBucketStore } from "@/hooks/use-bucket-store";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BucketSelector } from "../bucket-selector";
import { Card, CardContent } from "../ui/card";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { uploadMultipart } from "./RemoteUploadMultipart2";
export default function RemoteUpload({
  testS3ConnectionAction,
  encryptBucketConfigAction
}: {encryptBucketConfigAction: (bucketId: number) => Promise<string>, testS3ConnectionAction: (bucketIds: number| number[])=> Promise<any>}) {
  const { selectedBucketId, selectedBucketName, isLoading: isZustLoading } = useBucketStore()
  const [useProxy, setUseProxy] = useState(true);
  const [proxyUrl, setProxyUrl] = useState("https://stream.kapil.app");
  const [urls, setUrls] = useState("");
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [isUploading, setIsUploading] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const [lineHeight, setLineHeight] = useState(20); // Default line height
  const[synologyBucket,setIsSynologyBucket] = useState(false);

  useEffect(() => {
    async function setSynologyBucket(){
      if (!isZustLoading) {
        const bucketInfo = getBucketInfo(selectedBucketId as number);
        setIsSynologyBucket(bucketInfo?.provider?.toLowerCase() === 'synology' || false);
      }
  }
  setSynologyBucket();
  },[selectedBucketId, isZustLoading])

  useEffect(() => {
      if (textAreaRef.current) {
        const computedStyle = window.getComputedStyle(textAreaRef.current);
        setLineHeight(parseInt(computedStyle.lineHeight, 10) || 20);
      }
    }, [urls]);

    const handleScroll = () => {
      if (lineNumbersRef.current && textAreaRef.current) {
        lineNumbersRef.current.scrollTop = textAreaRef.current.scrollTop;
      }
    };

  const handleUpload = async(useProxy: boolean, proxyUrl?:string) => {
    const urlList = urls.split("\n").map(url => url.trim()).filter(Boolean);
    const proxy = useProxy ? proxyUrl : undefined;
    if (urlList.length === 0) return toast.error("No URLs found");
    setProgress(Object.fromEntries(urlList.map((url) => [url, 0])));
    setIsUploading(true)
    for (const [index, url] of urlList.entries()) {
      toast.promise(uploadMultipart(url, selectedBucketId as number, setProgress, encryptBucketConfigAction, proxy, synologyBucket), {
        loading: `Uploading... ${index + 1} of ${urlList.length}`,
        error: `Error occured in number ${index + 1} URL: ${url}`,
      })
    }
    setIsUploading(false);
  };

  return (
  <div className="w-full mx-auto lg:ml-4 space-y-6 px-0 py-2">
        <Card className="p-0 mb-6 border-none outline-none shadow-none">
          <CardContent className="p-0 mt-0 outline-none border-none shadow-none">
            <div className="relative w-full border rounded-md border-muted mx-auto">
                  <div className="flex">
                    <div
                      ref={lineNumbersRef}
                      className="absolute left-0 top-0 bottom-0 w-fit min-w-6 bg-secondary text-primary
                               flex flex-col items-end pr-2 pt-1 rounded-md text-xs overflow-hidden"
                      style={{ overflowY: "hidden" }}
                    >
                      {urls.split("\n").map((_, index) => (
                        <span
                          key={index}
                          className="leading-none"
                          style={{ height: `${lineHeight}px`, lineHeight: `${lineHeight}px` }}
                        >
                          {index + 1}.
                        </span>
                      ))}
                    </div>
                    <Textarea
                      ref={textAreaRef}
                      placeholder="Enter URLs, each on a new line"
                      value={urls}
                      onChange={(e) => setUrls(e.target.value)}
                      onScroll={handleScroll} // Sync scrolling
                      rows={6}
                      className="w-full font-mono text-sm tracking-wide pl-8 pr-2 pt-1 resize-none overflow-auto
                                 whitespace-nowrap border-0 rounded-lg bg-background text-foreground
                                 focus:ring-0 focus:ring-blue-500 focus:outline-none leading-[20px]"
                      style={{ overflowX: "auto" }}
                    />
                  </div>
                </div>
              <div className="flex flex-row space-x-2 gap-4 my-8 h-6 items-center justify-between">
              <div className="flex items-center gap-4 min-w-fit">
                <Switch checked={useProxy} onCheckedChange={setUseProxy} />
                <span className="text-sm">Use Proxy</span>
              </div>
              {useProxy && (
                <Input
                  type="url"
                  placeholder="Enter Proxy URL"
                  value={proxyUrl}
                  onChange={(e) => setProxyUrl(e.target.value)}
                  className="flex w-full"
                />
              )}
            </div>

              <BucketSelector testS3ConnectionAction={testS3ConnectionAction} testConnection={true}/>
            <Button variant={'secondary'} onClick={async()=>await handleUpload(useProxy, proxyUrl)} disabled={isUploading || isZustLoading} className="w-fit mt-8">
              {isZustLoading ? <span>Loading...</span> : isUploading ? "Uploading..." : `Upload to ${selectedBucketName}`}
            </Button>
          </CardContent>
        </Card>
      {Object.keys(progress).length > 0 && (
        <Card className="mt-2">
          <CardContent className="p-4 space-y-4">
            {Object.entries(progress).map(([url, progressValue]) => (
              <div key={url} className="space-y-1">
                <p className="text-sm font-medium truncate overflow-hidden max-w-full" title={url}>
                  {url.length > 30 ? `${url.substring(0, 47)}...` : url}
                </p>
                <div className="flex items-center gap-2">
                  <Progress value={progressValue} className="w-full" />
                  <span className="text-xs font-medium w-12 text-right">{progressValue}%</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
  </div>
  );
}
