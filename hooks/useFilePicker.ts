import { useState, useMemo } from 'react';
import { scanFiles } from '../utils/fs';

const AT_RE = /(^|\s)@([^@\s]*)$/;

export function useFilePicker(mode: string, isLoading: boolean, hasPendingApproval: boolean) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<{ path: string; inline: boolean }[]>([]);
  const [allFiles, setAllFiles] = useState<string[]>([]);
  const [atCursor, setAtCursor] = useState(0);
  const [isScanning, setIsScanning] = useState(false);

  const atMatch = mode === 'chat' ? input.match(AT_RE) : null;
  const atQuery = atMatch ? atMatch[2] : '';
  const atActive = !!atMatch && !isLoading && !hasPendingApproval;

  const atFiltered = useMemo(
    () =>
      atActive
        ? allFiles.filter((f) => f.toLowerCase().includes(atQuery.toLowerCase())).slice(0, 200)
        : [],
    [allFiles, atQuery, atActive]
  );

  const handleInputChange = async (val: string) => {
    setInput(val);
    setAtCursor(0);
    if (AT_RE.test(val) && allFiles.length === 0 && !isScanning) {
      setIsScanning(true);
      try {
        const files = await scanFiles(process.cwd());
        setAllFiles(files);
      } finally {
        setIsScanning(false);
      }
    }
  };

  const selectFile = (file: string, inline: boolean) => {
    setInput((prev) => prev.replace(AT_RE, (_m, pre) => `${pre}@${file} `));
    setAttachments((xs) => [...xs.filter((x) => x.path !== file), { path: file, inline }]);
    setAtCursor(0);
  };

  return {
    input, setInput, handleInputChange,
    atActive, atQuery, atFiltered,
    atCursor, setAtCursor,
    attachments, setAttachments,
    selectFile, isScanning
  };
}
