'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useBucketStore } from '@/hooks/use-bucket-store';
import { FolderNode } from '@/lib/utils';
import {
  Check,
  FolderInputIcon,
  FolderOpen,
  LayoutDashboard,
  LogOutIcon,
  Menu,
  Moon,
  PaintBucket,
  RefreshCwIcon,
  Share2,
  Sun,
  Upload,
  VideoIcon,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent } from './ui/card';
import { Skeleton } from './ui/skeleton';

// Your navLinks remain the same...
const navLinks = [
  {
    href: '/',
    label: 'Dashboard',
    icon: <LayoutDashboard className="h-5 w-5 text-muted-foreground" />,
  },
  {
    href: '/buckets',
    label: 'Buckets',
    icon: <PaintBucket className="h-5 w-5 text-muted-foreground" />,
  },
  {
    href: '/upload',
    label: 'Upload',
    icon: <Upload className="h-5 w-5 text-muted-foreground" />,
  },
  {
    href: '/diff',
    label: 'Sync Files',
    icon: <RefreshCwIcon className="h-5 w-5 text-muted-foreground" />,
  },
  {
    href: '/uploads',
    label: 'My Files',
    icon: <FolderOpen className="h-5 w-5 text-muted-foreground" />,
  },
  {
    href: '/player/yt-dlp',
    label: 'Player',
    icon: <VideoIcon className="h-5 w-5 text-muted-foreground" />,
  },
  {
    href: '/shared',
    label: 'Shared Files',
    icon: <Share2 className="h-5 w-5 text-muted-foreground" />,
  },
  {
    href: '/logout',
    label: 'Logout',
    icon: <LogOutIcon className="h-5 w-5 text-muted-foreground" />,
  },
];

