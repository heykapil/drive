"use client"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useBucketStore } from "@/hooks/use-bucket-store"
import { Session } from "@/lib/auth"
import { bucketOptions } from "@/service/bucket.config"
import { BellIcon, CloudUpload, CreditCardIcon, FolderInputIcon, FolderOpen, LayoutDashboard, LogOutIcon, Menu, Moon, MoreVerticalIcon, Settings, Share2, Sun, Upload, UserCircleIcon } from "lucide-react"
import { useTheme } from "next-themes"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import { Card, CardContent } from "./ui/card"

const navLinks = [
  { href: '/', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5 text-muted-foreground" /> },
  { href: '/upload', label: 'Upload', icon: <Upload className="h-5 w-5 text-muted-foreground" /> },
  { href: '/upload/remote', label: 'Remote Upload', icon: <CloudUpload className="h-5 w-5 text-muted-foreground" /> },
  { href: '/uploads', label: 'My Files', icon: <FolderOpen className="h-5 w-5 text-muted-foreground" /> },
  { href: '/shared', label: 'Shared Files', icon: <Share2 className="h-5 w-5 text-muted-foreground" /> },
  { href: '/settings', label: 'Settings', icon: <Settings className="h-5 w-5 text-muted-foreground" /> },
];

export default function HeaderNav({ session }: { session: Session }) {
  const [isMounted, setIsMounted] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const { theme, setTheme } = useTheme();
  const { selectedBucket, setSelectedBucket } = useBucketStore();
  const router = useRouter();
  const path = usePathname();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([])
  const [activeStyle, setActiveStyle] = useState({ left: "0px", width: "0px" })

  // Find active index based on current path
  const activeIndex = navLinks.findIndex(link => link.href === path)

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const handleRouteChange = () => {
      setIsNavigating(true);
      const timeout = setTimeout(() => setIsNavigating(false), 300);
      return () => clearTimeout(timeout);
    };
    handleRouteChange();
  }, [path]);

  useEffect(() => {
    const activeElement = tabRefs.current[activeIndex]
    if (activeElement) {
      const { offsetLeft, offsetWidth } = activeElement
      setActiveStyle({
        left: `${offsetLeft}px`,
        width: `${offsetWidth}px`,
      })
    }
  }, [activeIndex, path]) // Update when path changes

  const handleBucketChange = async (value: string) => {
    if (value === selectedBucket) return;

    const prevBucket = selectedBucket;
    try {
      toast.promise(

        async () => {
          setSelectedBucket(value)
        },
        {
          loading: "Changing bucket...",
          success: `Bucket set to ${value}!`,
          error: "Failed to change bucket!",
        }
      );
    } catch {
      setSelectedBucket(prevBucket);
    }
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
            <span className="hidden font-semibold sm:inline-block">kapil.app</span>
          </Link>

          {/* Desktop Navigation */}
          <div className={`justify-center hidden md:flex items-center w-full`}>
            <Card className="w-full border-none shadow-none bg-transparent relative flex items-center justify-center">
              <CardContent className="p-0">
                <div className="relative">
                  {/* Hover Highlight */}
                  <div
                    className="absolute top-1 h-[30px] transition-all duration-300 ease-out bg-[#0e0f1114] dark:bg-[#ffffff1a] rounded-[6px] flex items-center"
                    style={{
                      left: hoveredIndex !== null ? tabRefs.current[hoveredIndex]?.offsetLeft : undefined,
                      width: hoveredIndex !== null ? tabRefs.current[hoveredIndex]?.offsetWidth : undefined,
                      opacity: hoveredIndex !== null ? 1 : 0,
                    }}
                  />

                  {/* Active Indicator */}
                  <div
                    className="absolute not-[]:6px] h-[2px] bg-[#0e0f11] dark:bg-white transition-all duration-300 ease-out"
                    style={activeStyle}
                  />

                  {/* Tabs */}
                  <div className="relative flex space-x-[6px] items-center">
                    {navLinks.map((link, index) => {
                      const isActive = path === link.href
                      return (
                        <Link
                          // @ts-ignore
                          ref={(el) => (tabRefs.current[index] = el)}
                          key={link.href}
                          href={link.href}
                          onMouseEnter={() => setHoveredIndex(index)}
                          onMouseLeave={() => setHoveredIndex(null)}
                          className={`px-3 py-2 text-sm cursor-pointer transition-colors duration-300 ${
                            isActive ? "text-black dark:text-white" : "text-[#0e0f1199] dark:text-[#ffffff99]"
                          }`}
                        >
                          {link.label}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
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
                                         <span className="font-semibold">kapil.app</span>
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
                                     <div className="border-t p-2">
                                       {session ? (
                                         <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                              <Button
                                                className="w-full bg-background text-primary"
                                              >
                                                <Avatar className="h-8 w-8 rounded-lg">
                                                  <AvatarImage src={session.user.image!} alt={session?.user.name} />
                                                  <AvatarFallback className="rounded-lg">KC</AvatarFallback>
                                                </Avatar>
                                                <div className="grid flex-1 text-left text-pretty text-primary text-sm leading-tight">
                                                  <span className="truncate font-medium">{session?.user.name}</span>
                                                  {/* <span className="truncate text-xs">
                                                    {session?.user.email}
                                                  </span> */}
                                                </div>
                                                <MoreVerticalIcon className="ml-auto size-4" />
                                              </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent
                                              className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                                              align="end"
                                              sideOffset={4}
                                              >
                                              <DropdownMenuLabel className="p-0 font-normal">
                                                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                                                  <Avatar className="h-8 w-8 rounded-lg">
                                                    <AvatarImage src={session.user.image!} alt={session?.user.name} />
                                                    <AvatarFallback className="rounded-lg">KC</AvatarFallback>
                                                  </Avatar>
                                                  <div className="grid flex-1 text-left text-sm leading-tight">
                                                    <span className="truncate font-medium">{session.user.name}</span>
                                                    <span className="truncate text-xs text-muted-foreground">
                                                      {session.user.email}
                                                    </span>
                                                  </div>
                                                </div>
                                              </DropdownMenuLabel>
                                              <DropdownMenuSeparator />
                                              <DropdownMenuGroup>
                                                <DropdownMenuItem>
                                                  <UserCircleIcon />
                                                  Account
                                                </DropdownMenuItem>
                                                <DropdownMenuItem>
                                                  <CreditCardIcon />
                                                  Billing
                                                </DropdownMenuItem>
                                                <DropdownMenuItem>
                                                  <BellIcon />
                                                  Notifications
                                                </DropdownMenuItem>
                                              </DropdownMenuGroup>
                                              <DropdownMenuSeparator />
                                              <DropdownMenuItem>
                                                <LogOutIcon />
                                                Log out
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
