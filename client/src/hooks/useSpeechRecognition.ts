import { useEffect, useRef, useState, useCallback } from "react";

interface UseSpeechRecognitionOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onStatusChange?: (status: "idle" | "listening" | "error") => void;
}

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}) {
  const {
    language = "pt-BR",
    continuous = true,
    interimResults = true,
    onResult,
    onError,
    onStatusChange
  } = options;

  const recognitionRef = useRef<any>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isStoppingRef = useRef(false);
  const hasNetworkErrorRef = useRef(false);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setIsSupported(false);
      setError("Seu navegador não suporta reconhecimento de voz. Use Chrome, Edge ou Safari.");
      onStatusChange?.("error");
      return;
    }

    setIsSupported(true);

    try {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = continuous;
      recognitionRef.current.interimResults = interimResults;
      recognitionRef.current.lang = language;

      // Quando inicia
      recognitionRef.current.onstart = () => {
        console.log("✓ Reconhecimento iniciado");
        hasNetworkErrorRef.current = false;
        setError(null);
        onStatusChange?.("listening");
      };

      // Quando recebe resultado
      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          
          if (event.results[i].isFinal) {
            finalTranscript += transcript + " ";
          } else {
            interimTranscript += transcript;
          }
        }

        const currentTranscript = (finalTranscript || interimTranscript).trim();
        
        if (currentTranscript) {
          onResult?.(currentTranscript, !!finalTranscript);
        }
      };

      // Quando termina
      recognitionRef.current.onend = () => {
        console.log("✓ Reconhecimento finalizado");
        
        // Se o usuário não parou manualmente e não houve erro de rede, reiniciar
        if (isListening && !isStoppingRef.current && !hasNetworkErrorRef.current) {
          setTimeout(() => {
            if (recognitionRef.current && isListening && !isStoppingRef.current) {
              try {
                recognitionRef.current.start();
              } catch (err) {
                console.log("Reconhecimento já está ativo");
              }
            }
          }, 500);
        }
      };

      // Tratamento de erros - SILENCIOSO para erros de rede
      recognitionRef.current.onerror = (event: any) => {
        // Ignorar erros que não são reais
        if (event.error === "aborted" || event.error === "no-speech") {
          return;
        }

        // Se o usuário está parando, não fazer nada
        if (isStoppingRef.current) {
          return;
        }

        console.error("Erro de reconhecimento:", event.error);

        // Para erros de rede, apenas parar silenciosamente
        if (event.error === "network") {
          hasNetworkErrorRef.current = true;
          console.warn("Erro de rede no reconhecimento de voz. Parando...");
          
          // Parar de tentar reconectar
          if (recognitionRef.current) {
            try {
              recognitionRef.current.abort();
            } catch (err) {
              // Ignorar erros ao abortar
            }
          }
          
          setIsListening(false);
          onStatusChange?.("idle");
          
          // Mostrar erro apenas uma vez
          if (!error) {
            setError("Reconhecimento de voz indisponível. Verifique sua conexão com a internet.");
            onError?.("Reconhecimento de voz indisponível");
          }
          return;
        }

        // Para outros erros, mostrar mensagem
        let errorMessage = "Erro desconhecido";
        
        switch (event.error) {
          case "audio-capture":
            errorMessage = "Microfone não encontrado ou não permitido. Verifique as permissões.";
            break;
          case "not-allowed":
            errorMessage = "Permissão de microfone negada. Verifique as configurações do navegador.";
            break;
          case "service-not-allowed":
            errorMessage = "Serviço de reconhecimento não disponível.";
            break;
          default:
            errorMessage = `Erro: ${event.error}`;
        }

        setError(errorMessage);
        onError?.(errorMessage);
        onStatusChange?.("error");
        setIsListening(false);
      };
    } catch (err) {
      console.error("Erro ao inicializar Speech Recognition:", err);
      setIsSupported(false);
      setError("Erro ao inicializar reconhecimento de voz");
      onStatusChange?.("error");
    }

    return () => {
      // Cleanup
    };
  }, [continuous, interimResults, language, isListening, onResult, onError, onStatusChange, error]);

  const start = useCallback(async () => {
    if (!isSupported || !recognitionRef.current) {
      setError("Reconhecimento de voz não suportado");
      onStatusChange?.("error");
      return;
    }

    try {
      isStoppingRef.current = false;
      hasNetworkErrorRef.current = false;
      
      // Pedir permissão de microfone
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      setIsListening(true);
      setError(null);
      
      try {
        recognitionRef.current.start();
      } catch (err: any) {
        // Se já está rodando, apenas continua
        if (err.message?.includes("already started")) {
          console.log("Reconhecimento já está ativo");
          setIsListening(true);
        } else {
          throw err;
        }
      }
    } catch (err: any) {
      console.error("Erro ao iniciar reconhecimento:", err);
      
      if (err.name === "NotAllowedError") {
        setError("Permissão de microfone negada. Clique no ícone de câmera na barra de endereço para permitir.");
      } else if (err.name === "NotFoundError") {
        setError("Nenhum microfone encontrado no seu dispositivo.");
      } else {
        setError("Erro ao acessar o microfone");
      }
      
      setIsListening(false);
      onStatusChange?.("error");
    }
  }, [isSupported, onStatusChange]);

  const stop = useCallback(() => {
    isStoppingRef.current = true;
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        // Ignorar erros ao parar
      }
    }
    
    setIsListening(false);
    onStatusChange?.("idle");
    
    // Reset flag depois de um tempo
    setTimeout(() => {
      isStoppingRef.current = false;
    }, 500);
  }, [onStatusChange]);

  const abort = useCallback(() => {
    isStoppingRef.current = true;
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (err) {
        // Ignorar erros ao abortar
      }
    }
    
    setIsListening(false);
    onStatusChange?.("idle");
    
    // Reset flag depois de um tempo
    setTimeout(() => {
      isStoppingRef.current = false;
    }, 500);
  }, [onStatusChange]);

  return {
    isListening,
    isSupported,
    error,
    start,
    stop,
    abort
  };
}
