export interface FileActions {
    onPreview: (file: any) => void;
    onRename: (file: any) => void;
    onDelete: (file: any) => void;
    onShare: (file: any, days: number) => void;
    onTogglePrivacy: (file: any) => void;
    onCopyLink: (file: any) => void;
    onToggleSelection: (fileId: string) => void;
    onSelectAll: () => void;
    onClearSelection: () => void;
}

export interface FileViewProps {
    files: any[];
    selectedFiles: Set<string>;
    actions: FileActions;
}
