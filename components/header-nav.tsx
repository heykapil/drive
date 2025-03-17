"use client"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useBucketStore } from "@/hooks/use-bucket-store"
import { setBucketCookie } from "@/lib/actions"
import { Session } from "@/lib/auth"
import { CloudUpload, FolderInputIcon, FolderOpen, LayoutDashboard, Menu, Moon, Settings, Share2, Sun, Upload } from "lucide-react"
import { useTheme } from "next-themes"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"

const navLinks = [
  { href: '/', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5 text-muted-foreground" /> },
  { href: '/upload', label: 'Upload', icon: <Upload className="h-5 w-5 text-muted-foreground" /> },
  { href: '/upload/remote', label: 'Remote Upload', icon: <CloudUpload className="h-5 w-5 text-muted-foreground" /> },
  { href: '/uploads', label: 'My Files', icon: <FolderOpen className="h-5 w-5 text-muted-foreground" /> },
  { href: '/shared', label: 'Shared Files', icon: <Share2 className="h-5 w-5 text-muted-foreground" /> },
  { href: '/settings', label: 'Settings', icon: <Settings className="h-5 w-5 text-muted-foreground" /> },
];

const bucketOptions = [
  { value: "default", label: "Default Bucket" },
  { value: "photos", label: "Photos" },
  { value: "docs", label: "Documents" },
  { value: "notes", label: "Notes" },
  { value: "archives", label: "Archives" },
  { value: "videos", label: "Videos" },
];

export default function HeaderNav({ session }: { session: Session }) {
  const [isMounted, setIsMounted] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const { theme, setTheme } = useTheme();
  const { selectedBucket, setSelectedBucket } = useBucketStore();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setIsNavigating(true);
    const timeout = setTimeout(() => setIsNavigating(false), 300);
    return () => clearTimeout(timeout);
  }, [path]);

  const handleBucketChange = async (value: string) => {
    if (value === selectedBucket) return;

    const prevBucket = selectedBucket;
    const success = toast.promise(
      setBucketCookie(value, path)
        .then(() => {
          setSelectedBucket(value);
          localStorage.setItem("s3-bucket", value);
          router.refresh();
          return true;
        })
        .catch(() => false),
      {
        loading: "Changing bucket...",
        success: `Bucket set to ${value}!`,
        error: "Failed to change bucket!",
      }
    );

    if (!success) setSelectedBucket(prevBucket);
  };

  if (!isMounted) return null;

  return (
    <header className="sticky top-0 z-50 w-full px-4 sm:px-8 md:px-16 lg:px-20 border-b backdrop-blur-lg bg-background/10">
      {isNavigating && (
        <div className="absolute top-16 left-0 right-0 h-[2px] bg-background">
          <div className="h-full animate-pulse bg-blue-500 w-1/2" />
        </div>
      )}

      <div className="flex flex-row items-center justify-center mx-auto">
        <div className="container flex h-16 items-center justify-between py-4">
          <Link href="/" className="flex items-center gap-2">
            <Upload className="h-6 w-6" />
            <span className="hidden font-bold sm:inline-block">kapil.app</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 mr-4">
                {navLinks.map((link) => {
                  const isActive = path === link.href

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="relative px-3 py-2 rounded-md text-sm font-medium transition-colors hover:text-primary group"
                    >
                      {isActive && (
                        <span
                          className="absolute inset-0 rounded-md z-0"

                        />
                      )}
                      <span
                        className={`relative z-10 ${
                          isActive ? "text-blue-500 font-semibold" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {link.label}
                      </span>
                      {isActive && (
                        <span
                        className="absolute -bottom-4 left-0 right-0 h-0.5 bg-blue-500 rounded-full"
                        />
                      )}
                    </Link>
                  )
                })}
              </nav>

          <div className="flex items-center gap-4">
            {/* Bucket Selector */}
            <div className="hidden sm:block">
              <Select value={selectedBucket} onValueChange={handleBucketChange}>
                <SelectTrigger className="w-[180px]">
                  <FolderInputIcon className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Select bucket" />
                </SelectTrigger>
                <SelectContent>
                  {bucketOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Theme Toggle */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
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
                           <SheetTitle className="sr-only">Toggle menu</SheetTitle>
                         </Button>
                       </SheetTrigger>
                       <SheetContent side="right" className="w-[300px] sm:w-[350px] p-0">
                         <div className="flex flex-col h-full">
                           <div className="border-b p-4 flex items-center justify-between">
                             <div className="flex items-center gap-2">
                               <Upload className="h-5 w-5 text-primary" />
                               <span className="font-bold">kapil.app</span>
                             </div>
                           </div>

                           <div className="flex-1 overflow-auto py-2">
                             <nav className="flex flex-col gap-1 px-2">
                               {navLinks.map((link) => (
                                 <Link
                                   key={link.href}
                                   href={link.href}
                                   className={`flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium transition-colors ${
                                     path === link.href ? 'bg-accent' : 'hover:bg-accent'
                                   }`}
                                 >
                                   {link.icon}
                                   {link.label}
                                 </Link>
                               ))}
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

                             <div className="border-t mt-2 px-4 py-5">
                               <h3 className="text-sm font-medium mb-3">Storage Bucket</h3>
                               <Select value={selectedBucket} onValueChange={handleBucketChange}>
                                 <SelectTrigger className="w-full">
                                   <FolderOpen className="mr-2 h-4 w-4 text-muted-foreground" />
                                   <SelectValue placeholder="Select bucket" />
                                 </SelectTrigger>
                                 <SelectContent>
                                   {bucketOptions.map((option) => (
                                     <SelectItem key={option.value} value={option.value}>
                                       {option.label}
                                     </SelectItem>
                                   ))}
                                 </SelectContent>
                               </Select>
                             </div>
                           </div>
                           {/* Mobile Session Popover */}
                           <div className="border-t p-4">
                             {session ? (
                               <DropdownMenu>
                                 <DropdownMenuTrigger asChild>
                                   <Button variant="ghost" className="w-full justify-start">
                                     <div className="flex flex-col items-start">
                                       <span className="font-medium">{session.user?.name}</span>
                                       <span className="text-xs text-muted-foreground">{session.user?.email}</span>
                                     </div>
                                   </Button>
                                 </DropdownMenuTrigger>
                                 <DropdownMenuContent className="w-[calc(100vw-2rem)] sm:w-full">
                                   <DropdownMenuItem onSelect={() => router.push('/profile')}>
                                     Profile
                                   </DropdownMenuItem>
                                   <DropdownMenuItem onSelect={() => router.push('/settings')}>
                                     Settings
                                   </DropdownMenuItem>
                                   <DropdownMenuItem onSelect={() => {/* Add logout logic */}}>
                                     Logout
                                   </DropdownMenuItem>
                                 </DropdownMenuContent>
                               </DropdownMenu>
                             ) : (
                               <Button variant="default" className="w-full" onClick={() => router.push('/login')}>
                                 Login
                               </Button>
                             )}
                           </div>
                         </div>
                       </SheetContent>
                     </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
