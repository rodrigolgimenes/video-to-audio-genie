
import React, { useState, useRef, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Upload, Play, Download, Volume2, RefreshCw } from "lucide-react";
import { readFileAsArrayBuffer, decodeAudioData, convertAudioBufferToWav, convertWavToMp3 } from '@/lib/audioConverter';

const VideoToAudio: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [mp3Url, setMp3Url] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const addLog = (message: string) => {
    console.log(message);
    setLogs(prev => [...prev, `${new Date().toISOString().split('T')[1].split('.')[0]} - ${message}`]);
  };

  const handleFileChange = useCallback((file: File) => {
    if (!file) return;
    
    // Check if it's a video file
    if (!file.type.includes('video/')) {
      setError('Please select a valid video file.');
      toast({
        title: "Invalid file type",
        description: "Please select a valid video file.",
        variant: "destructive"
      });
      return;
    }
    
    setSelectedFile(file);
    setFileName(file.name);
    setError(null);
    setMp3Url(null);
    setLogs([]);
    
    toast({
      title: "File selected",
      description: `${file.name} is ready for processing.`
    });
  }, [toast]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      handleFileChange(files[0]);
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
      handleFileChange(files[0]);
    }
  };

  const handleBrowseClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setFileName('');
    setMp3Url(null);
    setProgress(0);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const extractAudio = async () => {
    if (!selectedFile) return;
    
    try {
      setIsProcessing(true);
      setProgress(0);
      setError(null);
      setLogs([]);
      
      // Step 1: Read the video file as ArrayBuffer
      addLog("Starting to read video file as ArrayBuffer");
      const videoArrayBuffer = await readFileAsArrayBuffer(selectedFile);
      addLog(`Successfully read video file (${videoArrayBuffer.byteLength} bytes)`);
      
      // Step 2: Create AudioContext and decode the audio
      addLog("Creating AudioContext");
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      addLog("AudioContext created, starting audio decoding");
      
      try {
        const audioBuffer = await decodeAudioData(audioContext, videoArrayBuffer);
        addLog(`Audio decoded successfully: ${audioBuffer.numberOfChannels} channels, ${audioBuffer.sampleRate}Hz, ${audioBuffer.length} samples`);
        
        // Step 3: Convert AudioBuffer to WAV
        addLog("Converting AudioBuffer to WAV format");
        const wavBuffer = convertAudioBufferToWav(audioBuffer);
        addLog(`WAV conversion complete (${wavBuffer.byteLength} bytes)`);
        
        // Step 4: Convert WAV to MP3 using a Web Worker
        addLog("Starting WAV to MP3 conversion with Web Worker");
        let finalMp3Buffer: ArrayBuffer | null = null;
        
        try {
          while (finalMp3Buffer === null) {
            const { mp3Buffer, progress } = await convertWavToMp3(
              wavBuffer.slice(0), // Create a copy since the worker consumes the original
              audioBuffer.numberOfChannels,
              audioBuffer.sampleRate
            );
            
            setProgress(progress * 100);
            addLog(`Conversion progress: ${Math.round(progress * 100)}%`);
            
            if (progress === 1) {
              finalMp3Buffer = mp3Buffer;
              addLog(`MP3 conversion complete (${finalMp3Buffer.byteLength} bytes)`);
            }
          }
          
          // Step 5: Create a Blob from the MP3 buffer
          addLog("Creating MP3 Blob");
          const mp3Blob = new Blob([finalMp3Buffer], { type: 'audio/mpeg' });
          
          // Step 6: Create a download URL
          addLog("Generating download URL");
          const url = URL.createObjectURL(mp3Blob);
          setMp3Url(url);
          
          toast({
            title: "Conversion complete!",
            description: "Your audio file is ready for download."
          });
          addLog("Conversion process completed successfully");
        } catch (conversionError) {
          addLog(`Error in MP3 conversion: ${conversionError instanceof Error ? conversionError.message : 'Unknown error'}`);
          throw conversionError;
        }
      } catch (decodeError) {
        addLog(`Error decoding audio: ${decodeError instanceof Error ? decodeError.message : 'Unknown error'}`);
        throw new Error(`Failed to decode audio from video. The format might not be supported: ${decodeError instanceof Error ? decodeError.message : 'Unknown error'}`);
      }
    } catch (err) {
      console.error("Error extracting audio:", err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during audio extraction';
      setError(errorMessage);
      addLog(`Extraction failed: ${errorMessage}`);
      toast({
        title: "Conversion failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
      addLog("Process finished");
    }
  };

  const getOutputFileName = () => {
    if (fileName) {
      // Replace video extension with mp3
      return fileName.replace(/\.[^/.]+$/, '.mp3');
    }
    return 'audio.mp3';
  };

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
          <input
            type="file"
            ref={fileInputRef}
            accept="video/*"
            className="hidden"
            onChange={(e) => handleFileSelect(e)}
          />
          
          {!selectedFile && (
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
          )}
          
          {selectedFile && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-accent rounded">
                <Play className="shrink-0 text-primary" />
                <div className="truncate flex-1">
                  <p className="font-medium truncate">{fileName}</p>
                  <p className="text-sm text-muted-foreground">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Change
                </Button>
              </div>
              
              {isProcessing && (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Converting...</span>
                    <span className="text-sm">{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}
              
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              {!isProcessing && !mp3Url && (
                <Button 
                  className="w-full" 
                  onClick={extractAudio}
                  disabled={isProcessing}
                >
                  <Volume2 className="mr-2 h-4 w-4" />
                  Extract Audio
                </Button>
              )}
              
              {mp3Url && (
                <div className="flex items-center justify-center">
                  <Button asChild className="w-full">
                    <a href={mp3Url} download={getOutputFileName()}>
                      <Download className="mr-2 h-4 w-4" />
                      Download MP3
                    </a>
                  </Button>
                </div>
              )}
              
              {logs.length > 0 && (
                <div className="mt-4">
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground">Show processing logs</summary>
                    <div className="mt-2 p-3 bg-muted rounded-md overflow-y-auto max-h-40">
                      {logs.map((log, index) => (
                        <div key={index} className="font-mono">{log}</div>
                      ))}
                    </div>
                  </details>
                </div>
              )}
            </div>
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
