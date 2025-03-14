
import { useState, useCallback } from 'react';
import { 
  readFileAsArrayBuffer, 
  decodeAudioData, 
  convertAudioBufferToWav, 
  convertWavToMp3 
} from '@/lib/audioConverter';
import { useToast } from "@/hooks/use-toast";

export const useAudioExtraction = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [mp3Url, setMp3Url] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const { toast } = useToast();

  const addLog = useCallback((message: string) => {
    console.log(message);
    setLogs(prev => [...prev, `${new Date().toISOString().split('T')[1].split('.')[0]} - ${message}`]);
  }, []);

  const extractAudio = useCallback(async (selectedFile: File) => {
    if (!selectedFile) return;
    
    try {
      setIsProcessing(true);
      setProgress(0);
      setError(null);
      setLogs([]);
      setMp3Url(null);
      
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
  }, [addLog, toast]);

  const getOutputFileName = useCallback((fileName: string) => {
    // Replace video extension with mp3
    return fileName.replace(/\.[^/.]+$/, '.mp3');
  }, []);

  return {
    isProcessing,
    progress,
    mp3Url,
    error,
    logs,
    extractAudio,
    getOutputFileName
  };
};
