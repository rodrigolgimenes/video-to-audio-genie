
import { useState, useCallback, useEffect } from 'react';
import { convertAudioBufferToWav, convertAudioBufferToMp3, createLogger } from '../lib/audioConverter';
import { log as globalLog, error as globalError, logUser, clearLogs, getAllLogs } from '../lib/logger';

export function useAudioExtraction() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioFormat, setAudioFormat] = useState<string>('');
  const [audioSize, setAudioSize] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  // Helper to add logs
  const addLog = useCallback((message: string) => {
    globalLog(message);
    setLogs(prev => [...prev, `${new Date().toISOString().split('T')[1].split('.')[0]} - ${message}`]);
  }, []);
  
  // Helper to add error logs
  const addErrorLog = useCallback((message: string) => {
    globalError(message);
    setLogs(prev => [...prev, `${new Date().toISOString().split('T')[1].split('.')[0]} - ERROR: ${message}`]);
  }, []);

  // Helper to add user-friendly logs
  const addUserLog = useCallback((message: string) => {
    logUser(message);
    setLogs(prev => [...prev, `${new Date().toISOString().split('T')[1].split('.')[0]} - ${message}`]);
  }, []);

  // Check lamejs availability on load
  useEffect(() => {
    addLog('Environment check: Starting diagnostics...');
    addUserLog('Iniciando verificação do ambiente...');
    
    // Check if AudioContext is available
    if (typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined') {
      addLog('Environment check: AudioContext is available');
      addUserLog('Verificação: AudioContext disponível ✓');
    } else {
      addErrorLog('Environment check: AudioContext is NOT available - audio processing will fail');
      addUserLog('Erro: AudioContext não disponível! A conversão não funcionará neste navegador ✗');
    }
    
    // Check if Web Workers are available
    if (typeof Worker !== 'undefined') {
      addLog('Environment check: Web Workers are available');
      addUserLog('Verificação: Web Workers disponíveis ✓');
    } else {
      addErrorLog('Environment check: Web Workers are NOT available - MP3 conversion will fail');
      addUserLog('Aviso: Web Workers não disponíveis! A conversão MP3 não funcionará ✗');
    }
    
    // Test lamejs global availability
    if (typeof (window as any).lamejs !== 'undefined') {
      addLog(`Environment check: lamejs is available in global scope: ${typeof (window as any).lamejs}`);
      addUserLog('Verificação: Biblioteca LameJS está disponível globalmente ✓');
      
      // Check Mp3Encoder
      if (typeof (window as any).lamejs.Mp3Encoder === 'function') {
        addLog('Environment check: Mp3Encoder constructor is available');
        addUserLog('Verificação: Codificador MP3 disponível ✓');
      } else {
        addErrorLog(`Environment check: Mp3Encoder is not available or not a constructor: ${typeof (window as any).lamejs.Mp3Encoder}`);
        addUserLog('Aviso: Codificador MP3 não disponível corretamente ✗');
      }
    } else {
      addLog('Environment check: lamejs is NOT available in global scope, will attempt dynamic loading');
      addUserLog('Verificação: Tentando carregar a biblioteca LameJS dinamicamente...');
      
      // Try loading lamejs script in main thread to verify it's accessible
      try {
        const script = document.createElement('script');
        const fullPath = window.location.origin + '/libs/lamejs/lame.all.js';
        script.src = fullPath;
        addLog(`Environment check: Trying to load lamejs from ${fullPath}`);
        
        script.onload = () => {
          if (typeof (window as any).lamejs !== 'undefined') {
            addLog(`Environment check: Successfully loaded lamejs dynamically: ${typeof (window as any).lamejs}`);
            addUserLog('Verificação: Biblioteca LameJS carregada com sucesso ✓');
            // Check if it has the Mp3Encoder
            if (typeof (window as any).lamejs.Mp3Encoder === 'function') {
              addLog('Environment check: Mp3Encoder constructor is available after dynamic load');
              addUserLog('Verificação: Codificador MP3 disponível após carregamento ✓');
            } else {
              addErrorLog('Environment check: Mp3Encoder is not available after dynamic load');
              addUserLog('Aviso: Codificador MP3 não disponível após carregamento ✗');
            }
          } else {
            addErrorLog('Environment check: lamejs failed to load into global scope after dynamic loading');
            addUserLog('Erro: Falha ao carregar a biblioteca LameJS dinamicamente ✗');
          }
        };
        script.onerror = (e) => {
          addErrorLog(`Environment check: Failed to load lamejs script: ${e}`);
          addUserLog('Erro: Falha ao carregar o script da biblioteca LameJS ✗');
        };
        document.head.appendChild(script);
      } catch (err) {
        addErrorLog(`Environment check: Error during dynamic script loading: ${(err as Error).message}`);
        addUserLog(`Erro durante o carregamento do script: ${(err as Error).message} ✗`);
      }
    }
    
    // Check for blob URL support
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      addLog('Environment check: Blob URL creation is supported');
      addUserLog('Verificação: Suporte a URL de Blob disponível ✓');
    } else {
      addErrorLog('Environment check: Blob URL creation is NOT supported - audio download will fail');
      addUserLog('Erro: Criação de URL de Blob não suportada! O download de áudio falhará ✗');
    }
    
    // Check if the libs/lamejs/lame.all.js file is accessible
    fetch(window.location.origin + '/libs/lamejs/lame.all.js', { method: 'HEAD' })
      .then(response => {
        if (response.ok) {
          addLog(`Environment check: lame.all.js is accessible at ${response.url} (status: ${response.status})`);
          addUserLog('Verificação: Arquivo lame.all.js está acessível ✓');
        } else {
          addErrorLog(`Environment check: lame.all.js is NOT accessible (status: ${response.status})`);
          addUserLog(`Erro: Arquivo lame.all.js não está acessível (status: ${response.status}) ✗`);
        }
      })
      .catch(err => {
        addErrorLog(`Environment check: Error checking lame.all.js accessibility: ${err.message}`);
        addUserLog(`Erro ao verificar acessibilidade do lame.all.js: ${err.message} ✗`);
      });
    
    addLog('Environment check: Diagnostics complete');
    addUserLog('Verificação de ambiente concluída');
  }, [addLog, addErrorLog, addUserLog]);

  const extractAudio = useCallback(async (selectedFile: File, quality: number = 128) => {
    if (!selectedFile) return;
    
    try {
      // Create a logger that also shows user-friendly messages
      const logger = createLogger((message: string) => {
        addLog(message);
        
        // Add user-friendly versions of technical messages
        if (message.includes('Starting to read video file')) {
          addUserLog('Iniciando leitura do arquivo de vídeo...');
        } else if (message.includes('Successfully read video file')) {
          addUserLog('Arquivo de vídeo lido com sucesso.');
        } else if (message.includes('Creating AudioContext')) {
          addUserLog('Criando contexto de áudio...');
        } else if (message.includes('AudioContext created')) {
          addUserLog('Contexto de áudio criado, iniciando decodificação...');
        } else if (message.includes('Attempting to decode audio data')) {
          addUserLog('Tentando decodificar dados de áudio...');
        } else if (message.includes('Audio successfully decoded')) {
          addUserLog('Áudio decodificado com sucesso!');
        } else if (message.includes('Starting MP3 conversion')) {
          addUserLog(`Iniciando conversão MP3 com qualidade ${quality}kbps...`);
        } else if (message.includes('MP3 conversion successful')) {
          addUserLog('Conversão MP3 concluída com sucesso!');
        } else if (message.includes('MP3 conversion failed')) {
          addUserLog('Conversão MP3 falhou. Usando WAV como alternativa...');
        } else if (message.includes('Falling back to WAV')) {
          addUserLog('Alternando para formato WAV (sem compressão)...');
        } else if (message.includes('WAV fallback successful')) {
          addUserLog('Conversão para WAV concluída com sucesso.');
        }
      });
      
      // Clear previous logs when starting a new conversion
      clearLogs();
      
      setIsProcessing(true);
      setProgress(0);
      setAudioUrl(null);
      setAudioFormat('');
      setAudioSize(undefined);
      setError(null);
      setLogs([]);
      
      addUserLog('=== INICIANDO PROCESSO DE CONVERSÃO ===');
      addUserLog(`Arquivo: ${selectedFile.name} (${(selectedFile.size / 1024 / 1024).toFixed(2)}MB)`);
      addUserLog(`Qualidade de conversão: ${quality}kbps (máxima compressão)`);
      
      // Step 1: Read the file as ArrayBuffer
      logger('Starting to read video file as ArrayBuffer');
      const fileBuffer = await selectedFile.arrayBuffer();
      logger(`Successfully read video file (${fileBuffer.byteLength} bytes)`);
      
      // Step 2: Create an AudioContext
      logger('Creating AudioContext');
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      logger('AudioContext created, starting audio decoding');
      
      // Step 3: Decode the audio data
      logger(`Attempting to decode audio data of size ${fileBuffer.byteLength} bytes`);
      try {
        const audioBuffer = await audioContext.decodeAudioData(fileBuffer);
        logger(`Audio successfully decoded: ${audioBuffer.numberOfChannels} channels, ${audioBuffer.sampleRate}Hz, ${audioBuffer.length} samples`);
        addUserLog(`Áudio decodificado: ${audioBuffer.numberOfChannels} canais, ${audioBuffer.sampleRate}Hz`);
        
        // Test lamejs availability before conversion
        logger('PRE-CHECK: Testing lamejs availability before conversion...');
        addUserLog('Verificando disponibilidade da biblioteca de codificação MP3...');
        
        try {
          const testScript = document.createElement('script');
          const fullPath = window.location.origin + '/libs/lamejs/lame.all.js';
          testScript.src = fullPath;
          logger(`PRE-CHECK: Trying to load lamejs from ${fullPath}`);
          
          testScript.onload = () => {
            logger('PRE-CHECK: lamejs script loaded successfully in main thread');
            addUserLog('Biblioteca LameJS carregada com sucesso no thread principal');
            
            if ((window as any).lamejs) {
              logger(`PRE-CHECK: lamejs is available in global scope: ${typeof (window as any).lamejs}`);
              
              // Check Mp3Encoder specifically
              if (typeof (window as any).lamejs.Mp3Encoder === 'function') {
                logger('PRE-CHECK: Mp3Encoder constructor is available and is a function');
                addUserLog('Codificador MP3 está disponível e pronto para uso');
                
                // Try creating an encoder instance to validate
                try {
                  const testEncoder = new (window as any).lamejs.Mp3Encoder(1, 44100, quality);
                  logger(`PRE-CHECK: Successfully created test Mp3Encoder: ${typeof testEncoder}`);
                  
                  // Test if the encoder has the expected methods
                  if (typeof testEncoder.encodeBuffer === 'function' && typeof testEncoder.flush === 'function') {
                    logger('PRE-CHECK: Mp3Encoder has the expected methods (encodeBuffer, flush)');
                    addUserLog('Teste do codificador MP3 bem-sucedido ✓');
                  } else {
                    logger('PRE-CHECK: WARNING: Mp3Encoder does not have expected methods');
                    addUserLog('Aviso: Codificador MP3 não tem os métodos esperados ⚠️');
                  }
                } catch (encErr) {
                  logger(`PRE-CHECK: ERROR creating Mp3Encoder instance: ${(encErr as Error).message}`);
                  addUserLog(`Erro ao criar instância do codificador MP3: ${(encErr as Error).message} ✗`);
                }
              } else {
                logger(`PRE-CHECK: WARNING: Mp3Encoder is not a constructor: ${typeof (window as any).lamejs.Mp3Encoder}`);
                addUserLog('Aviso: Mp3Encoder não é um construtor válido ⚠️');
              }
            } else {
              logger('PRE-CHECK: lamejs not found in global scope after script load');
              addUserLog('Erro: LameJS não encontrado no escopo global após carregamento ✗');
            }
          };
          testScript.onerror = (e) => {
            logger(`PRE-CHECK: Error loading lamejs script: ${e}`);
            addUserLog('Erro ao carregar script do LameJS ✗');
          };
          document.head.appendChild(testScript);
        } catch (preCheckError) {
          logger(`PRE-CHECK: Error testing lamejs: ${(preCheckError as Error).message}`);
          addUserLog(`Erro ao testar LameJS: ${(preCheckError as Error).message} ✗`);
        }
        
        // Step 4: Check if lame.all.js is accessible
        logger('Checking if lame.all.js is accessible...');
        addUserLog('Verificando se o arquivo lame.all.js está acessível...');
        
        try {
          // Try to verify if the lame.all.js file is accessible
          const fullPathToLib = window.location.origin + '/libs/lamejs/lame.all.js';
          logger(`Checking if lame.all.js is accessible at ${fullPathToLib}`);
          
          const testResponse = await fetch(fullPathToLib, { method: 'HEAD' });
          if (testResponse.ok) {
            logger(`lame.all.js is accessible at ${fullPathToLib} (status: ${testResponse.status})`);
            addUserLog('Arquivo lame.all.js está acessível ✓');
            
            // Try to fetch it to see the content
            try {
              const scriptContent = await fetch(fullPathToLib).then(r => r.text());
              logger(`Successfully fetched lame.all.js content (${scriptContent.length} characters)`);
              logger(`First 100 characters: ${scriptContent.substring(0, 100)}...`);
              addUserLog(`Conteúdo do lame.all.js verificado (${scriptContent.length} caracteres) ✓`);
            } catch (fetchContentError) {
              logger(`WARNING: Could not read lame.all.js content: ${(fetchContentError as Error).message}`);
              addUserLog(`Aviso: Não foi possível ler o conteúdo do lame.all.js: ${(fetchContentError as Error).message} ⚠️`);
            }
          } else {
            logger(`WARNING: lame.all.js might not be accessible (status: ${testResponse.status})`);
            addUserLog(`Aviso: lame.all.js pode não estar acessível (status: ${testResponse.status}) ⚠️`);
          }
        } catch (fetchError) {
          logger(`WARNING: Could not check lame.all.js accessibility: ${(fetchError as Error).message}`);
          addUserLog(`Aviso: Não foi possível verificar a acessibilidade do lame.all.js: ${(fetchError as Error).message} ⚠️`);
        }
        
        try {
          logger(`Starting MP3 conversion with maximum compression (quality: ${quality}kbps)`);
          addUserLog(`Iniciando conversão MP3 com compressão máxima (${quality}kbps)...`);
          
          const { buffer: mp3Buffer, format } = await convertAudioBufferToMp3(
            audioBuffer,
            quality,
            (percent) => {
              setProgress(percent);
              if (percent % 10 === 0) {
                addUserLog(`Progresso da conversão: ${percent}%`);
              }
            }
          );
          
          // Create a Blob and URL for the MP3
          const blob = new Blob([mp3Buffer], { type: format });
          const url = URL.createObjectURL(blob);
          
          setAudioUrl(url);
          setAudioFormat(format);
          setAudioSize(blob.size);
          setProgress(100);
          logger(`MP3 conversion successful: ${blob.size} bytes (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
          addUserLog(`Conversão MP3 concluída com sucesso! Tamanho: ${(blob.size / 1024 / 1024).toFixed(2)} MB ✓`);
          
        } catch (mp3Error) {
          addErrorLog(`MP3 conversion failed: ${(mp3Error as Error).message}`);
          addUserLog(`Falha na conversão MP3: ${(mp3Error as Error).message} ✗`);
          logger('Falling back to WAV format (larger file)');
          addUserLog('Alternando para formato WAV (arquivo maior, sem compressão)...');
          
          // Fallback to WAV if MP3 conversion fails
          const wavBuffer = convertAudioBufferToWav(audioBuffer);
          
          // Create a Blob and URL for the WAV
          const blob = new Blob([wavBuffer], { type: 'audio/wav' });
          const url = URL.createObjectURL(blob);
          
          setAudioUrl(url);
          setAudioFormat('audio/wav');
          setAudioSize(blob.size);
          setProgress(100);
          logger(`WAV fallback successful: ${blob.size} bytes (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
          addUserLog(`Conversão para WAV concluída com sucesso! Tamanho: ${(blob.size / 1024 / 1024).toFixed(2)} MB ✓`);
        }
        
      } catch (decodeError) {
        throw new Error(`Failed to decode audio data: ${(decodeError as Error).message}`);
      }
      
    } catch (error) {
      setError(`Erro na conversão: ${(error as Error).message}`);
      addErrorLog(`Error: ${(error as Error).message}`);
      addUserLog(`Erro fatal durante a conversão: ${(error as Error).message} ✗`);
    } finally {
      setIsProcessing(false);
      addUserLog('=== PROCESSO DE CONVERSÃO FINALIZADO ===');
    }
  }, [addLog, addErrorLog, addUserLog]);

  // Generate appropriate output filename based on input
  const getOutputFileName = useCallback((inputFileName: string) => {
    const baseName = inputFileName.replace(/\.[^/.]+$/, '');
    const extension = audioFormat === 'audio/mpeg' ? '.mp3' : '.wav';
    return `${baseName}${extension}`;
  }, [audioFormat]);

  return {
    isProcessing,
    progress,
    audioUrl,
    audioFormat,
    audioSize,
    error,
    logs,
    extractAudio,
    getOutputFileName,
    allLogs: getAllLogs // Make sure all logs are available to components
  };
}
