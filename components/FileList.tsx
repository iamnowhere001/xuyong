import React from 'react';
import { FileItem } from '../types';
import { Icons } from './Icon';

interface FileListProps {
  files: FileItem[];
  onRemove: (id: string) => void;
}

const FileList: React.FC<FileListProps> = ({ files, onRemove }) => {
  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-macOS-secondary select-none">
        <Icons.FolderOpen className="w-16 h-16 mb-4 opacity-50" />
        <p className="text-lg font-medium">No files selected</p>
        <p className="text-sm">Drag files here or click Import</p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full pb-4">
      <table className="w-full text-left border-collapse">
        <thead className="sticky top-0 bg-white/80 backdrop-blur-md z-10 border-b border-macOS-border">
          <tr>
            <th className="py-2 px-4 text-xs font-semibold text-macOS-secondary uppercase tracking-wider w-10"></th>
            <th className="py-2 px-4 text-xs font-semibold text-macOS-secondary uppercase tracking-wider w-[40%]">Original Name</th>
            <th className="py-2 px-4 text-xs font-semibold text-macOS-secondary uppercase tracking-wider w-[5%]"></th>
            <th className="py-2 px-4 text-xs font-semibold text-macOS-secondary uppercase tracking-wider w-[40%]">New Name</th>
            <th className="py-2 px-4 text-xs font-semibold text-macOS-secondary uppercase tracking-wider"></th>
          </tr>
        </thead>
        <tbody>
          {files.map((file, index) => {
            const isChanged = file.originalName !== file.newName;
            // Use the relativePath from the item, or fallback to name
            const displayPath = file.relativePath || file.originalName;

            return (
              <tr 
                key={file.id} 
                className={`
                  group border-b border-macOS-border last:border-0 
                  ${index % 2 === 0 ? 'bg-white' : 'bg-macOS-bg'}
                  hover:bg-blue-50 transition-colors
                `}
              >
                <td className="py-3 px-4">
                  <div className="flex justify-center">
                    {file.status === 'success' ? (
                       <Icons.FileIcon className="w-4 h-4 text-macOS-success" />
                    ) : file.status === 'error' ? (
                       <Icons.FileIcon className="w-4 h-4 text-macOS-danger" />
                    ) : (
                       <Icons.FileIcon className="w-4 h-4 text-macOS-secondary" />
                    )}
                  </div>
                </td>
                <td className="py-3 px-4 text-sm text-macOS-text truncate max-w-[200px]" title={displayPath}>
                  {file.originalName}
                  {file.relativePath && file.relativePath !== file.originalName && (
                    <div className="text-[10px] text-macOS-secondary truncate">{file.relativePath}</div>
                  )}
                </td>
                <td className="py-3 px-4 text-center">
                  <Icons.ArrowRight className={`w-3 h-3 text-macOS-secondary ${isChanged ? 'opacity-100' : 'opacity-20'}`} />
                </td>
                <td className={`py-3 px-4 text-sm truncate max-w-[200px] font-medium ${isChanged ? 'text-macOS-active' : 'text-macOS-secondary'}`} title={file.newName}>
                  {file.newName}
                </td>
                <td className="py-3 px-4 text-right">
                  <button 
                    onClick={() => onRemove(file.id)}
                    className="p-1 hover:bg-macOS-border rounded text-macOS-secondary hover:text-macOS-danger transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 outline-none"
                    aria-label="Remove file"
                  >
                    <Icons.X className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default FileList;
