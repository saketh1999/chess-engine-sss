import { Chess } from 'chess.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import markdownToTxt from 'markdown-to-text';
import * as jsChessEngine from 'js-chess-engine';
import { LichessService } from '../services/LichessService';
import { LichessOpeningService } from '../services/LichessOpeningService';

export interface AnalysisResult {
  summary: string;
  detailedAnalysis: string;
  bestMove: string;
  pv: string[];
  evaluation: number;
  positionalThemes: string[];
  tacticalThemes: string[];
  lichessEval?: string;
  openingInfo?: string;
}

export class ChessEngine {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;
  private apiKey: string;
  private isInitialized: boolean = false;
  private jsEngine: typeof jsChessEngine;

  constructor() {
    this.apiKey = '';
    this.jsEngine = jsChessEngine;
  }

  private validateApiKey(key: string): boolean {
    return typeof key === 'string' && key.trim().length > 0 && key.startsWith('AIza');
  }

  private initializeAI() {
    try {
      if (!this.validateApiKey(this.apiKey)) {
        console.warn('Invalid or missing API key');
        this.isInitialized = false; return;
      }

      this.genAI = new GoogleGenerativeAI(this.apiKey);
      this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      this.isInitialized = true;
      console.log('AI initialized successfully');
    } catch (error) {
      console.error('Failed to initialize AI:', error);
      this.isInitialized = false;
      this.genAI = null;
      this.model = null;
    }
  }

  setApiKey(key: string) {
    if (this.validateApiKey(key)) {
      this.apiKey = key;
      this.initializeAI();
      return true;
    } else {
      console.warn('Invalid API key format');
      return false;
    }
  }

  private findBestMoves(chess: Chess): string[] {
    try {
      if (chess.isGameOver()) {
        return [];
      }

      const legalMoves = chess.moves({ verbose: true });
      if (!legalMoves || legalMoves.length === 0) {
        console.warn('No legal moves found');
        return [];
      }

      const movesList = legalMoves.map(move => move.san).filter(Boolean);

      console.log('Available moves:', movesList);
      return movesList.slice(0, 5);
    } catch (e) {
      console.error('Error finding best moves:', e);
      return [];
    }
  }

  async analyzePosition(fen: string): Promise<AnalysisResult> {
    try {
      if (!this.isInitialized || !this.model || !this.validateApiKey(this.apiKey)) {
        console.log('AI not initialized, using fallback analysis');
        return this.fallbackAnalysis(new Chess(fen));
      }

      const chess = new Chess(fen);
      const moveHistory = chess.history();
      const lastMove = moveHistory.length > 0 ? moveHistory[moveHistory.length - 1] : null;
      const previousMove = moveHistory.length > 1 ? moveHistory[moveHistory.length - 2] : null;
      const phase = this.getGamePhase(chess);

      // Determine the color of the last move
      const lastMoveColor = moveHistory.length > 0 ? 
        (moveHistory.length % 2 === 0 ? 'Black' : 'White') : null;

      const lichessEval = await LichessService.getPositionEvaluation(fen, 3);
      console.log('Raw Lichess evaluation:', lichessEval);
      const lichessAnalysis = LichessService.formatEvaluation(lichessEval);

      const uciMoves = LichessOpeningService.convertMovesToUCI(moveHistory);
      const openingInfo = await LichessOpeningService.getOpeningInfo(chess.fen(), uciMoves);
      const formattedOpeningInfo = LichessOpeningService.formatOpeningInfo(openingInfo, moveHistory);

      let prompt = `As a chess grandmaster, analyze this ${phase.toLowerCase()} position:\n\n`;
      
      prompt += `Current Position (FEN): ${fen}\n\n`;
      
      if (moveHistory.length > 0) {
        prompt += `Recent moves:\n`;
        if (previousMove) {
          prompt += `- Previous move: ${previousMove} (${lastMoveColor === 'White' ? 'Black' : 'White'})\n`;
        }
        if (lastMove) {
          prompt += `- Last move: ${lastMove} (${lastMoveColor})\n`;
        }
      }

      if (lichessEval) {
        prompt += `\nLichess evaluation:\n${lichessAnalysis}\n`;
      }

      if (openingInfo?.opening) {
        prompt += `\nOpening: ${openingInfo.opening.name} (ECO: ${openingInfo.opening.eco})\n`;
      }

      prompt += `\nProvide a detailed analysis including:
      1. Evaluation of the last move (${lastMove ? `${lastMove} by ${lastMoveColor}` : 'no moves yet'})
      2. Current position assessment
      3. Key strategic themes and plans for this ${phase.toLowerCase()}
      4. Tactical opportunities
      5. Best continuation for both sides

      Format your response with clear sections and bullet points.
      Keep the analysis practical and actionable.`;

      console.log('Sending prompt to Gemini...');
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const markdownAnalysis = response.text();

      if (!markdownAnalysis) {
        throw new Error('Empty analysis received from Gemini');
      }

      const plainTextAnalysis = markdownToTxt(markdownAnalysis);
      const bestMoves = this.findBestMoves(chess);

      return {
        summary: `Position analyzed by Gemini AI (${phase})`,
        detailedAnalysis: plainTextAnalysis,
        bestMove: bestMoves[0] || "",
        pv: bestMoves,
        evaluation: this.evaluatePosition(chess),
        positionalThemes: [],
        tacticalThemes: [],
        lichessEval: lichessAnalysis,
        openingInfo: formattedOpeningInfo
      };
    } catch (error) {
      console.error('Error analyzing with Gemini:', error);
      return this.fallbackAnalysis(new Chess(fen));
    }
  }

