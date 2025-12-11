import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import WindowControls from './components/WindowControls';
import FileList from './components/FileList';
import { Icons } from './components/Icon';
import { FileItem, RenameRule } from './types';
import { INITIAL_RULE } from './constants';
import { generateRuleFromPrompt } from './services/geminiService';

const App: React.FC = () => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [rule, setRule] = useState<RenameRule>(INITIAL_RULE);
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isDirectMode, setIsDirectMode] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to generate new name based on rule
  const calculateNewName = useCallback((originalName: string, r: RenameRule): string => {
    if (!r.isActive) return originalName;
    
    let newName = originalName;

    try {
      if (r.type === 'replace' || r.type === 'remove') {
        const replaceWith = r.type === 'remove' ? '' : r.replace;
        if (r.find) {
           // Case insensitive global replacement
           // Escaping special characters for simple string find if not regex
           const pattern = r.useRegex 
            ? new RegExp(r.find, 'g') 
            : new RegExp(r.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
           newName = newName.replace(pattern, replaceWith);
        }
      } else if (r.type === 'prepend') {
        newName = r.replace + newName;
      } else if (r.type === 'append') {
        // Handle extension
        const lastDotIndex = newName.lastIndexOf('.');
        if (lastDotIndex !== -1) {
          const name = newName.substring(0, lastDotIndex);
          const ext = newName.substring(lastDotIndex);
          newName = name + r.replace + ext;
        } else {
          newName = newName + r.replace;
        }
      } else if (r.type === 'regex') {
         if (r.find) {
           try {
             const regex = new RegExp(r.find, 'g');
             newName = newName.replace(regex, r.replace);
           } catch (e) {
             // Invalid regex, return original
             return originalName;
           }
         }
      }
    } catch (e) {
      console.warn("Error calculating name", e);
      return originalName;
    }

    return newName;
  }, []);

  // Recalculate all names when rule or files change
  useEffect(() => {
    setFiles(prevFiles => prevFiles.map(f => {
      // Don't rename files that are already successfully processed
      if (f.status === 'success') return f;
      return {
        ...f,
        newName: calculateNewName(f.originalName, rule)
      };
    }));
  }, [rule, calculateNewName]); 

  // Traditional File Upload (Fallback)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsDirectMode(false);
    if (e.target.files && e.target.files.length > 0) {
      const newFiles: FileItem[] = Array.from(e.target.files).map((f: File) => ({
        id: Math.random().toString(36).substring(7),
        file: f,
        originalName: f.name,
        newName: calculateNewName(f.name, rule),
        relativePath: f.webkitRelativePath || f.name,
        status: 'pending'
      }));
      setFiles(prev => [...prev, ...newFiles]);
      e.target.value = '';
    }
  };

  // Direct Directory Access
  const handleOpenDirectory = async () => {
    if (!('showDirectoryPicker' in window)) {
      alert("Your browser does not support direct folder access. Please use Chrome, Edge, or Opera.");
      return;
    }

    try {
      const dirHandle = await window.showDirectoryPicker();
      setIsDirectMode(true);
      setFiles([]); // Clear existing for clean state
      
      const newFiles: FileItem[] = [];
      
      // Recursive scanner
      const scanDirectory = async (handle: FileSystemDirectoryHandle, pathPrefix: string) => {
        for await (const entry of handle.values()) {
          const relativePath = pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name;
          
          if (entry.kind === 'file') {
            const file = await (entry as FileSystemFileHandle).getFile();
            // Skip hidden files or system files if needed, currently importing all
            if (!entry.name.startsWith('.')) {
              newFiles.push({
                id: Math.random().toString(36).substring(7),
                file: file,
                originalName: entry.name,
                newName: entry.name, // Calculated by effect later
                relativePath: relativePath,
                handle: entry as FileSystemFileHandle,
                status: 'pending'
              });
            }
          } else if (entry.kind === 'directory') {
             await scanDirectory(entry as FileSystemDirectoryHandle, relativePath);
          }
        }
      };

      await scanDirectory(dirHandle, '');
      
      // Initial calculation
      const calculatedFiles = newFiles.map(f => ({
        ...f,
        newName: calculateNewName(f.originalName, rule)
      }));
      
      setFiles(calculatedFiles);

    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error("Error accessing directory:", err);
        alert("Failed to access directory.");
      }
    }
  };

  const handleRemoveFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleClearAll = () => {
    setFiles([]);
    setIsDirectMode(false);
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setIsAiLoading(true);
    const newRule = await generateRuleFromPrompt(aiPrompt);
    if (newRule) {
      setRule(newRule);
    }
    setIsAiLoading(false);
  };

  // Logic for applying changes directly to disk
  const handleApplyChangesToDisk = async () => {
    const filesToRename = files.filter(f => f.originalName !== f.newName && f.status !== 'success');
    
    if (filesToRename.length === 0) {
      alert("No pending changes to apply.");
      return;
    }

    if (!confirm(`Are you sure you want to rename ${filesToRename.length} files directly on your disk? This cannot be undone.`)) {
      return;
    }

    setIsProcessing(true);
    let successCount = 0;
    let errorCount = 0;

    // Process sequentially to handle permissions gracefully if needed, 
    // though parallel is faster.
    for (const fileItem of filesToRename) {
      if (!fileItem.handle) {
        console.error("Missing file handle for", fileItem.relativePath);
        continue;
      }

      try {
        // Chrome/Edge support .move(newName)
        if ('move' in fileItem.handle) {
             await fileItem.handle.move(fileItem.newName);
        } else {
             throw new Error("Browser does not support direct rename.");
        }
        
        // Update state to reflect success
        setFiles(prev => prev.map(p => 
          p.id === fileItem.id 
            ? { ...p, originalName: p.newName, status: 'success' } 
            : p
        ));
        successCount++;
      } catch (err) {
        console.error(`Failed to rename ${fileItem.relativePath}:`, err);
        errorCount++;
        setFiles(prev => prev.map(p => 
          p.id === fileItem.id 
            ? { ...p, status: 'error' } 
            : p
        ));
      }
    }

    setIsProcessing(false);
    if (errorCount > 0) {
      alert(`Completed with errors. Success: ${successCount}, Failed: ${errorCount}. Check console/list for details.`);
    } else {
      // alert(`Successfully renamed ${successCount} files.`);
    }
  };

  const handleDownloadZip = async () => {
    setIsProcessing(true);
    const zip = new JSZip();
    
    files.forEach(f => {
      let path = f.newName;
      if (f.relativePath) {
         const parts = f.relativePath.split('/');
         if (parts.length > 1) {
            parts.pop(); 
            path = parts.join('/') + '/' + f.newName;
         }
      }
      zip.file(path, f.file);
    });

    try {
      const content = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = "renamed_files.zip";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Zip failed", err);
      alert("Failed to create ZIP file.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyScript = () => {
    const script = files
      .filter(f => f.originalName !== f.newName)
      .map(f => {
         const originalPath = f.relativePath || f.originalName;
         let newPath = f.newName;
         
         if (f.relativePath) {
             const parts = f.relativePath.split('/');
             if (parts.length > 1) {
                parts.pop();
                newPath = parts.join('/') + '/' + f.newName;
             }
         }
         return `mv "${originalPath}" "${newPath}"`;
      })
      .join('\n');
    
    if (!script) {
      alert("No files to rename.");
      return;
    }

    const fullScript = `#!/bin/bash\n# Batch Rename Script\n\n${script}`;
    navigator.clipboard.writeText(fullScript).then(() => {
      alert("Shell script copied to clipboard!");
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-8">
      {/* Main Window */}
      <div className="w-full max-w-5xl h-[85vh] bg-macOS-window rounded-xl shadow-2xl overflow-hidden flex flex-col border border-macOS-border">
        
        {/* Titlebar / Toolbar */}
        <div className="bg-[#F5F5F6] border-b border-macOS-border flex items-center justify-between h-14 shrink-0">
          <div className="flex items-center w-1/3">
             <WindowControls />
          </div>
          <div className="text-sm font-semibold text-macOS-text select-none w-1/3 text-center flex flex-col items-center leading-tight">
            <span>Renamer Pro</span>
            {isDirectMode && <span className="text-[10px] text-macOS-active font-medium">Local Disk Mode</span>}
          </div>
          <div className="w-1/3 flex justify-end px-4 gap-2">
             <button 
               onClick={handleOpenDirectory}
               className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-md shadow-sm text-sm font-medium active:scale-95 transition-all
                 ${isDirectMode 
                   ? 'bg-macOS-active text-white border-transparent' 
                   : 'bg-white border-macOS-border text-macOS-text hover:bg-gray-50'}`}
               title="Open Local Folder (Direct Edit)"
             >
               <Icons.FolderPlus className="w-4 h-4" />
               <span className="hidden xl:inline">Open Local Folder</span>
               <span className="xl:hidden">Folder</span>
             </button>
             
             <div className="h-6 w-px bg-macOS-border mx-1 self-center"></div>

             <button 
               onClick={() => fileInputRef.current?.click()}
               className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-macOS-border rounded-md shadow-sm text-sm font-medium hover:bg-gray-50 active:scale-95 transition-all text-macOS-text"
               title="Import Files (Safe Mode)"
             >
               <Icons.FilePlus className="w-4 h-4" />
               <span className="hidden xl:inline">Import Files</span>
               <span className="xl:hidden">Files</span>
             </button>
             <input 
               type="file" 
               multiple 
               className="hidden" 
               ref={fileInputRef} 
               onChange={handleFileUpload} 
             />
          </div>
        </div>

        {/* Content Area */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* Main List */}
          <div className="flex-1 bg-white relative flex flex-col">
            <FileList files={files} onRemove={handleRemoveFile} />
            
            {/* Bottom Status Bar for List */}
            <div className="h-8 border-t border-macOS-border bg-[#F5F5F6] flex items-center justify-between px-4 text-xs text-macOS-secondary select-none shrink-0">
              <span>{files.length} items {isDirectMode ? '(Local Access)' : ''}</span>
              {files.length > 0 && (
                <button onClick={handleClearAll} className="hover:text-macOS-danger">Clear All</button>
              )}
            </div>
          </div>

          {/* Sidebar / Inspector Panel */}
          <div className="w-80 bg-[#F5F5F7] border-l border-macOS-border flex flex-col overflow-y-auto">
             
             {/* AI Section */}
             <div className="p-4 border-b border-macOS-border bg-white/50">
               <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-macOS-text">
                 <Icons.Wand2 className="w-4 h-4 text-purple-500" />
                 <span>Smart AI Rule</span>
               </div>
               <div className="flex gap-2">
                 <input 
                   type="text" 
                   value={aiPrompt}
                   onChange={(e) => setAiPrompt(e.target.value)}
                   placeholder="e.g. Remove dates..." 
                   className="flex-1 px-3 py-1.5 text-sm border border-macOS-border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                   onKeyDown={(e) => e.key === 'Enter' && handleAiGenerate()}
                 />
                 <button 
                   onClick={handleAiGenerate}
                   disabled={isAiLoading || !process.env.API_KEY}
                   className={`p-2 rounded-md bg-white border border-macOS-border hover:bg-purple-50 transition-colors ${isAiLoading ? 'animate-pulse' : ''}`}
                   title={!process.env.API_KEY ? "API Key required" : "Generate Rule"}
                 >
                    {isAiLoading ? <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div> : <Icons.Wand2 className="w-4 h-4 text-purple-600" />}
                 </button>
               </div>
             </div>

             {/* Manual Rules */}
             <div className="p-4 flex-1">
               <h3 className="text-xs font-semibold text-macOS-secondary uppercase tracking-wider mb-3">Settings</h3>
               
               <div className="space-y-4">
                 <div className="space-y-1">
                   <label className="text-xs text-macOS-text font-medium">Mode</label>
                   <select 
                     value={rule.type}
                     onChange={(e) => setRule({...rule, type: e.target.value as RenameRule['type']})}
                     className="w-full px-3 py-2 text-sm bg-white border border-macOS-border rounded-lg shadow-sm focus:outline-none focus:border-macOS-active"
                   >
                     <option value="replace">Find & Replace</option>
                     <option value="remove">Remove Text</option>
                     <option value="prepend">Add Prefix</option>
                     <option value="append">Add Suffix</option>
                     <option value="regex">Regular Expression</option>
                   </select>
                 </div>

                 {(rule.type === 'replace' || rule.type === 'remove' || rule.type === 'regex') && (
                   <div className="space-y-1">
                     <label className="text-xs text-macOS-text font-medium">Find</label>
                     <div className="relative">
                       <input 
                        type="text" 
                        value={rule.find}
                        onChange={(e) => setRule({...rule, find: e.target.value})}
                        placeholder={rule.type === 'regex' ? "(\\d{4})" : "Text to find..."}
                        className="w-full px-3 py-2 text-sm bg-white border border-macOS-border rounded-lg shadow-sm focus:outline-none focus:border-macOS-active"
                       />
                       <Icons.Search className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
                     </div>
                   </div>
                 )}

                {(rule.type === 'replace' || rule.type === 'prepend' || rule.type === 'append' || rule.type === 'regex') && (
                   <div className="space-y-1">
                     <label className="text-xs text-macOS-text font-medium">
                       {rule.type === 'prepend' ? 'Prefix' : rule.type === 'append' ? 'Suffix' : 'Replace with'}
                     </label>
                     <input 
                      type="text" 
                      value={rule.replace}
                      onChange={(e) => setRule({...rule, replace: e.target.value})}
                      placeholder="Replacement text..."
                      className="w-full px-3 py-2 text-sm bg-white border border-macOS-border rounded-lg shadow-sm focus:outline-none focus:border-macOS-active"
                     />
                   </div>
                 )}

                 {rule.type === 'replace' && (
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="useRegex"
                        checked={rule.useRegex}
                        onChange={(e) => setRule({...rule, useRegex: e.target.checked})}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor="useRegex" className="text-xs text-macOS-text select-none">Use Regular Expressions</label>
                    </div>
                 )}
               </div>
             </div>

             {/* Actions */}
             <div className="p-4 border-t border-macOS-border bg-white space-y-3">
               
               {isDirectMode ? (
                 <button 
                   onClick={handleApplyChangesToDisk}
                   disabled={files.length === 0 || isProcessing}
                   className="w-full flex items-center justify-center gap-2 bg-macOS-danger text-white py-2.5 px-4 rounded-lg text-sm font-medium shadow-sm hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   {isProcessing ? (
                     <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                   ) : (
                     <Icons.Save className="w-4 h-4" />
                   )}
                   Rename Files on Disk
                 </button>
               ) : (
                 <button 
                   onClick={handleDownloadZip}
                   disabled={files.length === 0 || isProcessing}
                   className="w-full flex items-center justify-center gap-2 bg-macOS-active text-white py-2 px-4 rounded-lg text-sm font-medium shadow-sm hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   {isProcessing ? (
                     <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                   ) : (
                     <Icons.Download className="w-4 h-4" />
                   )}
                   Download as ZIP
                 </button>
               )}

               {!isDirectMode && (
                 <button 
                   onClick={handleCopyScript}
                   disabled={files.length === 0}
                   className="w-full flex items-center justify-center gap-2 bg-white border border-macOS-border text-macOS-text py-2 px-4 rounded-lg text-sm font-medium shadow-sm hover:bg-gray-50 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   <Icons.Terminal className="w-4 h-4" />
                   Copy Shell Script
                 </button>
               )}
             </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
