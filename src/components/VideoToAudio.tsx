
import React, { useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Volume2 } from "lucide-react";
import FileInputArea from "@/components/audio-extractor/FileInputArea";
import ConversionProgress from "@/components/audio-extractor/ConversionProgress";
import DownloadButton from "@/components/audio-extractor/DownloadButton";
import { useAudioExtraction } from "@/hooks/useAudioExtraction";

const VideoToAudio: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  
  const {
    isProcessing,
    progress,
    mp3Url,
    error,
    logs,
    extractAudio,
    getOutputFileName
  } = useAudioExtraction();

  const handleFileChange = useCallback((file: File) => {
    if (!file) return;
    
    // Check if it's a video file
    if (!file.type.includes('video/')) {
      return;
    }
    
    setSelectedFile(file);
    setFileName(file.name);
  }, []);

  const handleReset = useCallback(() => {
    setSelectedFile(null);
    setFileName('');
  }, []);

  const handleExtractAudio = useCallback(() => {
    if (selectedFile) {
      extractAudio(selectedFile);
    }
  }, [selectedFile, extractAudio]);

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-3xl mx-auto p-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Video to Audio Converter</CardTitle>
          <CardDescription className="text-center">
            Extract audio from your videos and download as MP3
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <FileInputArea 
            onFileSelect={handleFileChange}
            selectedFile={selectedFile}
            fileName={fileName}
            fileSize={selectedFile?.size}
            onReset={handleReset}
          />
          
          {isProcessing && (
            <ConversionProgress progress={progress} logs={logs} />
          )}
          
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {!isProcessing && !mp3Url && selectedFile && (
            <Button 
              className="w-full" 
              onClick={handleExtractAudio}
              disabled={isProcessing}
            >
              <Volume2 className="mr-2 h-4 w-4" />
              Extract Audio
            </Button>
          )}
          
          {mp3Url && (
            <DownloadButton 
              url={mp3Url} 
              fileName={getOutputFileName(fileName || 'audio.mp3')} 
            />
          )}
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <p className="text-xs text-muted-foreground text-center">
            This conversion happens entirely in your browser. Your files are never uploaded to a server.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default VideoToAudio;
