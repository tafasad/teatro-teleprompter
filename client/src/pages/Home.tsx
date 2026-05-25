import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Volume2, Play, Pause, RotateCcw, Plus, Trash2, Mic, MicOff, Upload, AlertCircle, ChevronUp, ChevronDown } from "lucide-react";
import { characters, scriptLines, getCharacterLines } from "@/lib/script";
import TeleprompterView from "@/components/TeleprompterView";
import CharacterSelector from "@/components/CharacterSelector";
import SoundEffects from "@/components/SoundEffects";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

/**
 * DESIGN PHILOSOPHY: Premium Theater Teleprompter
 * - Destaque massivo da fala atual com relevo
 * - Alto contraste profissional para palco
 * - Gradientes sofisticados (azul escuro + laranja)
 * - Efeitos de sombra e profundidade
 */

interface Improvisation {
  id: string;
  text: string;
  audioUrl?: string;
}

export default function Home() {
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>("joao");
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [fontSize, setFontSize] = useState(40);
  const [improvisations, setImprovisations] = useState<Improvisation[]>([]);
  const [newImprovisation, setNewImprovisation] = useState("");
  const [highlightedWords, setHighlightedWords] = useState<string[]>([]);
  const [transcript, setTranscript] = useState("");
  const [silenceTimeout, setSilenceTimeout] = useState<NodeJS.Timeout | null>(null);
  const [status, setStatus] = useState<"idle" | "listening" | "error">("idle");
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use improved speech recognition hook
  const {
    isListening,
    isSupported,
    error: speechError,
    start: startListening,
    stop: stopListening,
    abort: abortListening
  } = useSpeechRecognition({
    language: "pt-BR",
    continuous: true,
    interimResults: true,
    onResult: (text, isFinal) => {
      setTranscript(text);
      highlightWordsInCurrentLine(text);

      if (isFinal) {
        if (silenceTimeout) {
          clearTimeout(silenceTimeout);
        }

        const newTimeout = setTimeout(() => {
          handleSilenceDetected();
        }, 2000);

        setSilenceTimeout(newTimeout);
      }
    },
    onError: (error) => {
      console.error("Erro de reconhecimento:", error);
    },
    onStatusChange: setStatus
  });

  const selectedCharacter = characters.find(c => c.id === selectedCharacterId);
  const characterLines = getCharacterLines(selectedCharacterId);
  const allLines = [...characterLines, ...improvisations.map((improv) => ({
    id: improv.id,
    character: selectedCharacter?.name || "",
    text: improv.text,
    act: 0,
    scene: 0
  }))];

  const highlightWordsInCurrentLine = (spokenText: string) => {
    const currentLine = allLines[currentLineIndex];
    if (!currentLine) return;

    const words = spokenText.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    const lineWords = currentLine.text.toLowerCase().split(/\s+/);
    
    const highlighted = words.filter(word => 
      lineWords.some(lineWord => lineWord.includes(word) || word.includes(lineWord))
    );
    
    setHighlightedWords(highlighted);
  };

  const handleSilenceDetected = () => {
    if (improvisations.length > 0) {
      const lastImprov = improvisations[improvisations.length - 1];
      if (lastImprov.audioUrl && audioRef.current) {
        audioRef.current.src = lastImprov.audioUrl;
        audioRef.current.play();
      }
    }
  };

  const handleAddImprovisation = () => {
    if (newImprovisation.trim()) {
      const newId = `improv-${Date.now()}`;
      setImprovisations([...improvisations, { id: newId, text: newImprovisation }]);
      setNewImprovisation("");
    }
  };

  const handleRemoveImprovisation = (id: string) => {
    setImprovisations(improvisations.filter(i => i.id !== id));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, improvId: string) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const audioUrl = event.target?.result as string;
        setImprovisations(improvisations.map(i => 
          i.id === improvId ? { ...i, audioUrl } : i
        ));
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePreviousLine = () => {
    if (currentLineIndex > 0) {
      setCurrentLineIndex(currentLineIndex - 1);
      setHighlightedWords([]);
      setTranscript("");
    }
  };

  const handleNextLine = () => {
    if (currentLineIndex < allLines.length - 1) {
      setCurrentLineIndex(currentLineIndex + 1);
      setHighlightedWords([]);
      setTranscript("");
    }
  };

  const handleResetScript = () => {
    setCurrentLineIndex(0);
    setHighlightedWords([]);
    setTranscript("");
    if (isListening) {
      stopListening();
    }
  };

  const handleToggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const currentLine = allLines[currentLineIndex];

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #0A0E27 0%, #1A1F3A 100%)",
        minHeight: "100vh",
        padding: "20px"
      }}
    >
      {/* Main Teleprompter View - Full Width */}
      <div style={{ marginBottom: "30px" }}>
        <TeleprompterView
          currentLine={currentLine}
          fontSize={fontSize}
          highlightedWords={highlightedWords}
          selectedCharacter={selectedCharacter}
          transcript={transcript}
        />
      </div>

      {/* Control Panel */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
          maxWidth: "1400px",
          margin: "0 auto"
        }}
      >
        {/* Left Panel - Character & Navigation */}
        <Card
          style={{
            background: "linear-gradient(135deg, #0F1629 0%, #1A2847 100%)",
            border: "2px solid #FF8C42",
            padding: "30px",
            borderRadius: "12px",
            boxShadow: "0 10px 30px rgba(255, 140, 66, 0.2)"
          }}
        >
          <h2 style={{ color: "#FF8C42", marginBottom: "20px", fontSize: "18px", fontWeight: "bold" }}>
            👤 Personagem
          </h2>
          <CharacterSelector
            characters={characters}
            selectedCharacterId={selectedCharacterId}
            onSelectCharacter={(id) => {
              setSelectedCharacterId(id);
              setCurrentLineIndex(0);
              setHighlightedWords([]);
              setTranscript("");
            }}
          />

          <div style={{ marginTop: "30px", paddingTop: "30px", borderTop: "1px solid rgba(255, 140, 66, 0.2)" }}>
            <h3 style={{ color: "#FF8C42", marginBottom: "15px", fontSize: "16px", fontWeight: "bold" }}>
              ⚙️ Controles
            </h3>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <Button
                onClick={handlePreviousLine}
                disabled={currentLineIndex === 0}
                style={{
                  background: "linear-gradient(135deg, #FF8C42 0%, #FF6B35 100%)",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "10px 15px",
                  borderRadius: "6px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  flex: 1,
                  minWidth: "100px"
                }}
              >
                <ChevronUp size={18} /> Anterior
              </Button>
              <Button
                onClick={handleNextLine}
                disabled={currentLineIndex >= allLines.length - 1}
                style={{
                  background: "linear-gradient(135deg, #FF8C42 0%, #FF6B35 100%)",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "10px 15px",
                  borderRadius: "6px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  flex: 1,
                  minWidth: "100px"
                }}
              >
                <ChevronDown size={18} /> Próxima
              </Button>
            </div>

            <div style={{ marginTop: "15px", display: "flex", gap: "10px" }}>
              <Button
                onClick={handleToggleListening}
                style={{
                  background: isListening ? "#FF6B35" : "#2C5F8D",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "10px 15px",
                  borderRadius: "6px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  flex: 1
                }}
              >
                {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                {isListening ? "Parar" : "Escutar"}
              </Button>
              <Button
                onClick={handleResetScript}
                style={{
                  background: "#666",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "10px 15px",
                  borderRadius: "6px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  flex: 1
                }}
              >
                <RotateCcw size={18} /> Reset
              </Button>
            </div>
          </div>

          {/* Font Size Control */}
          <div style={{ marginTop: "30px", paddingTop: "30px", borderTop: "1px solid rgba(255, 140, 66, 0.2)" }}>
            <h3 style={{ color: "#FF8C42", marginBottom: "15px", fontSize: "16px", fontWeight: "bold" }}>
              🔤 Tamanho da Fonte
            </h3>
            <input
              type="range"
              min="24"
              max="60"
              value={fontSize}
              onChange={(e) => setFontSize(parseInt(e.target.value))}
              style={{
                width: "100%",
                height: "8px",
                borderRadius: "4px",
                background: "linear-gradient(to right, #FF8C42, #FF6B35)",
                outline: "none",
                cursor: "pointer"
              }}
            />
            <div style={{ color: "#FFB380", marginTop: "10px", textAlign: "center", fontSize: "14px" }}>
              {fontSize}px
            </div>
          </div>
        </Card>

        {/* Right Panel - Improvisations */}
        <Card
          style={{
            background: "linear-gradient(135deg, #0F1629 0%, #1A2847 100%)",
            border: "2px solid #FF8C42",
            padding: "30px",
            borderRadius: "12px",
            boxShadow: "0 10px 30px rgba(255, 140, 66, 0.2)",
            maxHeight: "500px",
            overflowY: "auto"
          }}
        >
          <h2 style={{ color: "#FF8C42", marginBottom: "20px", fontSize: "18px", fontWeight: "bold" }}>
            🎭 Improvisações
          </h2>

          <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
            <input
              type="text"
              value={newImprovisation}
              onChange={(e) => setNewImprovisation(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleAddImprovisation()}
              placeholder="Digite uma fala improvisada..."
              style={{
                flex: 1,
                padding: "10px 15px",
                borderRadius: "6px",
                border: "1px solid #FF8C42",
                background: "#1A2847",
                color: "#FFFFFF",
                fontSize: "14px"
              }}
            />
            <Button
              onClick={handleAddImprovisation}
              style={{
                background: "linear-gradient(135deg, #FF8C42 0%, #FF6B35 100%)",
                color: "#FFFFFF",
                border: "none",
                padding: "10px 15px",
                borderRadius: "6px",
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              <Plus size={18} /> Adicionar
            </Button>
          </div>

          {improvisations.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {improvisations.map((improv) => (
                <div
                  key={improv.id}
                  style={{
                    background: "rgba(255, 140, 66, 0.1)",
                    border: "1px solid #FF8C42",
                    padding: "15px",
                    borderRadius: "6px"
                  }}
                >
                  <div style={{ color: "#FFFFFF", marginBottom: "10px", fontSize: "14px" }}>
                    {improv.text}
                  </div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={(e) => handleFileUpload(e, improv.id)}
                      ref={fileInputRef}
                      style={{ display: "none" }}
                    />
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        background: "#2C5F8D",
                        color: "#FFFFFF",
                        border: "none",
                        padding: "6px 12px",
                        borderRadius: "4px",
                        fontSize: "12px",
                        cursor: "pointer",
                        flex: 1
                      }}
                    >
                      <Upload size={14} /> {improv.audioUrl ? "Trocar" : "Áudio"}
                    </Button>
                    <Button
                      onClick={() => handleRemoveImprovisation(improv.id)}
                      style={{
                        background: "#FF6B35",
                        color: "#FFFFFF",
                        border: "none",
                        padding: "6px 12px",
                        borderRadius: "4px",
                        fontSize: "12px",
                        cursor: "pointer"
                      }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {improvisations.length === 0 && (
            <div style={{ color: "#FFB380", textAlign: "center", opacity: 0.6, fontSize: "14px" }}>
              Nenhuma improvisação adicionada ainda
            </div>
          )}
        </Card>
      </div>

      {/* Status Bar */}
      {status !== "idle" && (
        <div
          style={{
            marginTop: "20px",
            padding: "15px 20px",
            background: status === "error" ? "rgba(255, 107, 53, 0.2)" : "rgba(44, 95, 141, 0.2)",
            border: `1px solid ${status === "error" ? "#FF6B35" : "#2C5F8D"}`,
            borderRadius: "6px",
            color: status === "error" ? "#FF8C42" : "#FFB380",
            textAlign: "center",
            fontSize: "14px"
          }}
        >
          {status === "listening" && "🎤 Escutando..."}
          {status === "error" && "⚠️ Erro no reconhecimento de voz"}
        </div>
      )}

      <audio ref={audioRef} />
    </div>
  );
}
