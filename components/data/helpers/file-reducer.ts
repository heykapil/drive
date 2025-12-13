import { Dispatch } from "react";

export type FileState = {
    files: any[];
    sort: string;
    search: string;
    page: number;
    limit: number;
    totalPages: number;
    totalFiles: number;
    view: 'list' | 'grid' | 'compact';
    selectedFile: any | null;
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
};

export type FileAction =
    | { type: 'SET_FIELD'; field: string; value: any }
    | { type: 'SET_MODAL'; modal: keyof FileState['modals']; value: boolean }
    | { type: 'RESET' }
    | { type: 'SET_SELECTED_FILE', payload: any };

export const initialState: FileState = {
    files: [],
    sort: 'uploaded_at_desc',
    search: '',
    page: 1,
    limit: 25,
    totalPages: 1,
    totalFiles: 0,
    view: 'list',
    selectedFile: null,
    previewFile: null,
    modals: { delete: false, rename: false, privacy: false, multidelete: false, multipublic: false, multiprivate: false },
    loading: false,
    error: null,
};

export function fileReducer(state: FileState, action: FileAction): FileState {
    switch (action.type) {
        case 'SET_FIELD':
            return { ...state, [action.field]: action.value };
        case 'SET_MODAL':
            return { ...state, modals: { ...state.modals, [action.modal]: action.value } };
        case 'RESET':
            return { ...initialState, view: state.view };
        case "SET_SELECTED_FILE":
            return {
                ...state,
                selectedFile: {
                    ...state.selectedFile,
                    ...action.payload,
                },
            };
        default:
            return state;
    }
}
