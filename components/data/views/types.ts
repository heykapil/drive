export interface FileActions {
    onPreview: (file: any) => void;
    onRename: (file: any) => void;
    onDelete: (file: any) => void;
    onDownload: (file: any) => void;
    onShare: (file: any, days: number) => void;
    onTogglePrivacy: (file: any) => void;
    onCopyLink: (file: any) => void;
    onToggleSelection: (fileId: string) => void;
    onSelectAll: () => void;
    onClearSelection: () => void;
    onUpdateThumbnail: (file: any, seconds: number) => void;
    onUpdateDuration: (file: any) => void;
    onUpdateQuality: (file: any) => void;
    onUpdateShareId: (file: any) => void;
}

export interface FileViewProps {
    files: any[];
    selectedFiles: Set<string>;
    actions: FileActions;
}
