"use client"

import React, { useState, useEffect } from "react"
import { extractTeraboxDownloadUrls } from "@/lib/helpers/extractTeraUrls"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { VideoPlayer } from "@/components/viewer/VideoPlayer3"
import { formatBytes } from "@/lib/utils"

interface TeraboxData {
  downloadUrls: string[]
  watchUrls: string[]
  filenames: string[]
  sizes: number[]
}

export default function TeraboxPlayer() {
  const [link, setLink] = useState("")
  const [teraboxData, setTeraboxData] = useState<TeraboxData | null>(null)
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Reset state when link changes
    setTeraboxData(null)
    setCurrentVideoIndex(0)
  }, [link])

  const fetchData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await extractTeraboxDownloadUrls(link)
      setTeraboxData(data)
      setCurrentVideoIndex(0)
    } catch (err) {
      setError("Failed to process the link. Please check if it's valid.")
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  // const handleDownload = () => {
  //   if (!teraboxData) return

  //   const url = teraboxData.downloadUrls[currentVideoIndex]
  //   const fileName = teraboxData.filenames[currentVideoIndex]

  //   const anchor = document.createElement("a")
  //   anchor.href = url
  //   anchor.download = fileName
  //   document.body.appendChild(anchor)
  //   anchor.click()
  //   document.body.removeChild(anchor)
  // }

  const handlePrevious = () => {
    setCurrentVideoIndex(prev => Math.max(prev - 1, 0))
  }

  const handleNext = () => {
    if (teraboxData) {
      setCurrentVideoIndex(prev =>
        Math.min(prev + 1, teraboxData.watchUrls.length - 1)
      )
    }
  }

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-0 gap-2 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-2 row-start-2 items-center sm:items-start">
        <div className="w-[95vw] md:2xl lg:w-4xl mx-auto py-6 px-2 space-y-6">
          <h1 className="text-2xl font-bold lg:px-4">Terabox player</h1>
          <div className="p-4 max-w-4xl mx-auto space-y-4">
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  type="url"
                  placeholder="Enter Terabox link"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={fetchData}
                  disabled={isLoading || !link}
                >
                  {isLoading ? "Processing..." : "Load"}
                </Button>
              </div>

              {error && (
                <p className="text-red-500 text-sm">{error}</p>
              )}
            </div>

            {teraboxData && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold">
                    {teraboxData.filenames[currentVideoIndex]}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {formatBytes(teraboxData.sizes[currentVideoIndex])}
                  </p>
                </div>

                <div className="aspect-video bg-black rounded-lg overflow-hidden">
                  <VideoPlayer
                    id={String(currentVideoIndex)}
                    url={teraboxData.watchUrls[currentVideoIndex]}
                    // className="w-full h-full"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => window.open(teraboxData.downloadUrls[currentVideoIndex], '_blank')}

                    >
                      Download 1
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => window.open(teraboxData.watchUrls[currentVideoIndex], '_blank')}
                    >
                      Download 2
                    </Button>
                  </div>

                  {teraboxData.watchUrls.length > 1 && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePrevious}
                        disabled={currentVideoIndex === 0}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleNext}
                        disabled={currentVideoIndex === teraboxData.watchUrls.length - 1}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
