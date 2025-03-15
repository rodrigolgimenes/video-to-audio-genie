
import { handleTranscriptionRequest } from './mockTranscriptionApi';
import { logTranscript } from './logger';

// Listen for fetch requests and intercept the ones going to /api/transcribe
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  
  window.fetch = async function(input, init) {
    // Check if this is a request to our transcribe endpoint
    if (input === '/api/transcribe' && init?.method === 'POST') {
      logTranscript('Interceptando requisição para /api/transcribe');
      
      try {
        // Get the audio blob from the form data
        const formData = init.body as FormData;
        const audioBlob = formData.get('audio') as Blob;
        
        if (!audioBlob) {
          throw new Error('Arquivo de áudio não encontrado na requisição');
        }
        
        logTranscript(`Processando arquivo de áudio: ${(audioBlob.size / 1024 / 1024).toFixed(2)}MB`);
        
        // Process the transcription using our mock implementation
        // In a production environment, this would call your actual fast-whisper API
        const result = await handleTranscriptionRequest(audioBlob);
        
        logTranscript('Transcrição concluída com sucesso');
        
        // Return a mock Response object
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      } catch (error) {
        logTranscript(`Erro na transcrição: ${error instanceof Error ? error.message : String(error)}`);
        
        return new Response(JSON.stringify({ error: 'Falha na transcrição' }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }
    }
    
    // For all other requests, use the original fetch
    return originalFetch.apply(window, [input, init]);
  };
  
  logTranscript('API de transcrição inicializada');
}
