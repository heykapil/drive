'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { VideoPlayer } from '@/components/viewer/VideoPlayer5'
import { ytDlp } from '@/lib/actions'
import { getUploadToken } from '@/lib/actions/auth-token'
import { cn } from '@/lib/utils'
import { client } from '@/lib/terabox-client'
import { Download, Info, Link2, Loader2, Play, Search, Video } from 'lucide-react'
import React, { useState } from 'react'

// --- Types ---

interface VideoFormat {
    format_id: string
    url: string
    resolution: string
    vcodec: string
    ext: string
}

interface VideoData {
    id: string
    title: string
    duration_string: string
    uploader: string
    view_count: number
    thumbnail: string
    formats: VideoFormat[]
    tags: string[]
    categories: string[]
    age_limit: number
    error?: string
}

interface TeraboxFile {
    dlink: string
    filename: string
    fs_id: string
    isdir: string
    size: string
}

interface TeraboxResponse {
    data: {
        list: TeraboxFile[]
    }
    success: boolean
}

type ServiceType = 'ytdlp' | 'terabox'

const TERABOX_DOMAINS = [
    'terabox.com',
    'teraboxapp.com',
    '1024terabox.com',
    'terafileshare.com',
    'teraboxlink.com',
    '4funbox.com',
    'mirrobox.com',
    'momerybox.com',
    'teraboxshare.com',
    'terasharefile.com',
]

// --- Helper Functions ---

