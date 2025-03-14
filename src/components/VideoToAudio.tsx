import React, { useState, useCallback, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Volume2, Info, FileText } from "lucide-react";
import FileInputArea from "@/components/audio-extractor/FileInputArea";
import ConversionProgress from "@/components/audio-extractor/ConversionProgress";
import DownloadButton from "@/components/audio-extractor/DownloadButton";
import TranscriptionResult from "@/components/audio-extractor/TranscriptionResult";
import { useAudioExtraction } from "@/hooks/useAudioExtraction";
import { useTranscription } from "@/hooks/useTranscription";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

const VideoToAudio: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [browserInfo, setBrowserInfo] = useState<Record<string, any>>({});
  const [conversionComplete, setConversionComplete] = useState(false);
  
  const {
    isProcessing,
    progress,
    audioUrl,
    audioFormat,
    audioSize,
    error,
    logs,
    extractAudio,
    getOutputFileName,
    allLogs
  } = useAudioExtraction();

  const {
    isTranscribing,
    transcriptionResult,
    transcriptionError,
    transcriptionLogs,
    startTranscription
  } = useTranscription();

  useEffect(() => {
    const info: Record<string, any> = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      vendor: navigator.vendor,
      audioContext: typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined',
      webWorker: typeof Worker !== 'undefined',
      arrayBuffer: typeof ArrayBuffer !== 'undefined',
      blob: typeof Blob !== 'undefined',
      url: typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function',
    };
    
    if (typeof (window as any).lamejs !== 'undefined') {
      info.lameJs = 'Available globally';
    } else {
      info.lameJs = 'Not available globally';
    }
    
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      info.sampleRate = audioContext.sampleRate;
      info.audioState = audioContext.state;
    } catch (e) {
      info.audioContextError = (e as Error).message;
    }
    
    setBrowserInfo(info);
  }, []);

  useEffect(() => {
    if (audioUrl) {
      setConversionComplete(true);
      
      if (audioFormat === 'audio/mpeg') {
        toast.success("Áudio MP3 extraído com sucesso!");
      } else {
        toast.info("Áudio WAV extraído. A codificação MP3 falhou.");
      }
    }
  }, [audioUrl, audioFormat]);

  const handleFileChange = useCallback((file: File) => {
    if (!file) return;
    
    if (!file.type.includes('video/')) {
      toast.error("Por favor, selecione um arquivo de vídeo");
      return;
    }
    
    setSelectedFile(file);
    setFileName(file.name);
    setConversionComplete(false);
  }, []);

  const handleReset = useCallback(() => {
    setSelectedFile(null);
    setFileName('');
    setConversionComplete(false);
  }, []);

  const handleExtractAudio = useCallback(() => {
    if (selectedFile) {
      extractAudio(selectedFile, 64);
    }
  }, [selectedFile, extractAudio]);

  const handleTranscribe = useCallback(async () => {
    if (!audioUrl) {
      toast.error("É necessário extrair o áudio primeiro");
      return;
    }
    
    try {
      const response = await fetch(audioUrl);
      const audioBlob = await response.blob();
      
      startTranscription(audioBlob);
    } catch (error) {
      toast.error("Erro ao preparar áudio para transcrição");
      console.error(error);
    }
  }, [audioUrl, startTranscription]);

  const getFormatLabel = () => {
    return audioFormat === 'audio/wav' ? 'WAV (não comprimido)' : 'MP3 (máxima compressão)';
  };

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
          <CardTitle className="text-2xl font-bold text-center">Conversor e Transcritor de Vídeo</CardTitle>
          <CardDescription className="text-center">
            Extraia áudio dos seus vídeos com máxima compressão MP3 e transcreva o conteúdo
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
          
          {(isProcessing || conversionComplete) && (
            <ConversionProgress 
              progress={progress} 
              logs={logs}
              error={error}
              isComplete={conversionComplete}
              audioFormat={audioFormat}
              audioSize={audioSize}
              originalFileSize={selectedFile?.size}
              videoFileName={fileName}
            />
          )}
          
          {error && !isProcessing && !conversionComplete && (
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
              Extrair Áudio MP3 com Máxima Compressão
            </Button>
          )}
          
          {audioUrl && (
            <>
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="flex gap-2 items-center">
                  <Badge variant="secondary">{getFormatLabel()}</Badge>
                  {audioSize && <Badge variant="outline">{formatFileSize(audioSize)}</Badge>}
                </div>
                <div className="flex gap-2 w-full">
                  <DownloadButton 
                    url={audioUrl} 
                    fileName={getOutputFileName(fileName || 'audio.mp3')} 
                    format={audioFormat}
                  />
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={handleTranscribe}
                    disabled={isTranscribing}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    {isTranscribing ? 'Transcrevendo...' : 'Transcrever Áudio'}
                  </Button>
                </div>
              </div>
            </>
          )}
          
          {(isTranscribing || transcriptionResult || transcriptionError) && (
            <TranscriptionResult
              result={transcriptionResult}
              isLoading={isTranscribing}
              error={transcriptionError}
            />
          )}
          
          <Collapsible className="w-full mt-4">
            <CollapsibleTrigger className="flex items-center justify-center text-xs text-muted-foreground hover:text-foreground transition-colors w-full">
              <Info className="h-3 w-3 mr-1" />
              <span>Debug: Informações do navegador</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="text-xs text-muted-foreground p-2 bg-muted/50 rounded-md">
                <h4 className="font-medium mb-1">Ambiente do navegador:</h4>
                <div className="grid grid-cols-2 gap-1 mb-2">
                  {Object.entries(browserInfo).map(([key, value]) => (
                    <div key={key} className="flex">
                      <span className="font-mono">{key}:</span>
                      <span className="ml-1 text-green-500">{value === true ? '✓' : value === false ? '✗' : String(value)}</span>
                    </div>
                  ))}
                </div>
                <Separator className="my-2" />
                <h4 className="font-medium mb-1">Conversão de áudio:</h4>
                <div className="space-y-1">
                  <div className="flex items-center">
                    <span className="font-mono">AudioContext:</span>
                    <span className="ml-1 text-green-500">{typeof AudioContext !== 'undefined' ? '✓' : '✗'}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-mono">Web Worker:</span>
                    <span className="ml-1 text-green-500">{typeof Worker !== 'undefined' ? '✓' : '✗'}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-mono">Blob URL:</span>
                    <span className="ml-1 text-green-500">{typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function' ? '✓' : '✗'}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-mono">LameJS global:</span>
                    <span className="ml-1 text-green-500">{typeof (window as any).lamejs !== 'undefined' ? '✓' : '✗'}</span>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
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
