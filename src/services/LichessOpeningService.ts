import { Chess } from 'chess.js';

export interface OpeningExplorerResponse {
  white: number;
  black: number;
  draws: number;
  moves: Array<{
    uci: string;
    san: string;
    white: number;
    black: number;
    draws: number;
    averageRating: number;
  }>;
  topGames: Array<{
    id: string;
    white: {
      name: string;
      rating: number;
    };
    black: {
      name: string;
      rating: number;
    };
    winner?: 'white' | 'black' | 'draw';
    year: number;
  }>;
  opening?: {
    eco: string;
    name: string;
  };
}

export class LichessOpeningService {
  private static readonly BASE_URL = 'https://explorer.lichess.ovh/masters';

  static async getOpeningInfo(
    fen: string,
    moves: string[] = [],
    since: number = 1952,
    until?: number,
    topGames: number = 5
  ): Promise<OpeningExplorerResponse | null> {
    try {
      const params = new URLSearchParams({
        fen,
        play: moves.join(','),
        since: since.toString(),
        topGames: topGames.toString(),
      });

      if (until) {
        params.append('until', until.toString());
      }

      const response = await fetch(`${this.BASE_URL}?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data as OpeningExplorerResponse;
    } catch (error) {
      console.error('Error fetching opening info:', error);
      return null;
    }
  }

  static formatOpeningInfo(info: OpeningExplorerResponse | null, moveHistory: string[]): string {
    if (!info) {
      return 'Opening information not available';
    }

    let result = '';

    // Add opening name if available
    if (info.opening) {
      result += `📚 Opening: ${info.opening.name} (ECO: ${info.opening.eco})\n\n`;
    }

    // Add statistics
    const total = info.white + info.black + info.draws;
    if (total > 0) {
      const whitePerc = ((info.white / total) * 100).toFixed(1);
      const blackPerc = ((info.black / total) * 100).toFixed(1);
      const drawsPerc = ((info.draws / total) * 100).toFixed(1);
      
      result += `Statistics from master games:\n`;
      result += `Total games: ${total}\n`;
      result += `White wins: ${whitePerc}% (${info.white} games)\n`;
      result += `Black wins: ${blackPerc}% (${info.black} games)\n`;
      result += `Draws: ${drawsPerc}% (${info.draws} games)\n\n`;
    }

    // Add most popular continuations if there are moves
    if (info.moves.length > 0) {
      result += `Popular continuations:\n`;
      info.moves.slice(0, 3).forEach(move => {
        const moveTotal = move.white + move.black + move.draws;
        const percentage = ((moveTotal / total) * 100).toFixed(1);
        result += `• ${move.san} (${percentage}% - ${moveTotal} games)\n`;
      });
      result += '\n';
    }

    // Add notable games if available
    if (info.topGames && info.topGames.length > 0) {
      result += `Notable games:\n`;
      info.topGames.slice(0, 2).forEach(game => {
        const gameResult = game.winner === 'white' ? '1-0' : 
                          game.winner === 'black' ? '0-1' : 
                          '½-½';
        result += `• ${game.white.name} (${game.white.rating}) vs ${game.black.name} (${game.black.rating}), ${game.year} - ${gameResult}\n`;
      });
    }

    return result;
  }

  static convertMovesToUCI(moveHistory: string[]): string[] {
    const chess = new Chess();
    return moveHistory.map(move => {
      const result = chess.move(move);
      if (!result) return '';
      return result.from + result.to + (result.promotion || '');
    }).filter(Boolean);
  }
}