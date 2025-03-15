
import { useState, useCallback } from 'react';
import { transcribeAudio, TranscriptionResult } from '../lib/transcriptionService';
import { log, logUser } from '../lib/logger';

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
      
      addLog('Iniciando processo de transcrição do áudio');
      
      const result = await transcribeAudio(audioBlob, (progress) => {
        addLog(progress);
      });
      
      setTranscriptionResult(result);
      addLog(`Transcrição concluída com sucesso (${result.text.length} caracteres)`);
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setTranscriptionError(errorMessage);
      addLog(`Erro na transcrição: ${errorMessage}`);
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
