import { useEffect, useRef, useState } from 'react';

interface FileEntry {
  label: string;
  path: string;
  category: string;
}

/** Exported so App.tsx can guard in-app navigation */
export const memoryIsDirtyRef = { current: false };

export default function MemoryPanel() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>('CLAUDE.md');
  const [content, setContent] = useState<string>('');
  const [savedContent, setSavedContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isDirty = content !== savedContent;

  // Keep ref in sync for App.tsx wiring
  useEffect(() => {
    memoryIsDirtyRef.current = isDirty;
  }, [isDirty]);

  // Browser navigation guard
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Fetch file list on mount
  useEffect(() => {
    fetch('/api/files')
      .then((r) => r.json())
      .then((data: FileEntry[]) => setFiles(data))
      .catch(() => {});
  }, []);

  const loadFileContent = (relPath: string) => {
    setLoading(true);
    setError(null);
    fetch(`/api/files/content?path=${encodeURIComponent(relPath)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((data: { path: string; content: string }) => {
        setContent(data.content);
        setSavedContent(data.content);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  };

  // Load default file on mount
  const hasMounted = useRef(false);
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      loadFileContent(selectedPath);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileChange = (newPath: string) => {
    if (isDirty) {
      if (!window.confirm('You have unsaved changes. Leave anyway?')) return;
    }
    setSelectedPath(newPath);
    loadFileContent(newPath);
  };

  const handleSave = () => {
    setSaveError(null);
    fetch(`/api/files/content?path=${encodeURIComponent(selectedPath)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then(() => {
        setSavedContent(content);
      })
      .catch((e) => setSaveError(String(e)));
  };

  // Group files by category for the dropdown
  const byCategory: Record<string, FileEntry[]> = {};
  for (const f of files) {
    if (!byCategory[f.category]) byCategory[f.category] = [];
    byCategory[f.category].push(f);
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {/* File selector row */}
      <div className="flex items-center gap-3">
        <label className="text-gray-400 text-sm shrink-0">File:</label>
        <select
          value={selectedPath}
          onChange={(e) => handleFileChange(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded px-3 py-1.5 focus:outline-none focus:border-blue-500"
        >
          {Object.entries(byCategory).map(([category, entries]) => (
            <optgroup key={category} label={category}>
              {entries.map((f) => (
                <option key={f.path} value={f.path}>{f.label}</option>
              ))}
            </optgroup>
          ))}
          {/* Fallback if files haven't loaded yet */}
          {files.length === 0 && (
            <option value="CLAUDE.md">CLAUDE.md</option>
          )}
        </select>
        {isDirty && (
          <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" title="Unsaved changes" />
        )}
      </div>

      {/* Error banner */}
      {(error || saveError) && (
        <div className="bg-red-900/50 border border-red-700 text-red-300 text-sm rounded px-3 py-2">
          {error || saveError}
        </div>
      )}

      {/* Editor */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        disabled={loading}
        placeholder={loading ? 'Loading…' : 'File is empty. Start typing to create content.'}
        className="flex-1 w-full bg-gray-900 border border-gray-800 text-gray-100 font-mono text-sm rounded p-3 resize-none focus:outline-none focus:border-blue-500 disabled:opacity-50"
      />

      {/* Bottom bar */}
      <div className="flex items-center justify-between">
        <span className="text-gray-500 text-xs">
          {isDirty ? 'Unsaved changes' : 'Saved'}
        </span>
        <button
          onClick={handleSave}
          disabled={loading || !isDirty}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-1.5 rounded transition-colors"
        >
          Save
        </button>
      </div>
    </div>
  );
}