  private fallbackAnalysis(chess: Chess): AnalysisResult {
    return {
      summary: 'API Key Required',
      detailedAnalysis: 'Please provide a valid Gemini API key to enable position analysis.',
      bestMove: '',
      pv: [],
      evaluation: 0,
      positionalThemes: [],
      tacticalThemes: []
    };
  }

  private getGamePhase(chess: Chess): string {
    const moveCount = chess.history().length;
    const pieces = chess.board().flat().filter(piece => piece && piece.type !== 'k' && piece.type !== 'p').length;
    
    if (pieces < 6) return 'Endgame';
    if (moveCount < 15) return 'Opening';
    return 'Middlegame';
  }

  async getBestMove(fen: string): Promise<string | null> {
    try {
      const chess = new Chess(fen);
      if (chess.isGameOver()) {
        return null;
      }

      // Get Lichess evaluation with best moves
      const lichessEval = await LichessService.getPositionEvaluation(fen, 1);
      if (!lichessEval) {
        console.warn('No Lichess evaluation available');
        return null;
      }

      // Extract the first move from Lichess analysis
      const bestMove = LichessService.extractFirstMove(lichessEval);
      if (!bestMove) {
        console.warn('No best move found in Lichess evaluation');
        return null;
      }

      // Verify the move is legal
      try {
        const tempChess = new Chess(fen);
        const move = tempChess.move(bestMove);
        if (!move) {
          console.warn('Illegal move suggested by Lichess:', bestMove);
          return null;
        }
        return move.san;
      } catch (error) {
        console.error('Error validating Lichess move:', error);
        return null;
      }
    } catch (error) {
      console.error('Error in getBestMove:', error);
      return null;
    }
  }

  private evaluatePosition(chess: Chess): number {
    try {
      const board = chess.board();
      const pieceValues = {
        p: 1,    // pawn
        n: 3,    // knight
        b: 3,    // bishop
        r: 5,    // rook
        q: 9     // queen
      };

      let evaluation = 0;

      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          const piece = board[i][j];
          if (piece) {
            const value = pieceValues[piece.type] || 0;
            const positionBonus = this.getPositionBonus(piece.type, i, j);
            evaluation += (value + positionBonus) * (piece.color === 'w' ? 1 : -1);
          }
        }
      }

      const mobilityBonus = chess.moves().length * 0.1;
      evaluation += chess.turn() === 'w' ? mobilityBonus : -mobilityBonus;

      const centerControl = this.evaluateCenterControl(chess);
      evaluation += centerControl;

      return evaluation;
    } catch (e) {
      console.error('Error evaluating position:', e);
      return 0;
    }
  }

  private evaluateCenterControl(chess: Chess): number {
    const centerSquares = ['d4', 'd5', 'e4', 'e5'];
    let centerControl = 0;

    centerSquares.forEach(square => {
      const piece = chess.get(square);
      if (piece) {
        centerControl += 0.2 * (piece.color === 'w' ? 1 : -1);
      }
    });

    return centerControl;
  }

  private getPositionBonus(pieceType: string, row: number, col: number): number {
    const centerBonus = (Math.abs(3.5 - row) + Math.abs(3.5 - col)) * -0.05;
    
    if (pieceType.toLowerCase() === 'p') {
      const advanceBonus = pieceType === 'p' ? (7 - row) * 0.1 : row * 0.1;
      return advanceBonus + centerBonus;
    }
    
    if (pieceType.toLowerCase() === 'n' || pieceType.toLowerCase() === 'b') {
      return centerBonus * 1.5;
    }
    
    return centerBonus;
  }

  cleanup() {
    // Cleanup is not needed anymore since we're not storing state
  }
}