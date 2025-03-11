import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { ChessEngine, AnalysisResult } from './components/ChessEngine';
import { Brain, ArrowUpRight, RotateCcw, RefreshCw, Eclipse as Flip, Moon, Sun, Download, Notebook as Robot, Search, Crown, MessageCircle, Key, Check, X, Send, ChevronRight as ChessKnight, Upload, ChevronLeft, ChevronRight, StopCircle } from 'lucide-react';

function App() {
  const [game, setGame] = useState(new Chess());
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [engine] = useState(new ChessEngine());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [playingAgainstEngine, setPlayingAgainstEngine] = useState(false);
  const [engineThinking, setEngineThinking] = useState(false);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [chatMode, setChatMode] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{role: string, content: string}>>([]);
  const [chatInput, setChatInput] = useState('');
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_GEMINI_API_KEY || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<'valid' | 'invalid' | 'pending'>('pending');
  const [showColorModal, setShowColorModal] = useState(false);
  const [playerColor, setPlayerColor] = useState<'white' | 'black'>('white');
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [fullMoveHistory, setFullMoveHistory] = useState<string[]>([]);
  const [isPgnMode, setIsPgnMode] = useState(false);
  const [originalPgn, setOriginalPgn] = useState<string>('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const analysisEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load saved PGN state from localStorage on component mount
  useEffect(() => {
    const savedPgn = localStorage.getItem('chessPgn');
    const savedMoveIndex = localStorage.getItem('chessMoveIndex');
    
    if (savedPgn) {
      try {
        const newGame = new Chess();
        newGame.loadPgn(savedPgn);
        setGame(newGame);
        setOriginalPgn(savedPgn);
        setFullMoveHistory(newGame.history());
        setMoveHistory(newGame.history().map((_, index) => {
          const tempGame = new Chess();
          const moves = newGame.history().slice(0, index + 1);
          moves.forEach(move => tempGame.move(move));
          return tempGame.fen();
        }));
        setCurrentMoveIndex(savedMoveIndex ? parseInt(savedMoveIndex) : -1);
        setIsPgnMode(true);
      } catch (error) {
        console.error('Error loading saved PGN:', error);
        localStorage.removeItem('chessPgn');
        localStorage.removeItem('chessMoveIndex');
      }
    }
  }, []);

  // Save current state to localStorage whenever it changes
  useEffect(() => {
    if (isPgnMode && originalPgn) {
      localStorage.setItem('chessPgn', originalPgn);
      localStorage.setItem('chessMoveIndex', currentMoveIndex.toString());
    }
  }, [isPgnMode, originalPgn, currentMoveIndex]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToAnalysisBottom = () => {
    analysisEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleApiKeySubmit = useCallback(() => {
    try {
      engine.setApiKey(apiKey);
      setApiKeyStatus(apiKey.startsWith('AIza') ? 'valid' : 'invalid');
      if (apiKey.startsWith('AIza')) {
        setShowApiKey(false);
      }
    } catch (error) {
      setApiKeyStatus('invalid');
    }
  }, [apiKey, engine]);

  const handleChatSubmit = useCallback(async () => {
    if (!chatInput.trim()) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);

    setEngineThinking(true);
    try {
      const analysis = await engine.analyzePosition(game.fen());
      const response = analysis.detailedAnalysis;
      
      let formattedResponse = '';
      if (analysis.openingInfo) {
        formattedResponse += '📚 Opening Information:\n' + analysis.openingInfo + '\n\n';
      }
      if (analysis.lichessEval) {
        formattedResponse += '📊 Lichess Analysis:\n' + analysis.lichessEval + '\n\n';
      }
      formattedResponse += '🤖 AI Analysis:\n' + response;
      
      setChatHistory(prev => [...prev, { role: 'ai', content: formattedResponse }]);
    } catch (error) {
      setChatHistory(prev => [...prev, { role: 'ai', content: 'I apologize, but I encountered an error analyzing the position.' }]);
    }
    setEngineThinking(false);
    setTimeout(scrollToBottom, 100);
  }, [chatInput, game, engine]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatSubmit();
    }
  }, [handleChatSubmit]);

  const makeEngineMove = useCallback(async (currentGame: Chess) => {
    if (!currentGame.isGameOver()) {
      setEngineThinking(true);
      const engineMove = await engine.getBestMove(currentGame.fen());
      if (engineMove) {
        const engineGameCopy = new Chess(currentGame.fen());
        engineGameCopy.move(engineMove);
        setGame(engineGameCopy);
        setMoveHistory(prev => [...prev, engineGameCopy.fen()]);
      }
      setEngineThinking(false);
    }
  }, [engine]);

  const makeMove = useCallback(async (move: { from: string; to: string; promotion?: string }) => {
    if (isPgnMode) return false; // Prevent moves during PGN analysis

    try {
      const gameCopy = new Chess(game.fen());
      
      const piece = gameCopy.get(move.from);
      const isPromotion = piece?.type === 'p' && (
        (piece.color === 'w' && move.to[1] === '8') ||
        (piece.color === 'b' && move.to[1] === '1')
      );

      const result = gameCopy.move({
        from: move.from,
        to: move.to,
        promotion: isPromotion ? 'q' : undefined
      });
      
      if (result) {
        setGame(gameCopy);
        setMoveHistory(prev => [...prev, gameCopy.fen()]);
        setCurrentMoveIndex(prev => prev + 1);
        setFullMoveHistory(gameCopy.history());
        
        if (chatMode) {
          const moveStr = result.san;
          setChatHistory(prev => [...prev, { role: 'player', content: `Played move: ${moveStr}` }]);
          setEngineThinking(true);
          const analysis = await engine.analyzePosition(gameCopy.fen());
          
          let formattedResponse = '';
          if (analysis.openingInfo) {
            formattedResponse += '📚 Opening Information:\n' + analysis.openingInfo + '\n\n';
          }
          if (analysis.lichessEval) {
            formattedResponse += '📊 Lichess Analysis:\n' + analysis.lichessEval + '\n\n';
          }
          formattedResponse += '🤖 AI Analysis:\n' + analysis.detailedAnalysis;
          
          setChatHistory(prev => [...prev, { role: 'ai', content: formattedResponse }]);
          setEngineThinking(false);
          setTimeout(scrollToBottom, 100);
        } else if (playingAgainstEngine && !gameCopy.isGameOver() && 
                  ((gameCopy.turn() === 'b' && playerColor === 'white') || 
                   (gameCopy.turn() === 'w' && playerColor === 'black'))) {
          await makeEngineMove(gameCopy);
        }
        return true;
      }
    } catch (error) {
      console.error('Invalid move:', error);
    }
    return false;
  }, [game, engine, playingAgainstEngine, chatMode, playerColor, makeEngineMove, isPgnMode]);

  const onDrop = useCallback((sourceSquare: string, targetSquare: string) => {
    if (isPgnMode) return false; // Prevent moves during PGN analysis
    
    if (playingAgainstEngine) {
      const currentTurn = game.turn();
      if ((currentTurn === 'w' && playerColor === 'black') ||
          (currentTurn === 'b' && playerColor === 'white')) {
        return false;
      }
    }
    return makeMove({
      from: sourceSquare,
      to: targetSquare
    });
  }, [game, makeMove, playingAgainstEngine, playerColor, isPgnMode]);

  const handleUndoMove = useCallback(() => {
    if (isPgnMode) return; // Prevent undo during PGN analysis

    if (moveHistory.length > 0) {
      const newHistory = [...moveHistory];
      newHistory.pop();
      if (playingAgainstEngine) {
        newHistory.pop();
      }
      const lastPosition = newHistory[newHistory.length - 1] || new Chess().fen();
      const newGame = new Chess(lastPosition);
      setGame(newGame);
      setMoveHistory(newHistory);
      setCurrentMoveIndex(prev => prev - (playingAgainstEngine ? 2 : 1));
    }
  }, [moveHistory, playingAgainstEngine, isPgnMode]);

  const handleNewGame = useCallback(() => {
    setGame(new Chess());
    setPlayingAgainstEngine(false);
    setChatMode(false);
    setAnalysis(null);
    setMoveHistory([]);
    setFullMoveHistory([]);
    setChatHistory([]);
    setBoardOrientation('white');
    setPlayerColor('white');
    setCurrentMoveIndex(-1);
    setIsPgnMode(false);
    setOriginalPgn('');
    localStorage.removeItem('chessPgn');
    localStorage.removeItem('chessMoveIndex');
  }, []);

  const handleStopPgnAnalysis = useCallback(() => {
    setIsPgnMode(false);
    setOriginalPgn('');
    localStorage.removeItem('chessPgn');
    localStorage.removeItem('chessMoveIndex');
    handleNewGame();
  }, [handleNewGame]);

  const handleFlipBoard = useCallback(() => {
    setBoardOrientation(current => current === 'white' ? 'black' : 'white');
  }, []);

  const handleAnalyze = useCallback(async () => {
    setIsAnalyzing(true);
    const analysis = await engine.analyzePosition(game.fen());
    setAnalysis(analysis);
    setIsAnalyzing(false);
    setTimeout(scrollToAnalysisBottom, 100);
  }, [game, engine]);

  const handleExportPGN = useCallback(() => {
    const pgn = game.pgn();
    const blob = new Blob([pgn], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chess-game.pgn';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [game]);

  const handlePlayEngine = useCallback(() => {
    setShowColorModal(true);
    setChatMode(false);
  }, []);

  const handleColorSelect = useCallback((color: 'white' | 'black') => {
    setPlayerColor(color);
    setBoardOrientation(color);
    setPlayingAgainstEngine(true);
    setShowColorModal(false);
    const newGame = new Chess();
    setGame(newGame);
    setAnalysis(null);
    setMoveHistory([]);
    setChatHistory([]);
    setCurrentMoveIndex(-1);

    if (color === 'black') {
      makeEngineMove(newGame);
    }
  }, [makeEngineMove]);

  const handleChatMode = useCallback(() => {
    setChatMode(prev => !prev);
    setPlayingAgainstEngine(false);
    setGame(new Chess());
    setAnalysis(null);
    setMoveHistory([]);
    setChatHistory([]);
    setCurrentMoveIndex(-1);
  }, []);

  const handleImportPGN = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const pgnText = e.target?.result as string;
        const newGame = new Chess();
        newGame.loadPgn(pgnText);
        setGame(newGame);
        setOriginalPgn(pgnText);
        setFullMoveHistory(newGame.history());
        setMoveHistory(newGame.history().map((_, index) => {
          const tempGame = new Chess();
          const moves = newGame.history().slice(0, index + 1);
          moves.forEach(move => tempGame.move(move));
          return tempGame.fen();
        }));
        setCurrentMoveIndex(newGame.history().length - 1);
        setIsPgnMode(true);
        
        // Save to localStorage
        localStorage.setItem('chessPgn', pgnText);
        localStorage.setItem('chessMoveIndex', (newGame.history().length - 1).toString());
      } catch (error) {
        console.error('Error loading PGN:', error);
        alert('Invalid PGN file format');
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset file input
  }, []);

  const navigateMove = useCallback((index: number) => {
    if (index >= -1 && index < moveHistory.length) {
      setCurrentMoveIndex(index);
      if (index === -1) {
        setGame(new Chess());
      } else {
        const newGame = new Chess();
        newGame.load(moveHistory[index]);
        setGame(newGame);
      }
      
      // Save current move index to localStorage
      if (isPgnMode) {
        localStorage.setItem('chessMoveIndex', index.toString());
      }
    }
  }, [moveHistory, isPgnMode]);

  const handlePrevMove = useCallback(() => {
    navigateMove(currentMoveIndex - 1);
  }, [currentMoveIndex, navigateMove]);

  const handleNextMove = useCallback(() => {
    navigateMove(currentMoveIndex + 1);
  }, [currentMoveIndex, navigateMove]);

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-100'} p-8 transition-colors duration-200`}>
      <div className="max-w-7xl mx-auto">
        <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6`}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-blue-50'}`}>
                <div className="relative">
                  <div className="flex items-center">
                    <Crown 
                      className={`w-5 h-5 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'} ml-1`}
                    />
                  </div>
                </div>
              </div>
              <div>
                <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                  Chess for All
                </h1>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Powered by AI
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="relative">
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className={`p-2 rounded-full ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'} ${
                    apiKeyStatus === 'valid' ? 'ring-2 ring-green-500' :
                    apiKeyStatus === 'invalid' ? 'ring-2 ring-red-500' : ''
                  }`}
                >
                  <Key className="w-5 h-5" />
                </button>
                {showApiKey && (
                  <div className={`absolute right-0 mt-2 p-4 rounded-lg shadow-lg z-10 ${isDarkMode ? 'bg-gray-700' : 'bg-white'}`}>
                    <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                      Gemini API Key
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={apiKey}
                        onChange={(e) => {
                          setApiKey(e.target.value);
                          setApiKeyStatus('pending');
                        }}
                        className={`w-64 px-3 py-2 rounded-md border ${
                          isDarkMode 
                            ? 'bg-gray-800 border-gray-600 text-gray-200' 
                            : 'bg-white border-gray-300 text-gray-700'
                        } ${
                          apiKeyStatus === 'valid' ? 'border-green-500' :
                          apiKeyStatus === 'invalid' ? 'border-red-500' : ''
                        }`}
                        placeholder="Enter your API key"
                      />
                      <button
                        onClick={handleApiKeySubmit}
                        className={`px-4 py-2 rounded-md ${
                          isDarkMode
                            ? 'bg-blue-600 hover:bg-blue-700'
                            : 'bg-blue-500 hover:bg-blue-600'
                        } text-white transition-colors`}
                      >
                        {apiKeyStatus === 'valid' ? <Check className="w-5 h-5" /> : 'Submit'}
                      </button>
                    </div>
                    {apiKeyStatus === 'invalid' && (
                      <p className="mt-2 text-sm text-red-500 flex items-center">
                        <X className="w-4 h-4 mr-1" />
                        Invalid API key format
                      </p>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={`p-2 rounded-full ${isDarkMode ? 'bg-gray-700 text-yellow-300' : 'bg-gray-200 text-gray-600'}`}
              >
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7">
              <div className="w-full aspect-square">
                <Chessboard 
                  position={game.fen()}
                  onPieceDrop={onDrop}
                  boardOrientation={boardOrientation}
                  customDarkSquareStyle={{ backgroundColor: isDarkMode ? '#374151' : '#b7c0d8' }}
                  customLightSquareStyle={{ backgroundColor: isDarkMode ? '#4B5563' : '#e2e8f0' }}
                  customBoardStyle={{
                    borderRadius: '4px',
                    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
                  }}
                />
              </div>

              <div className="mt-4">
                <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-700'}`}>
                  Game Controls
                </h3>
                <div className="space-y-2">
                  <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>
                    Turn: {game.turn() === 'w' ? 'White' : 'Black'}
                    {(playingAgainstEngine || chatMode) && (engineThinking ? ' (AI thinking...)' : ' (Your turn)')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleUndoMove}
                      disabled={moveHistory.length === 0 || isPgnMode}
                      className={`flex items-center px-3 py-2 ${
                        isDarkMode 
                          ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' 
                          : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                      } rounded-md transition-colors ${
                        (moveHistory.length === 0 || isPgnMode) ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Take Back
                    </button>
                    <button
                      onClick={handleNewGame}
                      className="flex items-center px-3 py-2 bg-blue-500 hover:bg-blue-600 rounded-md text-white transition-colors"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      New Game
                    </button>
                    <button
                      onClick={handleFlipBoard}
                      className={`flex items-center px-3 py-2 ${
                        isDarkMode 
                          ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' 
                          : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                      } rounded-md transition-colors`}
                    >
                      <Flip className="w-4 h-4 mr-2" />
                      Flip Board
                    </button>
                    <button
                      onClick={handleAnalyze}
                      disabled={chatMode}
                      className={`flex items-center px-3 py-2 ${
                        isDarkMode 
                          ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' 
                          : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                      } rounded-md transition-colors ${
                        chatMode ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <Search className="w-4 h-4 mr-2" />
                      Analyze
                    </button>
                    <button
                      onClick={playingAgainstEngine ? handleNewGame : handlePlayEngine}
                      disabled={chatMode || isPgnMode}
                      className={`flex items-center px-3 py-2 ${
                        playingAgainstEngine
                          ? 'bg-red-500 hover:bg-red-600 text-white'
                          : isDarkMode 
                            ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' 
                            : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                      } rounded-md transition-colors ${
                        (chatMode || isPgnMode) ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <Robot className="w-4 h-4 mr-2" />
                      {playingAgainstEngine ? 'Stop Playing Engine' : 'Play vs Engine'}
                    </button>
                    <button
                      onClick={handleChatMode}
                      disabled={playingAgainstEngine || isPgnMode}
                      className={`flex items-center px-3 py-2 ${
                        chatMode
                          ? 'bg-red-500 hover:bg-red-600 text-white'
                          : isDarkMode 
                            ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' 
                            : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                      } rounded-md transition-colors ${
                        (playingAgainstEngine || isPgnMode) ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      {chatMode ? 'Stop Chat Mode' : 'Chat Mode'}
                    </button>
                    <button
                      onClick={handleExportPGN}
                      className={`flex items-center px-3 py-2 ${
                        isDarkMode 
                          ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' 
                          : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                      } rounded-md transition-colors`}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export PGN
                    </button>
                    <input
                      type="file"
                      accept=".pgn"
                      ref={fileInputRef}
                      onChange={handleImportPGN}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className={`flex items-center px-3 py-2 ${
                        isDarkMode 
                          ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' 
                          : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                      } rounded-md transition-colors`}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Import PGN
                    </button>
                    {isPgnMode && (
                      <button
                        onClick={handleStopPgnAnalysis}
                        className="flex items-center px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors"
                      >
                        <StopCircle className="w-4 h-4 mr-2" />
                        Stop PGN Analysis
                      </button>
                    )}
                  </div>
                  {moveHistory.length > 0 && (
                    <div className={`mt-4 p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className={`text-sm font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                          Move Played
                        </h4>
                        <div className="flex gap-2">
                          <button
                            onClick={handlePrevMove}
                            disabled={currentMoveIndex <= -1}
                            className={`p-1 rounded ${
                              isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                            } ${currentMoveIndex <= -1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <ChevronLeft className="w-5 h-5" />
                          </button>
                          <button
                            onClick={handleNextMove}
                            disabled={currentMoveIndex >= moveHistory.length - 1}
                            className={`p-1 rounded ${
                              isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                            } ${currentMoveIndex >= moveHistory.length - 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <ChevronRight className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => navigateMove(-1)}
                          className={`px-2 py-1 text-sm rounded ${
                            currentMoveIndex === -1
                              ? isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
                              : isDarkMode ? 'bg-gray-600 text-gray-200' : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          Start
                        </button>
                        {fullMoveHistory.map((move, index) => (
                          <button
                            key={index}
                            onClick={() => navigateMove(index)}
                            className={`px-2 py-1 text-sm rounded ${
                              currentMoveIndex === index
                                ? isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
                                : isDarkMode ? 'bg-gray-600 text-gray-200' : 'bg-gray-200 text-gray-700'
                            }`}
                          >

                             {move}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {game.isGameOver() && (
                    <p className="text-red-600 font-semibold mt-2">
                      Game Over: 
                      {game.isCheckmate() ? ' Checkmate!' : 
                       game.isDraw() ? ' Draw!' : 
                       game.isStalemate() ? ' Stalemate!' : 
                       ' Game Over!'}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="lg:col-span-5 flex flex-col h-full min-h-[calc(100vh-200px)]">
              <div className={`flex-1 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} p-4 rounded-lg overflow-hidden`}>
                {chatMode ? (
                  <>
                    <h2 className={`text-xl font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-700'}`}>
                      Chat with AI
                    </h2>
                    <div className="h-full flex flex-col">
                      <div className="flex-1 overflow-y-scroll mb-4 space-y-4">
                        {chatHistory.map((msg, i) => (
                          <div
                            key={i}
                            className={`${
                              msg.role === 'ai'
                                ? isDarkMode ? 'bg-gray-600' : 'bg-blue-50'
                                : isDarkMode ? 'bg-gray-800' : 'bg-white'
                            } p-3 rounded-md`}
                          >
                            <div className={`whitespace-pre-line ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                              {msg.content}
                            </div>
                          </div>
                        ))}
                        {engineThinking && (
                          <div className={`flex items-center ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                            <Brain className="w-5 h-5 animate-spin mr-2" />
                            Analyzing position...
                          </div>
                        )}
                        <div ref={chatEndRef} />
                      </div>
                      <div className="relative mt-auto">
                        <textarea
                          ref={chatInputRef}
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={handleKeyPress}
                          placeholder="Ask about the position..."
                          className={`w-full px-4 py-6 pr-12 rounded-lg resize-none ${
                            isDarkMode
                              ? 'bg-gray-800 text-gray-200 placeholder-gray-500'
                              : 'bg-white text-gray-700 placeholder-gray-400'
                          } border ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}
                          rows={2}
                        />
                        <button
                          onClick={handleChatSubmit}
                          className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full ${
                            isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'
                          } text-white transition-colors`}
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </> ) : (
                  <>
                    <h2 className={`text-xl font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-700'}`}>
                      Strategic Analysis
                    </h2>
                    <div className="h-full overflow-y-auto">
                      {isAnalyzing || engineThinking ? (
                        <div className={`flex items-center ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                          <Brain className="w-5 h-5 animate-spin mr-2" />
                          {engineThinking ? "Engine is thinking..." : "Analyzing position..."}
                        </div>
                      ) : analysis ? (
                        <div className="space-y-4">
                          {analysis.openingInfo && (
                            <div className={`${isDarkMode ? 'bg-gray-600' : 'bg-blue-50'} p-3 rounded-md`}>
                              <div className={`whitespace-pre-line ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                {analysis.openingInfo}
                              </div>
                            </div>
                          )}
                          <div className={`${isDarkMode ? 'bg-gray-600' : 'bg-blue-50'} p-3 rounded-md`}>
                            <div className={`whitespace-pre-line ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} max-h-[60vh] overflow-y-auto`}>
                              {analysis.detailedAnalysis}
                            </div>
                          </div>
                          <div ref={analysisEndRef} />
                        </div>
                      ) : (
                        <div className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>
                          Click Analyze to see strategic assessment
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Color Selection Modal */}
      {showColorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow-xl max-w-sm w-full mx-4`}>
            <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
              Choose Your Color
            </h3>
            <div className="flex gap-4">
              <button
                onClick={() => handleColorSelect('white')}
                className={`flex-1 py-3 px-4 rounded-lg flex items-center justify-center gap-2 ${
                  isDarkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                }`}
              >
                <div className="w-6 h-6 rounded-full bg-white border border-gray-300" />
                White
              </button>
              <button
                onClick={() => handleColorSelect('black')}
                className={`flex-1 py-3 px-4 rounded-lg flex items-center justify-center gap-2 ${
                  isDarkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                }`}
              >
                <div className="w-6 h-6 rounded-full bg-gray-800" />
                Black
              </button>
            </div>
            <button
              onClick={() => setShowColorModal(false)}
              className={`mt-4 w-full py-2 rounded-lg ${
                isDarkMode
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;





