
import React from 'react';
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface DownloadButtonProps {
  url: string;
  fileName: string;
}

const DownloadButton: React.FC<DownloadButtonProps> = ({ url, fileName }) => {
  return (
    <div className="flex items-center justify-center">
      <Button asChild className="w-full">
        <a href={url} download={fileName}>
          <Download className="mr-2 h-4 w-4" />
          Download MP3
        </a>
      </Button>
    </div>
  );
};

export default DownloadButton;
