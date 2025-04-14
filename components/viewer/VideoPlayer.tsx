'use client'
import { VideoPlayer as VideoPlayer5 } from "./VideoPlayer5";
export function VideoPlayer({id, url, poster}:{id: string, url: string, poster?: string}){
  return <VideoPlayer5 id={id} url={url} poster={poster}  />;
}
