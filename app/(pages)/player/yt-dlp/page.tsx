'use client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VideoPlayer } from '@/components/viewer/VideoPlayer'; // Your existing component
import { ytDlp } from '@/lib/actions';
import { Loader2, Terminal } from 'lucide-react';
import React from 'react';

interface VideoFormat {
  format_id: string;
  url: string;
  resolution: string;
  vcodec: string;
  ext: string;
}

interface VideoData {
  id: string;
  title: string;
  duration_string: string;
  uploader: string;
  view_count: number;
  thumbnail: string;
  formats: VideoFormat[];
  tags: string[];
  categories: string[];
  age_limit: number;
  error?: string;
}

export default function TeraboxPage2() {
  const [inputUrl, setInputUrl] = React.useState('');
  const [selectedFormat, setSelectedFormat] = React.useState('');
  const [data, setData] = React.useState<VideoData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!isValidUrl(inputUrl)) {
      setError('Please enter a valid URL');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const json = await ytDlp(inputUrl);
      if (json.data?.error) {
        throw new Error(json.data.error);
      }

      setData(json.data);
      if (json.data.formats?.length) {
        setSelectedFormat(json.data.formats[0].format_id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch video information');
    } finally {
      setLoading(false);
    }
  };

  const selectedFormatData = data?.formats?.find(f => f.format_id === selectedFormat);

  return (
    <>
      <h1 className="text-2xl font-bold">Video player (yt-dlp)</h1>
      <h2 className="text-md">
      <a className="underline underline-offset-2" href="https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md">
        Supported Domains
      </a>
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4 mb-8">
        <div className="flex flex-col md:flex-row gap-4">
          <Input
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="Enter video URL"
            className="flex-1"
          />
          <Button type="submit" disabled={loading}>
            {loading ? 'Analyzing...' : 'Analyze Video'}
          </Button>
        </div>
      </form>

      {error && (
        <Alert variant="destructive">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && (
        <div className="text-center py-4 inline-flex gap-2 text-primary items-center">
          <Loader2 className="mr-1 h-5 w-5 animate-spin" />
          <span>Fetching video information...</span>
        </div>
      )}

      {data && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{data?.title}</CardTitle>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="outline">{data?.uploader}</Badge>
                <Badge variant="outline">{data?.duration_string}</Badge>
                <Badge variant="outline">{data?.view_count?.toLocaleString()} views</Badge>
                <Badge variant="destructive">Age {data?.age_limit}+</Badge>
              </div>
            </CardHeader>

            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-4">
                  {data?.thumbnail && selectedFormatData?.url && (
                    <div className='h-fit'>
                    <VideoPlayer
                      url={selectedFormatData?.url}
                      id={data?.id}
                      poster={data?.thumbnail}
                    />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Available Formats</Label>
                    <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select format" />
                      </SelectTrigger>
                      <SelectContent>
                        {data?.formats?.map((format) => (
                          <SelectItem key={format?.format_id} value={format?.format_id}>
                            {format?.resolution} ({format.ext.toUpperCase()}) - {format.vcodec}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex space-x-4 items-center gap-4">
                    {selectedFormatData?.url && (
                      <div className='flex w-full aspect-video'>

                        <Button asChild>
                          <a
                            href={selectedFormatData?.url}
                            // download={`${data?.title}.${selectedFormatData?.ext}`}
                            target='_blank'
                          >
                            Download
                          </a>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                {(data?.categories || data?.tags) && (
                  <div className="space-y-4">
                    {data?.categories && (
                      <div>
                        <Label>Categories</Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {data?.categories?.map((category) => (
                            <Badge key={category} variant="secondary">{category}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {data?.tags && (
                      <div>
                        <Label>Tags</Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {data?.tags?.map((tag) => (
                            <Badge key={tag} variant="outline">{tag}</Badge>
                          ))}
                        </div>
                      </div>)}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
