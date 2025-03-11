import { Chess } from 'chess.js';

export interface LichessEvaluation {
  fen: string;
  knodes: number;
  depth: number;
  pvs: Array<{
    moves: string;
    cp?: number;
    mate?: number;
  }>;
}

export class LichessService {
  private static readonly BASE_URL = 'https://lichess.org/api';

  static async getPositionEvaluation(
    fen: string,
    multiPv: number = 1,
    variant: string = 'standard'
  ): Promise<LichessEvaluation | null> {
    try {
      const params = new URLSearchParams({
        fen,
        multiPv: multiPv.toString(),
        variant
      });

      const response = await fetch(`${this.BASE_URL}/cloud-eval?${params}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          // Position not found in database
          return null;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Lichess Evaluation:', data);
      return data as LichessEvaluation;
    } catch (error) {
      console.error('Error fetching Lichess evaluation:', error);
      return null;
    }
  }

  static formatEvaluation(evaluation: LichessEvaluation | null): string {
    if (!evaluation) {
      return 'Position not found in Lichess database';
    }

    let result = `Depth: ${evaluation.depth}\n`;
    
    evaluation.pvs.forEach((pv, index) => {
      const score = pv.cp !== undefined 
        ? (pv.cp / 100).toFixed(2)
        : pv.mate !== undefined
          ? `Mate in ${Math.abs(pv.mate)}`
          : 'Unknown';

      result += `\nLine ${index + 1}:\n`;
      result += `Score: ${score}\n`;
      result += `Moves: ${pv.moves}\n`;
    });

    return result;
  }

  static extractFirstMove(evaluation: LichessEvaluation | null): string | null {
    if (!evaluation?.pvs?.[0]?.moves) {
      return null;
    }

    // Lichess returns moves in UCI format (e.g., "e2e4 e7e5")
    const moves = evaluation.pvs[0].moves.split(' ');
    if (moves.length === 0) {
      return null;
    }

    // Convert UCI move to SAN notation
    try {
      const chess = new Chess(evaluation.fen); // Use the position from the evaluation
      const uciMove = moves[0];
      const from = uciMove.substring(0, 2);
      const to = uciMove.substring(2, 4);
      const promotion = uciMove.length > 4 ? uciMove[4] : undefined;

      const move = chess.move({
        from,
        to,
        promotion: promotion ? promotion.toLowerCase() : undefined // Ensure promotion piece is lowercase
      });

      if (!move) {
        console.warn('Invalid move:', { from, to, promotion });
        return null;
      }

      return move.san;
    } catch (error) {
      console.error('Error converting UCI move to SAN:', error);
      return null;
    }
  }
}