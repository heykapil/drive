import { CountdownTimer } from "@/components/CountDownTimer";
import FileIcon from "@/components/data/FileIcon";
import { verifyToken } from "@/lib/helpers/token";
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
import React from "react";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function FilePage(props: {
  params: Params;
  searchParams: SearchParams;
}) {
  const searchParams = await props.searchParams;
  const id = searchParams.id;
  const token = searchParams.token;
  let error: { title: string; description: string; icon: React.ReactNode } | null = null;

  if (!id || !token) {
    error = {
      title: "Invalid Link",
      description: "Missing required parameters in the URL.",
      icon: <Link2Off className="w-6 h-6 text-red-500" />,
    };
  }

  const getDownloadUrl = async (id: string, bucket: string) => {
    try {
      const bucketId = Object.keys(buckets).find(
        (key) => buckets[key].name === bucket
      );
      const res = await fetch(
        process.env.NEXT_PUBLIC_APP_URL +
          `/api/files/url?bucket=${bucketId}&fileId=${id}&expiresIn=7200`
      );
      const { url } = await res.json();
      return url;
    } catch (error) {
      console.error(
        error instanceof Error ? error.message : "Failed to get download URL"
      );
      return null;
    }
  };

  const { valid, expired } = verifyToken(token as string);
  if (!valid || expired) {
    error = {
      title: "Invalid Token",
      description: "This download link is no longer valid.",
      icon: <AlertCircle className="w-6 h-6 text-red-500" />,
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
      icon: <FileX className="w-6 h-6 text-red-500" />,
    };
  }

  if (error) {
    return (
      <div className="min-h-screen flex w-full items-center justify-center bg-gradient-to-r from-red-500 to-red-700 p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <div className="flex items-center space-x-3 animate-pulse">
            {error.icon}
            <div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">
                {error.title}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">{error.description}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const file = rows[0];
  const href = await getDownloadUrl(file.id, file.bucket);
  return (
    <div className="min-h-screen flex items-center w-full justify-center bg-gradient-to-br from-blue-400 via-indigo-500 to-purple-600 p-4">
      <div className="max-w-lg w-full bg-white dark:bg-gray-900 rounded-xl shadow-2xl overflow-hidden transform hover:scale-105 transition duration-300">
        <div className="p-6">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 bg-gray-100 rounded-full shadow-inner animate-bounce">
              <FileIcon fileType={file.filename} />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white text-center truncate">
            {file.filename}
          </h1>
          <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-1">
            {file.type}
          </p>
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <FileText className="w-5 h-5 text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {formatBytes(file.size)}
              </span>
            </div>
            <div className="flex items-center space-x-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <Zap className="w-5 h-5 text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {file.type.toUpperCase()}
              </span>
            </div>
            <div className="col-span-2 flex items-center space-x-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <Calendar className="w-5 h-5 text-gray-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Expires:{" "}
                {new Date(file.expires).toLocaleString('en-IN',{
                  timeZone: 'Asia/Kolkata',
                  dateStyle: 'full',
                  timeStyle: 'long'
                })}
              </span>
            </div>
            <div className="col-span-2 flex items-center space-x-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <Clock className="w-5 h-5 text-blue-500" />
              <CountdownTimer targetDate={new Date(file.expires)} />
            </div>
          </div>
          <div className="mt-6">
            <button className="w-full p-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-colors">
              <a href={href} download className="flex items-center justify-center space-x-2" target="_blank">
                <Download className="w-5 h-5" />
                <span className="text-lg font-semibold">Download Now</span>
              </a>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
