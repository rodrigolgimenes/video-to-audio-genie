
import React from 'react';
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface DownloadButtonProps {
  url: string;
  fileName: string;
  format?: string;
}

const DownloadButton: React.FC<DownloadButtonProps> = ({ url, fileName, format }) => {
  // Display MP3 in the button text if this is an MP3 file
  const isMP3 = format === 'audio/mpeg';
  
  return (
    <div className="flex items-center justify-center">
      <Button asChild className="w-full">
        <a href={url} download={fileName}>
          <Download className="mr-2 h-4 w-4" />
          Download {isMP3 ? 'MP3' : 'Audio'}
        </a>
      </Button>
    </div>
  );
};

export default DownloadButton;
