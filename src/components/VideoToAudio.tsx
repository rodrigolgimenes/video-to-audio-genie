
import React, { useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Volume2 } from "lucide-react";
import FileInputArea from "@/components/audio-extractor/FileInputArea";
import ConversionProgress from "@/components/audio-extractor/ConversionProgress";
import DownloadButton from "@/components/audio-extractor/DownloadButton";
import { useAudioExtraction } from "@/hooks/useAudioExtraction";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

const VideoToAudio: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [highQuality, setHighQuality] = useState(true);
  
  const {
    isProcessing,
    progress,
    audioUrl,
    audioFormat,
    audioSize,
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
      // Use higher quality settings for better audio - 256kbps for high, 192kbps for normal
      extractAudio(selectedFile, highQuality ? 256 : 192);
    }
  }, [selectedFile, extractAudio, highQuality]);

  // Format output size based on the file extension
  const getFormatLabel = () => {
    return audioFormat === 'audio/wav' ? 'WAV (não comprimido)' : 'MP3 (comprimido)';
  };

  // Format file size to a readable format
  const formatFileSize = (bytes: number | undefined) => {
    if (!bytes) return '';
    
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-3xl mx-auto p-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Conversor de Vídeo para Áudio</CardTitle>
          <CardDescription className="text-center">
            Extraia áudio dos seus vídeos e baixe como MP3 comprimido
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
            <>
              <div className="flex items-center space-x-2 mb-2">
                <Checkbox 
                  id="high-quality" 
                  checked={highQuality} 
                  onCheckedChange={(checked) => setHighQuality(checked as boolean)}
                />
                <label 
                  htmlFor="high-quality" 
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Qualidade máxima (256kbps, arquivo maior)
                </label>
              </div>
              <Button 
                className="w-full" 
                onClick={handleExtractAudio}
                disabled={isProcessing}
              >
                <Volume2 className="mr-2 h-4 w-4" />
                Extrair Áudio MP3
              </Button>
            </>
          )}
          
          {audioUrl && (
            <>
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="flex gap-2 items-center">
                  <Badge variant="secondary">{getFormatLabel()}</Badge>
                  {audioSize && <Badge variant="outline">{formatFileSize(audioSize)}</Badge>}
                </div>
                <DownloadButton 
                  url={audioUrl} 
                  fileName={getOutputFileName(fileName || 'audio.mp3')} 
                  format={audioFormat}
                />
              </div>

              <Collapsible className="w-full mt-4">
                <CollapsibleTrigger className="text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-center">
                  Informações técnicas
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="text-xs text-muted-foreground space-y-1 p-2 bg-muted/50 rounded-md">
                    <p>Formato: {audioFormat}</p>
                    <p>Tamanho: {formatFileSize(audioSize)}</p>
                    <p>Qualidade: {highQuality ? 'Alta (256kbps)' : 'Normal (192kbps)'}</p>
                    <p>Arquivo original: {formatFileSize(selectedFile?.size)}</p>
                    <p>Redução: {selectedFile?.size && audioSize ? 
                      `${((1 - audioSize / selectedFile.size) * 100).toFixed(0)}%` : 'N/A'}</p>
                  </div>
                </CollapsibleContent>
              </Collapsible>
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
