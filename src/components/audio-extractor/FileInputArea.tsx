
import React, { useRef, useState } from 'react';
import { Upload, RefreshCw, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FileInputAreaProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  fileName: string;
  fileSize?: number;
  onReset: () => void;
}

const FileInputArea: React.FC<FileInputAreaProps> = ({
  onFileSelect,
  selectedFile,
  fileName,
  fileSize,
  onReset
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
  };

  const handleBrowseClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  if (!selectedFile) {
    return (
      <>
        <input
          type="file"
          ref={fileInputRef}
          accept="video/*"
          className="hidden"
          onChange={handleFileSelect}
        />
        <div
          className={`border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer transition-colors ${isDragging ? 'border-primary bg-primary/5' : 'hover:bg-accent'}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={handleBrowseClick}
        >
          <div className="flex flex-col items-center justify-center gap-4">
            <Upload size={48} className="text-muted-foreground" />
            <div>
              <p className="text-lg font-medium">Drag and drop your video file here</p>
              <p className="text-sm text-muted-foreground">Or click to browse your files</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="flex items-center gap-2 p-3 bg-accent rounded">
      <Play className="shrink-0 text-primary" />
      <div className="truncate flex-1">
        <p className="font-medium truncate">{fileName}</p>
        {fileSize && (
          <p className="text-sm text-muted-foreground">
            {(fileSize / (1024 * 1024)).toFixed(2)} MB
          </p>
        )}
      </div>
      <Button variant="outline" size="sm" onClick={onReset}>
        <RefreshCw className="h-4 w-4 mr-2" />
        Change
      </Button>
    </div>
  );
};

export default FileInputArea;
