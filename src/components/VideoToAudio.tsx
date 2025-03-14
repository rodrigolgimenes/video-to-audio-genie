
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
    audioUrl,
    audioFormat,
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

  // Format output size based on the file extension
  const getFormatLabel = () => {
    return audioFormat === 'audio/wav' ? 'WAV (não comprimido)' : 'MP3 (comprimido)';
  };

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-3xl mx-auto p-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Conversor de Vídeo para Áudio</CardTitle>
          <CardDescription className="text-center">
            Extraia áudio dos seus vídeos e baixe como {getFormatLabel()}
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
          
          {!isProcessing && !audioUrl && selectedFile && (
            <Button 
              className="w-full" 
              onClick={handleExtractAudio}
              disabled={isProcessing}
            >
              <Volume2 className="mr-2 h-4 w-4" />
              Extrair Áudio
            </Button>
          )}
          
          {audioUrl && (
            <>
              <div className="text-center text-sm text-muted-foreground mb-2">
                Formato: {getFormatLabel()}
              </div>
              <DownloadButton 
                url={audioUrl} 
                fileName={getOutputFileName(fileName || 'audio.mp3')} 
              />
            </>
          )}
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <p className="text-xs text-muted-foreground text-center">
            Esta conversão acontece inteiramente no seu navegador. Seus arquivos nunca são enviados para um servidor.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default VideoToAudio;
