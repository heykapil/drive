import { CountdownTimer } from "@/components/CountDownTimer";
import FileIcon from "@/components/FileIcon";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { verifyJWT } from "@/lib/helpers/jose";
import { formatBytes } from "@/lib/utils";
import { buckets } from "@/service/bucket.config";
import { query } from "@/service/postgres";
import {
    AlertCircle,
    Calendar,
    Clock,
    Download,
    FileText,
    FileX,
    Link2Off,
    Zap,
} from "lucide-react";

type Params = Promise<{ slug: string }>
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

export default async function FilePage(props: {
  params: Params
  searchParams: SearchParams
}) {
  // const params = await props.params
  const searchParams = await props.searchParams
  const id = searchParams.id;
  const token = searchParams.token;
  let error: { title: string; description: string; icon: React.ReactNode } | null = null;

  if (!id || !token) {
    error = {
      title: "Invalid Link",
      description: "Missing required parameters in the URL.",
      icon: <Link2Off className="h-6 w-6 text-red-500" />,
    };
  }

  const getDownloadUrl = async (id: string, bucket:string) => {
    try {

      const bucketId = Object.keys(buckets).find(
        (key) => buckets[key].name === bucket
      );
      const res = await fetch(process.env.NEXT_PUBLIC_APP_URL+ `/api/files/url?bucket=${bucketId}&fileId=${id}&expiresIn=7200`);
      const { url } = await res.json();
      return url;
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'Failed to get download URL');
      return null;
    }
  };

  const decodedToken = error ? null : await verifyJWT(token as string).catch(() => null);
  if (!decodedToken && !error) {
    error = {
      title: "Invalid Token",
      description: "This download link is no longer valid.",
      icon: <AlertCircle className="h-6 w-6 text-red-500" />,
    };
  }

  const { rows } = error
    ? { rows: [] }
    : await query(
        "SELECT * FROM shared WHERE id = $1 AND token = $2 AND expires > NOW()",
        [String(id), String(token)]
      ).catch(() => ({ rows: [] }));

  if (!rows.length && !error) {
    error = {
      title: "File Not Found",
      description: "The file may have expired or been removed.",
      icon: <FileX className="h-6 w-6 text-red-500" />,
    };
  }

  if (error) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-500/20 via-gray-900 to-black p-6">
        <Alert className="max-w-lg w-full bg-card text-red-500 shadow-lg rounded-xl p-4 flex items-center space-x-4">
          {error.icon}
          <div className="flex-1">
            <AlertTitle className="text-lg font-semibold text-red-500">{error.title}</AlertTitle>
            <AlertDescription className="text-muted-foreground text-sm w-full">
              {error.description}
            </AlertDescription>
          </div>
        </Alert>
      </div>
    );
  }

  const file = rows[0];
  const href = await getDownloadUrl(file.id, file.bucket)
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 bg-gradient-to-br from-neutral-500/20 via-neutral-900 to-black">
      <Card className="w-full max-w-lg p-8 shadow-2xl rounded-2xl bg-card">
        <CardHeader className="flex flex-col items-center space-y-4 pb-6">
          <div className="p-4 bg-accent rounded-full shadow-inner">
            <FileIcon fileType={file.filename} />
          </div>
          <h1 className="text-3xl font-bold text-card-foreground text-center">
            {file.filename}
          </h1>
          <p className="text-sm text-muted-foreground">{file.type}</p>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center space-x-3 p-3 border border-muted rounded-lg">
              <FileText className="w-5 h-5 text-muted-foreground" />
              <span className="font-medium text-foreground">{formatBytes(file.size)}</span>
            </div>

            <div className="flex items-center space-x-3 p-3 border border-muted rounded-lg">
              <Zap className="w-5 h-5 text-muted-foreground" />
              <span className="font-medium text-foreground">{file.type.toUpperCase()}</span>
            </div>

            <div className="col-span-2 flex items-center space-x-3 p-3 border border-muted rounded-lg">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              <span className="text-foreground">
                Expires:{" "}
                {new Date(file.expires).toLocaleString("en-IN", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "numeric",
                })}
              </span>
            </div>

            <div className="col-span-2 flex items-center space-x-3 p-3 border border-muted rounded-lg">
              <Clock className="w-5 h-5 text-primary" />
              <CountdownTimer targetDate={new Date(file.expires)} />
            </div>
          </div>

          <Button
            asChild
            className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg transition-all"
          >
            <a
              href={href}
              download
              className="flex items-center justify-center space-x-2"
            >
              <Download className="w-5 h-5" />
              <span className="text-lg">Download Now</span>
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
