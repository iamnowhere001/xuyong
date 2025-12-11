export interface FileItem {
  id: string;
  file: File;
  originalName: string;
  newName: string;
  status: 'pending' | 'success' | 'error';
  // The handle is required for direct local modification
  handle?: FileSystemFileHandle; 
  // Path relative to the root of the selected directory
  relativePath: string; 
}

export interface RenameRule {
  type: 'replace' | 'remove' | 'prepend' | 'append' | 'regex';
  find: string;
  replace: string;
  useRegex: boolean;
  isActive: boolean;
}

// Declaration for JSZip loaded via CDN
declare global {
  class JSZip {
    file(name: string, content: Blob | string | File): this;
    generateAsync(options: { type: 'blob' }): Promise<Blob>;
  }

  // File System Access API Types
  interface FileSystemHandle {
    readonly kind: 'file' | 'directory';
    readonly name: string;
    isSameEntry(other: FileSystemHandle): Promise<boolean>;
  }

  interface FileSystemFileHandle extends FileSystemHandle {
    getFile(): Promise<File>;
    createWritable(options?: any): Promise<FileSystemWritableFileStream>;
    move(newName: string): Promise<void>; // Chrome/Edge specific
  }

  interface FileSystemDirectoryHandle extends FileSystemHandle {
    values(): AsyncIterableIterator<FileSystemHandle>;
    getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
    getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
  }

  interface FileSystemWritableFileStream extends WritableStream {
    write(data: any): Promise<void>;
    seek(position: number): Promise<void>;
    truncate(size: number): Promise<void>;
  }
  
  interface Window {
    showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
  }
}
