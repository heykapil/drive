"use client"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useBucketStore } from "@/hooks/use-bucket-store"
import { setBucketCookie } from "@/lib/actions"
import { FolderOpen, Menu, Moon, Settings, Sun, Upload } from "lucide-react"
import { useTheme } from "next-themes"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"


export default function HeaderNav() {
  const [isMounted, setIsMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const { selectedBucket, setSelectedBucket } = useBucketStore();

  const router = useRouter ()
  useEffect(() => {
    setIsMounted(true)
  }, [])

  const path = usePathname();
  const handleBucketChange = async (value: string) => {
    if (value === selectedBucket) return; // Avoid redundant updates

    const prevBucket = selectedBucket; // Store the previous value

    const success =  toast.promise(
      setBucketCookie(value, path as string)
        .then(() => {
          setSelectedBucket(value); // Update state only if successful
          localStorage.setItem('s3-bucket', value)
          router.refresh();
          return true;
        })
        .catch(() => {
          return false; // No need to revert state since we didn't update it yet
        }),
      {
        loading: 'Changing bucket...',
        success: `Bucket set to ${value}!`,
        error: 'Failed to change bucket!',
      }
    );

    if (!success) setSelectedBucket(prevBucket); // Revert only if needed
  };

  if (!isMounted) {
    return null
  }

  return (
    <header className="sticky top-0 z-40 w-full px-4 sm:px-8 md:px-16 lg:px-20 border-b bg-background">
      <div className="flex flex-row items-center justify-center mx-auto">
      <div className="container flex h-16 items-center justify-between py-4">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <Upload className="h-6 w-6" />
            <span className="hidden font-bold sm:inline-block">kapil.app</span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6 mr-4">
          <Link href="/" className="text-sm font-medium transition-colors hover:text-primary">
           Dashboard
          </Link>
          <Link href="/upload" className="text-sm font-medium transition-colors hover:text-primary">
           Upload
          </Link>
          <Link href="/upload/remote" className="text-sm font-medium transition-colors hover:text-primary">
           Remote Upload
          </Link>
          <Link href="/uploads" className="text-sm font-medium transition-colors hover:text-primary">
            My Files
          </Link>
          <Link href="/settings" className="text-sm font-medium transition-colors hover:text-primary">
            Settings
          </Link>
        </nav>

      </div>

        <div className="flex items-center gap-4">
          {/* Bucket Selector */}
          <div className="hidden sm:block">
            <Select value={selectedBucket} onValueChange={handleBucketChange}>
              <SelectTrigger className="w-[180px]">
                <FolderOpen className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Select bucket" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default Bucket</SelectItem>
                <SelectItem value="photos">Photos</SelectItem>
                <SelectItem value="docs">Documents</SelectItem>
                <SelectItem value="notes">Notes</SelectItem>
                <SelectItem value="archives">Archives</SelectItem>
                <SelectItem value="videos">Videos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Theme Toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme("light")}>Light</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>Dark</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")}>System</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile Menu */}
          <Sheet>
                      <SheetTrigger asChild>

                        <Button variant="outline" size="icon" className="md:hidden">
                          <Menu className="h-5 w-5" />
                          <SheetTitle className="sr-only">
                          <span className="sr-only">Toggle menu</span>
                          </SheetTitle>
                        </Button>
                      </SheetTrigger>
                      <SheetContent side="right" className="w-[300px] sm:w-[350px] p-0">
                        <div className="flex flex-col h-full">
                          {/* Mobile Menu Header */}
                          <div className="border-b p-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Upload className="h-5 w-5 text-primary" />
                              <span className="font-bold">FileUploader</span>
                            </div>
                            {/* <SheetTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8">
                                <X className="h-4 w-4" />
                                <span className="sr-only">Close menu</span>
                              </Button>
                            </SheetTrigger> */}
                          </div>

                          {/* Mobile Menu Content */}
                          <div className="flex-1 overflow-auto py-2">
                            <nav className="flex flex-col gap-1 px-2">
                              <Link
                                href="/"
                                className="flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium transition-colors hover:bg-accent"
                              >
                                <FolderOpen className="h-5 w-5 text-muted-foreground" />
                                Dashboard
                              </Link>
                              <Link
                                href="/upload"
                                className="flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium transition-colors hover:bg-accent"
                              >
                                <FolderOpen className="h-5 w-5 text-muted-foreground" />
                                Upload
                              </Link>
                              <Link
                                href="/upload/remote"
                                className="flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium transition-colors hover:bg-accent"
                              >
                                <FolderOpen className="h-5 w-5 text-muted-foreground" />
                                Remote upload
                              </Link>
                              <Link
                                href="/uploads"
                                className="flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium transition-colors hover:bg-accent"
                              >
                                <Upload className="h-5 w-5 text-muted-foreground" />
                                My Uploads
                              </Link>
                              <Link
                                href="/settings"
                                className="flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium transition-colors hover:bg-accent"
                              >
                                <Settings className="h-5 w-5 text-muted-foreground" />
                                Settings
                              </Link>
                            </nav>

                            <div className="px-4 py-5 mt-2">
                              <div className="space-y-1">
                                <h3 className="text-sm font-medium">Theme</h3>
                                <div className="flex items-center gap-2 mt-2">
                                  <Button
                                    variant={theme === "light" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setTheme("light")}
                                    className="flex-1 justify-start"
                                  >
                                    <Sun className="mr-2 h-4 w-4" />
                                    Light
                                  </Button>
                                  <Button
                                    variant={theme === "dark" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setTheme("dark")}
                                    className="flex-1 justify-start"
                                  >
                                    <Moon className="mr-2 h-4 w-4" />
                                    Dark
                                  </Button>
                                </div>
                              </div>
                            </div>

                            {/* Mobile Bucket Selector */}
                            <div className="border-t mt-2 px-4 py-5">
                              <h3 className="text-sm font-medium mb-3">Storage Bucket</h3>
                              <Select value={selectedBucket} onValueChange={handleBucketChange}>
                                <SelectTrigger className="w-full">
                                  <FolderOpen className="mr-2 h-4 w-4 text-muted-foreground" />
                                  <SelectValue placeholder="Select bucket" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="default">Default Bucket</SelectItem>
                                  <SelectItem value="images">Images</SelectItem>
                                  <SelectItem value="documents">Documents</SelectItem>
                                  <SelectItem value="videos">Videos</SelectItem>
                                  <SelectItem value="archives">Archives</SelectItem>
                                </SelectContent>
                              </Select>

                              <div className="mt-4">
                                <p className="text-xs text-muted-foreground">
                                  Selected files will be uploaded to the <span className="font-medium">{selectedBucket}</span>{" "}
                                  bucket.
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Mobile Menu Footer */}
                          <div className="border-t p-4">
                            <a className="w-full flex flex-row items-center justify-center" role="link" href={'/'}>
                              <Upload className="mr-2 h-4 w-4" />
                              Upload New File
                            </a>
                          </div>
                        </div>
                      </SheetContent>
                    </Sheet>
        </div>
      </div>
    </header>
  )
}