// Sub-component for rendering the hierarchical folder selector
function FolderSelector() {
  const { folderTree, isLoading, error, selectedFolderId, selectedFolderName } =
    useBucketStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const handleSelect = (id: number, name: string) => {
    if (id === selectedFolderId) return toast.success('Already selected!');
    const newSearchParams = new URLSearchParams(searchParams.toString());
    newSearchParams.set('folderId', id.toString());
    newSearchParams.delete('bucketId');
    router.push(`${pathname}?${newSearchParams.toString()}`);
    toast.success(`Folder changed to ${name}!`);
  };

  const renderFolderItems = (folders: FolderNode[]) => {
    return folders.map(folder => {
      const hasChildren = folder.children && folder.children.length > 0;
      const isSelected = folder.folder_id === selectedFolderId;

      if (hasChildren) {
        return (
          <DropdownMenuSub key={folder.folder_id}>
            <DropdownMenuSubTrigger className="gap-2">
              <FolderOpen className="mr-2 h-4 w-4  opacity-75" />
              <span className="opacity-100">{folder.folder_name}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                {/* Add an item for the parent folder itself */}
                <DropdownMenuItem
                  onSelect={() =>
                    handleSelect(folder.folder_id, folder.folder_name)
                  }
                >
                  {isSelected && <Check className="w-4 h-4 mr-2" />}
                  <span className={!isSelected ? 'ml-6' : ''}>
                    {folder.folder_name} (root)
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {renderFolderItems(folder.children)}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        );
      }

      return (
        <DropdownMenuItem
          key={folder.folder_id}
          onSelect={() => handleSelect(folder.folder_id, folder.folder_name)}
        >
          {isSelected ? (
            <Check className="w-4 h-4 mr-2" />
          ) : (
            <FolderOpen className={`mr-2 h-4 w-4`} />
          )}
          <span>{folder.folder_name}</span>
        </DropdownMenuItem>
      );
    });
  };

  if (isLoading) {
    return <Skeleton className="w-[180px] h-10" />;
  }

  if (error) {
    return (
      <Button variant="destructive" className="w-[180px]">
        Error
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-[180px] justify-start">
          <FolderInputIcon className="mr-2 h-4 w-4" />
          <span className="truncate">{selectedFolderName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <DropdownMenuLabel>Select a Folder</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {renderFolderItems(folderTree)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function HeaderNav() {
  const { theme, setTheme } = useTheme();
  const path = usePathname();
  const [isMounted, setIsMounted] = useState(false);

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const activeIndex = navLinks.findIndex(link => link.href === path);
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [activeStyle, setActiveStyle] = useState({ left: '0px', width: '0px' });
  useEffect(() => {
    setIsMounted(true);
  }, []);
  useEffect(() => {
    const activeElement = tabRefs.current[activeIndex];
    if (activeElement) {
      setActiveStyle({
        left: `${activeElement.offsetLeft}px`,
        width: `${activeElement.offsetWidth}px`,
      });
    }
  }, [activeIndex, path]);

  // Use a skeleton while the component is not mounted to prevent layout shifts
  if (!isMounted)
    return (
      <>
        <HeaderSkeleton />
      </>
    );

  return (
    <header className="sticky top-0 z-50 w-full px-4 sm:px-8 border-b backdrop-blur-lg bg-background/10">
      <div className="container flex h-12 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/icon1.png"
            alt="Logo"
            className="h-6 w-6"
            width={24}
            height={24}
          />
          <span className="hidden font-semibold sm:inline-block">
            drive.kapil.app
          </span>
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
                    left:
                      hoveredIndex !== null
                        ? tabRefs.current[hoveredIndex]?.offsetLeft
                        : undefined,
                    width:
                      hoveredIndex !== null
                        ? tabRefs.current[hoveredIndex]?.offsetWidth
                        : undefined,
                    opacity: hoveredIndex !== null ? 1 : 0,
                  }}
                />

                {/* Active Indicator */}
                <div
                  className="absolute -bottom-1.75 not-[]:6px] h-[1px] bg-blue-600 dark:bg-green-400 transition-all duration-300 ease-out"
                  style={activeStyle}
                />

                {/* Tabs */}
                <div className="relative flex space-x-[6px] items-center">
                  {navLinks.map((link, index) => {
                    const isActive = path === link.href;
                    if (link.href === '/logout') {
                      return (
                        <a
                          key={link.href}
                          href={link.href}
                          onMouseEnter={() => setHoveredIndex(index)}
                          onMouseLeave={() => setHoveredIndex(null)}
                          // @ts-ignore
                          ref={el => (tabRefs.current[index] = el)}
                          className={`px-3 py-2 text-sm cursor-pointer transition-colors duration-300 ${isActive
                              ? 'text-blue-600 dark:text-green-400'
                              : 'text-[#0e0f1199] dark:text-[#ffffff99]'
                            }`}
                        >
                          {link.label}
                        </a>
                      );
                    }
                    return (
                      <Link
                        // @ts-ignore
                        ref={el => (tabRefs.current[index] = el)}
                        key={link.href}
                        href={link.href}
                        onMouseEnter={() => setHoveredIndex(index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        className={`px-3 py-2 text-sm cursor-pointer transition-colors duration-300 ${isActive
                            ? 'text-blue-600 dark:text-green-400'
                            : 'text-[#0e0f1199] dark:text-[#ffffff99]'
                          }`}
                      >
                        {link.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:block">
            <FolderSelector />
          </div>

          {/* Theme Toggle remains the same */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="hidden md:flex">
                <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme('light')}>
                Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('dark')}>
                Dark
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('system')}>
                System
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile Menu Sheet */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
                <SheetTitle className="sr-only">Toggle menu</SheetTitle>
              </Button>
            </SheetTrigger>
            <SheetContent>
              <div className="flex flex-col h-full">
                <div className="border-b p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-primary">
                    <Image
                      src="/icon1.png"
                      alt="Logo"
                      className="h-6 w-6"
                      loading="lazy"
                      width={24}
                      height={24}
                    />
                    <span className="font-medium">drive</span>
                  </div>
                </div>

                <div className="flex-1 overflow-auto py-2">
                  <nav className="flex flex-col gap-1 px-2">
                    {navLinks.map(link => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={`flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium transition-colors ${path === link.href ? 'bg-accent' : 'hover:bg-accent'
                          }`}
                      >
                        {link.icon}
                        {link.label}
                      </Link>
                    ))}
                  </nav>
                  <div className="border-t mt-2 px-4 py-5">
                    <h3 className="text-sm font-medium mb-3">Storage Bucket</h3>
                    <FolderSelector />
                  </div>
                  <div className="px-4 border-t py-5 mt-2">
                    <div className="space-y-1">
                      <h3 className="text-sm font-medium">Theme</h3>
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          variant={theme === 'light' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setTheme('light')}
                          className="flex-1 justify-start"
                        >
                          <Sun className="mr-2 h-4 w-4" />
                          Light
                        </Button>
                        <Button
                          variant={theme === 'dark' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setTheme('dark')}
                          className="flex-1 justify-start"
                        >
                          <Moon className="mr-2 h-4 w-4" />
                          Dark
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

export function HeaderSkeleton() {
  return (
    <header className="sticky top-0 z-50 w-full px-4 sm:px-8 md:px-16 lg:px-20 border-b backdrop-blur-lg bg-background/10">
      <div className="flex flex-row items-center justify-center mx-auto">
        <div className="container flex h-12 items-center justify-between py-4">
          {/* Logo & Title Skeleton */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded" />
            <Skeleton className="hidden sm:inline-block h-4 w-24" />
          </div>
          {/* Desktop Navigation Skeleton */}
          <div className="hidden md:flex items-center justify-center w-full">
            <Skeleton className="w-full h-8" />
          </div>
          <div className="flex items-center gap-4">
            {/* Bucket Selector Skeleton */}
            <Skeleton className="hidden sm:block w-[180px] h-10 rounded" />
            {/* Theme Toggle Skeleton */}
            <Skeleton className="w-10 h-10 rounded" />
            {/* Mobile Menu Skeleton */}
            <Skeleton className="md:hidden w-10 h-10 rounded" />
          </div>
        </div>
      </div>
    </header>
  );
}