function detectService(url: string): ServiceType {
    try {
        let text = url.trim()
        if (!text.match(/^https?:\/\//)) {
            text = 'https://' + text
        }
        const urlObj = new URL(text)
        const hostname = urlObj.hostname.toLowerCase()
        if (TERABOX_DOMAINS.some(domain => hostname.includes(domain))) {
            return 'terabox'
        }
    } catch {
        // defaults to ytdlp
    }
    return 'ytdlp'
}

function formatNumber(num: number): string {
    return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(num)
}

function formatBytes(bytes: string | number): string {
    const num = typeof bytes === 'string' ? parseInt(bytes) : bytes
    if (num === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(num) / Math.log(k))
    return parseFloat((num / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// --- Main Component ---

export default function StandardPlayerPage() {
    // State
    const [activeService, setActiveService] = useState<ServiceType>('ytdlp')
    const [inputUrl, setInputUrl] = useState('')

    // Data State
    const [ytdlpData, setYtdlpData] = useState<VideoData | null>(null)
    const [teraboxData, setTeraboxData] = useState<TeraboxResponse | null>(null)

    // UI State
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [selectedFormat, setSelectedFormat] = useState('')
    const [showMetadata, setShowMetadata] = useState(true)

    // Derived
    const isTerabox = activeService === 'terabox'
    const hasContent = (activeService === 'ytdlp' && ytdlpData) || (activeService === 'terabox' && teraboxData)

    // Handlers
    const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const url = e.target.value
        setInputUrl(url)
        setError(null)

        // Auto-detect service
        if (url.length > 5) {
            const detected = detectService(url)
            if (detected !== activeService) setActiveService(detected)
        }
    }

    const fetchData = async () => {
        if (!inputUrl) return
        setLoading(true)
        setError(null)
        setYtdlpData(null)
        setTeraboxData(null)

        try {
            if (activeService === 'ytdlp') {
                const json = await ytDlp(inputUrl)
                if (json.data?.error) throw new Error(json.data.error)
                setYtdlpData(json.data)
                if (json.data.formats?.length) setSelectedFormat(json.data.formats[0].format_id)
            } else {
                const res = await client.terabox.teraboxDownload({ url: inputUrl })
                if (!res.success) throw new Error(res.error || 'Failed to fetch Terabox file')
                // Mapping the response to TeraboxResponse structure expected by state
                // The client returns { success, data: { list: [...] } } which matches TeraboxResponse interface roughly
                // But let's be explicit
                setTeraboxData(res as unknown as TeraboxResponse)
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong')
        } finally {
            setLoading(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') fetchData()
    }

    return (
        // Standard layout wrapper based on Dashboard
        <div className="flex flex-col gap-6">

            {/* Header Section */}
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold">Video Player</h1>
                <p className="text-muted-foreground">Stream and download videos from multiple platforms.</p>
            </div>

            {/* Search Card */}
            <Card>
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg">Source</CardTitle>
                    <CardDescription>
                        {activeService === 'ytdlp'
                            ? 'Detected: YT-DLP (Supports YouTube, Vimeo, and 1000+ sites)'
                            : 'Detected: Terabox Cloud Storage'
                        }
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Input
                                placeholder="Paste video URL here..."
                                value={inputUrl}
                                onChange={handleUrlChange}
                                onKeyDown={handleKeyDown}
                            />
                            {/* Service Indicator inside input */}
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                {activeService === 'ytdlp' ? 'YT-DLP' : 'Terabox'}
                            </div>
                        </div>
                        <Button onClick={fetchData} disabled={!inputUrl || loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Load Video
                        </Button>
                    </div>

                    {error && (
                        <div className="mt-4 p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-md">
                            {error}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Player Section - Only visible when content exists */}
            {hasContent && (
                <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">

                    {/* Main Player Card */}
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle className="line-clamp-1">
                                {activeService === 'ytdlp' ? ytdlpData?.title : teraboxData?.data.list[0].filename}
                            </CardTitle>
                            <CardDescription>
                                {activeService === 'ytdlp' && ytdlpData?.uploader}
                                {activeService === 'terabox' && 'Terabox File'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="aspect-video w-full overflow-hidden rounded-lg border bg-black shadow-sm">
                                {activeService === 'ytdlp' && ytdlpData && (
                                    <VideoPlayer
                                        url={ytdlpData.formats.find(f => f.format_id === selectedFormat)?.url || ''}
                                        id={ytdlpData.id}
                                        poster={ytdlpData.thumbnail}
                                    />
                                )}
                                {activeService === 'terabox' && teraboxData && (
                                    <VideoPlayer
                                        url={teraboxData.data.list[0].dlink}
                                        id={teraboxData.data.list[0].fs_id}
                                    />
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Details & Controls Card */}
                    <Card className="h-fit">
                        <CardHeader>
                            <CardTitle>Details & Options</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">

                            {/* Download / Format Section */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Format / Quality</label>
                                {activeService === 'ytdlp' && ytdlpData && (
                                    <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select quality" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ytdlpData.formats.map((f) => (
                                                <SelectItem key={f.format_id} value={f.format_id}>
                                                    {f.resolution} ({f.ext})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}

                                <Button className="w-full" asChild variant="outline">
                                    <a
                                        href={activeService === 'ytdlp'
                                            ? ytdlpData?.formats.find(f => f.format_id === selectedFormat)?.url
                                            : teraboxData?.data.list[0].dlink}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        <Download className="mr-2 h-4 w-4" />
                                        Download File
                                    </a>
                                </Button>
                            </div>

                            <div className="border-t pt-4 space-y-3">
                                {activeService === 'ytdlp' && ytdlpData && (
                                    <>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Views</span>
                                            <span className="font-medium">{formatNumber(ytdlpData.view_count)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Duration</span>
                                            <span className="font-medium">{ytdlpData.duration_string}</span>
                                        </div>
                                        <div className="space-y-1 pt-2">
                                            <span className="text-sm text-muted-foreground">Categories</span>
                                            <div className="flex flex-wrap gap-1">
                                                {ytdlpData.categories?.map(c => (
                                                    <Badge key={c} variant="secondary" className="font-normal">{c}</Badge>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}

                                {activeService === 'terabox' && teraboxData && (
                                    <>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Size</span>
                                            <span className="font-medium">{formatBytes(teraboxData.data.list[0].size)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">File ID</span>
                                            <span className="font-mono text-xs text-muted-foreground">{teraboxData.data.list[0].fs_id}</span>
                                        </div>
                                    </>
                                )}
                            </div>

                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
}
