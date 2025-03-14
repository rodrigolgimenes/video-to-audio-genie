
import React, { useState, useRef, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
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
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

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
      
      // Step 1: Read the video file as ArrayBuffer
      const videoArrayBuffer = await readFileAsArrayBuffer(selectedFile);
      
      // Step 2: Create AudioContext and decode the audio
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await decodeAudioData(audioContext, videoArrayBuffer);
      
      // Step 3: Convert AudioBuffer to WAV
      const wavBuffer = convertAudioBufferToWav(audioBuffer);
      
      // Step 4: Convert WAV to MP3 using a Web Worker
      let finalMp3Buffer: ArrayBuffer | null = null;
      
      while (finalMp3Buffer === null) {
        const { mp3Buffer, progress } = await convertWavToMp3(
          wavBuffer.slice(0), // Create a copy since the worker consumes the original
          audioBuffer.numberOfChannels,
          audioBuffer.sampleRate
        );
        
        setProgress(progress * 100);
        
        if (progress === 1) {
          finalMp3Buffer = mp3Buffer;
        }
      }
      
      // Step 5: Create a Blob from the MP3 buffer
      const mp3Blob = new Blob([finalMp3Buffer], { type: 'audio/mpeg' });
      
      // Step 6: Create a download URL
      const url = URL.createObjectURL(mp3Blob);
      setMp3Url(url);
      
      toast({
        title: "Conversion complete!",
        description: "Your audio file is ready for download."
      });
    } catch (err) {
      console.error("Error extracting audio:", err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred during audio extraction');
      toast({
        title: "Conversion failed",
        description: err instanceof Error ? err.message : 'An unknown error occurred during audio extraction',
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
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
            onChange={handleFileSelect}
          />
          
          {!selectedFile && (
            <div
              className={`dropzone ${isDragging ? 'active' : ''}`}
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
