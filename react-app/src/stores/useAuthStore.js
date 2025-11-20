import { create } from 'zustand';

/**
 * Authentication Store
 * Manages Google Drive authentication state
 */
const useAuthStore = create((set) => ({
  // State
  isSignedIn: false,
  isInitialized: false,
  accessToken: null,
  tokenExpiry: null,
  error: null,

  // Drive Folder IDs
  rootFolderId: null,
  formsFolderId: null,
  excelTemplatesFolderId: null,
  dataFileId: null,
  formsDataFileId: null,
  excelDataFileId: null,

  // Actions
  setSignedIn: (isSignedIn) => set({ isSignedIn }),
  setInitialized: (isInitialized) => set({ isInitialized }),
  setAccessToken: (accessToken, tokenExpiry) => set({ accessToken, tokenExpiry }),

  setFolderIds: (folderIds) => set(folderIds),

  signOut: () => set({
    isSignedIn: false,
    accessToken: null,
    tokenExpiry: null,
    rootFolderId: null,
    formsFolderId: null,
    excelTemplatesFolderId: null,
    dataFileId: null,
    formsDataFileId: null,
    excelDataFileId: null,
  }),

  setError: (error) => set({ error }),
}));

export default useAuthStore;
