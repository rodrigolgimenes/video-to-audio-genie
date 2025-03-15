
import { useState, useCallback } from 'react';
import { transcribeAudio, TranscriptionResult } from '../lib/transcriptionService';
import { log, logUser } from '../lib/logger';
import { toast } from "sonner";

export function useTranscription() {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionResult, setTranscriptionResult] = useState<TranscriptionResult | null>(null);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [transcriptionLogs, setTranscriptionLogs] = useState<string[]>([]);

  // Helper to add logs
  const addLog = useCallback((message: string) => {
    setTranscriptionLogs(prev => [...prev, `${new Date().toISOString().split('T')[1].split('.')[0]} - ${message}`]);
    log(`Transcrição: ${message}`);
    logUser(message);
  }, []);

  const startTranscription = useCallback(async (audioBlob: Blob) => {
    try {
      setIsTranscribing(true);
      setTranscriptionResult(null);
      setTranscriptionError(null);
      setTranscriptionLogs([]);
      
      addLog('Iniciando processo de transcrição do áudio com Fast Whisper');
      addLog(`Tamanho do arquivo de áudio: ${(audioBlob.size / 1024 / 1024).toFixed(2)}MB`);
      addLog('Conectando ao servidor fast-whisper real (não simulado)');
      
      toast.info("Enviando áudio para transcrição...", {
        duration: 10000,
        id: "transcription-toast"
      });
      
      const result = await transcribeAudio(audioBlob, (progress) => {
        addLog(progress);
      });
      
      setTranscriptionResult(result);
      addLog(`Transcrição concluída com sucesso (${result.text.length} caracteres)`);
      
      toast.success("Transcrição concluída com sucesso!", {
        id: "transcription-toast"
      });
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setTranscriptionError(errorMessage);
      addLog(`Erro na transcrição: ${errorMessage}`);
      
      // Verificar se é um erro de conexão com o servidor
      if (errorMessage.includes('Failed to fetch')) {
        toast.error("Não foi possível conectar ao servidor de transcrição. Verifique se o servidor fast-whisper está rodando.", {
          id: "transcription-toast",
          duration: 8000
        });
      } else {
        toast.error(`Erro na transcrição: ${errorMessage}`, {
          id: "transcription-toast" 
        });
      }
    } finally {
      setIsTranscribing(false);
    }
  }, [addLog]);

  return {
    isTranscribing,
    transcriptionResult,
    transcriptionError,
    transcriptionLogs,
    startTranscription
  };
}
