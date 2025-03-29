export type File = {
  id : string,
  filename : string,
  key : string,
  size : number,
  type : string,
  uploaded_at : Date,
  is_public : boolean,
  bucket : string,
}

export type FilewithURL = {
  id : string,
  filename : string,
  key : string,
  size : number,
  type : string,
  uploaded_at : Date,
  is_public : boolean,
  bucket : string,
  url: string
}


export type FileItem = {
  id: number;
  filename: string;
  size: number;
  type: string;
  key: string;
  bucket: string;
  url?: string;
  is_public: boolean;
  uploaded_at: string;
  liked?: boolean;
};

export type FileState = {
  files: FileItem[];
  sort: string;
  search: string;
  currentPage: number;
  apiPage: number;
  viewPageSize: number;
  totalFiles: number;
  view: "list" | "grid" | "compact";
  selectedFile: FileItem | null;
  previewFile: any | null;
  modals: {
    delete: boolean;
    rename: boolean;
    privacy: boolean;
    multidelete: boolean;
    multipublic: boolean;
    multiprivate: boolean;
  };
  loading: boolean;
  error: string | null;
  fetchedPages: Set<number>;
};

export type FileAction =
  | { type: "SET_FIELD"; field: keyof FileState; value: any }
  | { type: "SET_MODAL"; modal: keyof FileState["modals"]; value: boolean }
  | { type: "RESET" }
  | { type: "SET_SELECTED_FILE"; payload: Partial<FileItem> }
  | { type: "APPEND_FILES"; files: FileItem[] }
  | { type: "REPLACE_FILES"; files: FileItem[] };
