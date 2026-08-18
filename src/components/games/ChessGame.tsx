import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chess, Square, PieceSymbol, Color } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../../types';
import { Eyebrow } from '../ui/Eyebrow';
import {
  Trophy,
  RotateCcw,
  BrainCircuit,
  Swords,
  ShieldAlert,
  Clock,
  Zap,
  Volume2,
  VolumeX,
  Sparkles,
  TrendingUp,
  TrendingDown,
  User,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { soundFx } from '../../utils/audio';

/** Minimum time the bot appears to think before playing. */
const MIN_THINK_MS = 2000;

// Piece Values for Material calculation
const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

const pawnPst = [
  0, 0, 0, 0, 0, 0, 0, 0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
  5, 5, 10, 27, 27, 10, 5, 5,
  0, 0, 0, 20, 20, 0, 0, 0,
  5, -5, -10, 0, 0, -10, -5, 5,
  5, 10, 10, -20, -20, 10, 10, 5,
  0, 0, 0, 0, 0, 0, 0, 0,
];

const knightPst = [
  -50, -40, -30, -30, -30, -30, -40, -50,
  -40, -20, 0, 0, 0, 0, -20, -40,
  -30, 0, 10, 15, 15, 10, 0, -30,
  -30, 5, 15, 20, 20, 15, 5, -30,
  -30, 0, 15, 20, 20, 15, 0, -30,
  -30, 5, 10, 15, 15, 10, 5, -30,
  -40, -20, 0, 5, 5, 0, -20, -40,
  -50, -40, -30, -30, -30, -30, -40, -50,
];

/**
 * Positions already seen this game, so the engine can be penalised for
 * repeating them. Purely material evaluation scores a rook shuffling between
 * two squares as zero-cost, which is why the bot could loop forever.
 */
const positionHistory = new Map<string, number>();

export function recordPosition(fen: string) {
  // Only the piece placement matters for repetition, not clocks or move counts.
  const key = fen.split(' ').slice(0, 4).join(' ');
  positionHistory.set(key, (positionHistory.get(key) || 0) + 1);
}

export function resetPositionHistory() {
  positionHistory.clear();
}

function repetitionPenalty(game: Chess): number {
  const key = game.fen().split(' ').slice(0, 4).join(' ');
  const seen = positionHistory.get(key) || 0;
  // Heavy enough to outweigh any small positional gain from shuffling.
  return seen * 45;
}

function evaluateBoard(game: Chess): number {
  let score = 0;
  const board = game.board();

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece) {
        let val = PIECE_VALUES[piece.type] || 0;
        const idx = r * 8 + c;
        if (piece.type === 'p') {
          val += piece.color === 'w' ? pawnPst[63 - idx] : pawnPst[idx];
        } else if (piece.type === 'n') {
          val += knightPst[idx];
        }
        score += piece.color === 'w' ? val : -val;
      }
    }
  }

  return score;
}

/**
 * Terminal check, done once per node instead of inside the evaluation.
 *
 * isCheckmate/isStalemate and moves() each cost roughly thirty times a board
 * scan. Calling them from evaluateBoard meant thousands of calls per engine
 * move, which froze the UI mid-game.
 */
function terminalScore(game: Chess, legalMoveCount: number): number | null {
  if (legalMoveCount > 0) return null;
  // No legal moves: checkmate if in check, stalemate otherwise.
  return game.inCheck() ? (game.turn() === 'w' ? -100000 : 100000) : 0;
}

function minimax(
  game: Chess,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean
): { score: number; move?: any } {
  const legalMoves = game.moves({ verbose: true });

  const terminal = terminalScore(game, legalMoves.length);
  if (terminal !== null) return { score: terminal };

  if (depth === 0) {
    // Mobility is derived from the move list the search already built, so it
    // costs nothing extra here.
    const mobility = legalMoves.length * 0.6;
    const base = evaluateBoard(game);
    return { score: base + (game.turn() === 'w' ? mobility : -mobility) };
  }

  // Reuse the list already built above rather than enumerating twice.
  // Captures first: alpha-beta prunes dramatically more when strong moves are
  // examined early, which buys back the strength lost by capping depth.
  const moves = legalMoves.slice().sort((a: any, b: any) => {
    const av = a.captured ? (PIECE_VALUES[a.captured] || 0) - (PIECE_VALUES[a.piece] || 0) / 10 : -1;
    const bv = b.captured ? (PIECE_VALUES[b.captured] || 0) - (PIECE_VALUES[b.piece] || 0) / 10 : -1;
    return bv - av;
  });
  let bestMove = moves[Math.floor(Math.random() * moves.length)];

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      game.move(move);
      const evalResult = minimax(game, depth - 1, alpha, beta, false);
      game.undo();
      if (evalResult.score > maxEval) {
        maxEval = evalResult.score;
        bestMove = move;
      }
      alpha = Math.max(alpha, evalResult.score);
      if (beta <= alpha) break;
    }
    return { score: maxEval, move: bestMove };
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      game.move(move);
      const evalResult = minimax(game, depth - 1, alpha, beta, true);
      game.undo();
      if (evalResult.score < minEval) {
        minEval = evalResult.score;
        bestMove = move;
      }
      beta = Math.min(beta, evalResult.score);
      if (beta <= alpha) break;
    }
    return { score: minEval, move: bestMove };
  }
}

const TIMER_OPTIONS = [
  { label: '3 Min Blitz', seconds: 180 },
  { label: '5 Min Rapid', seconds: 300 },
  { label: '10 Min Classic', seconds: 600 },
  { label: 'Unlimited', seconds: 0 },
];

export const ChessGame: React.FC<{
  profile: UserProfile;
  onProfileUpdate?: (p: UserProfile) => void;
}> = ({ profile, onProfileUpdate }) => {
  const [game, setGame] = useState(() => new Chess());
  const [engineLevel, setEngineLevel] = useState(1500); // AI ELO
  const [selectedTimeOption, setSelectedTimeOption] = useState(300); // 5 min
  const [whiteTime, setWhiteTime] = useState(300);
  const [blackTime, setBlackTime] = useState(300);
  const [gameStatus, setGameStatus] = useState<
    'idle' | 'playing' | 'won' | 'lost' | 'drawn' | 'timeout_win' | 'timeout_loss'
  >('idle');
  const [isEngineThinking, setIsEngineThinking] = useState(false);

  // ELO calculation details
  const [eloDelta, setEloDelta] = useState<number | null>(null);
  const [drawReason, setDrawReason] = useState<string | null>(null);

  // Tap & Drag selections
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [optionSquares, setOptionSquares] = useState<Record<string, any>>({});
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square } | null>(null);

  // Audio Mute
  const [isMuted, setIsMuted] = useState(false);

  // Board Container Ref for dynamic sizing
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const [boardWidth, setBoardWidth] = useState<number>(560);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const engineRef = useRef<any>(null);
  const onEngineMove = useRef<((moveUci: string) => void) | null>(null);
  const engineFallbackTimerRef = useRef<any>(null);
  /** When the current bot turn began, used to enforce the minimum think time. */
  const thinkStartedAtRef = useRef<number>(0);
  const botDelayTimerRef = useRef<any>(null);

  const userElo = profile.chessElo || 1200;

  // Measure Container Width
  useEffect(() => {
    const updateSize = () => {
      if (isFullscreen) {
        // Fit the shorter viewport side and reserve room for the clocks and
        // controls; sizing by width alone overflows a portrait phone.
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const usable = Math.min(vw - 16, vh - 190);
        setBoardWidth(Math.max(240, usable));
        return;
      }
      if (boardContainerRef.current) {
        const w = boardContainerRef.current.clientWidth - 16;
        setBoardWidth(Math.max(280, Math.min(w, 640)));
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    window.addEventListener('orientationchange', updateSize);
    return () => {
      window.removeEventListener('resize', updateSize);
      window.removeEventListener('orientationchange', updateSize);
    };
  }, [isFullscreen]);

  // Escape leaves fullscreen, and the page must not scroll behind the overlay.
  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [isFullscreen]);

  // Initialize Worker for Stockfish
  useEffect(() => {
    try {
      const worker = new Worker('/stockfish.js');
      worker.onmessage = (event) => {
        const msg = event.data;
        if (typeof msg === 'string' && msg.startsWith('bestmove')) {
          const parts = msg.split(' ');
          if (parts.length >= 2 && onEngineMove.current) {
            onEngineMove.current(parts[1]);
          }
        }
      };
      worker.onerror = () => {
        engineRef.current = 'fallback';
      };
      worker.postMessage('uci');
      engineRef.current = worker;
    } catch {
      engineRef.current = 'fallback';
    }

    return () => {
      if (engineRef.current && engineRef.current !== 'fallback') {
        try {
          engineRef.current.terminate();
        } catch {
          // ignore
        }
      }
      if (engineFallbackTimerRef.current) clearTimeout(engineFallbackTimerRef.current);
      if (botDelayTimerRef.current) clearTimeout(botDelayTimerRef.current);
    };
  }, []);

  // Timer Countdown Effect
  useEffect(() => {
    if (gameStatus !== 'playing' || selectedTimeOption === 0) return;

    const interval = setInterval(() => {
      if (game.turn() === 'w') {
        setWhiteTime((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            finishMatch('timeout_loss');
            return 0;
          }
          if (prev <= 10 && !isMuted) soundFx.playChessTick();
          return prev - 1;
        });
      } else {
        setBlackTime((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            finishMatch('timeout_win');
            return 0;
          }
          if (prev <= 10 && !isMuted) soundFx.playChessTick();
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [gameStatus, game, selectedTimeOption, isMuted]);

  // Handle Match Finish & Elo Rating updates
  const finishMatch = useCallback(
    (result: 'won' | 'lost' | 'drawn' | 'timeout_win' | 'timeout_loss') => {
      setGameStatus(result);

      // Competitive Chess ELO Formula (K-Factor = 24)
      const K = 24;
      const expectedScore = 1 / (1 + Math.pow(10, (engineLevel - userElo) / 400));
      let actualScore = 0;

      if (result === 'won' || result === 'timeout_win') {
        actualScore = 1;
      } else if (result === 'drawn') {
        actualScore = 0.5;
      } else {
        actualScore = 0;
      }

      const delta = Math.round(K * (actualScore - expectedScore));
      setEloDelta(delta);

      const newElo = Math.max(100, userElo + delta);
      // Realistic competitive EXP: Win = +25 XP, Draw = +10 XP, Loss = +3 XP
      const expEarned = actualScore === 1 ? 25 : actualScore === 0.5 ? 10 : 3;

      if (onProfileUpdate) {
        onProfileUpdate({
          ...profile,
          chessElo: newElo,
          gamesXp: (profile.gamesXp || 0) + expEarned,
        });
      }

      if (actualScore === 1) {
        if (!isMuted) soundFx.playChessCheckmate();
      } else if (actualScore === 0.5) {
        if (!isMuted) soundFx.playChessStalemate();
      } else {
        if (!isMuted) soundFx.playError();
      }
    },
    [engineLevel, userElo, profile, onProfileUpdate, isMuted]
  );

  const checkGameOver = useCallback(
    (currentGame: Chess) => {
      if (!currentGame.isGameOver()) return;

      if (currentGame.isCheckmate()) {
        // The side to move is the one checkmated.
        finishMatch(currentGame.turn() === 'w' ? 'lost' : 'won');
        return;
      }

      // Name the actual draw reason — "stalemate" was shown for all of them.
      if (currentGame.isStalemate()) setDrawReason('Stalemate — no legal moves');
      else if (currentGame.isThreefoldRepetition()) setDrawReason('Threefold repetition');
      else if (currentGame.isInsufficientMaterial()) setDrawReason('Insufficient material');
      else setDrawReason('Fifty-move rule');

      finishMatch('drawn');
    },
    [finishMatch]
  );

  const triggerSoundForMove = (currentGame: Chess, move: any) => {
    if (isMuted) return;
    if (currentGame.isCheckmate()) {
      soundFx.playChessCheckmate();
    } else if (currentGame.inCheck()) {
      soundFx.playChessCheck();
    } else if (move && move.captured) {
      soundFx.playChessCapture();
    } else {
      soundFx.playChessMove();
    }
  };

  // JS Engine Minimax Fallback
  const executeJsEngineMove = useCallback(
    (currentGame: Chess) => {
      const gameCopy = new Chess(currentGame.fen());
      const moves = gameCopy.moves({ verbose: true });

      if (moves.length === 0) {
        setIsEngineThinking(false);
        checkGameOver(gameCopy);
        return;
      }

      // Depth is capped at 2: depth 3 measured ~6s and froze the board, which
      // cost players games on the clock. Higher levels get better move
      // ordering instead, which improves play without the stall.
      let searchDepth = 2;
      if (engineLevel <= 700) searchDepth = 1;

      let bestMove = moves[Math.floor(Math.random() * moves.length)];
      const isBlunder = Math.random() < Math.max(0, (1600 - engineLevel) / 2400);

      if (!isBlunder) {
        const result = minimax(gameCopy, searchDepth, -Infinity, Infinity, false);
        if (result.move) bestMove = result.move;

        // Reject a move that walks straight back into a position already seen.
        // Without this the engine can shuffle the same piece indefinitely.
        if (bestMove) {
          try {
            // make/undo on the existing board — no FEN parsing, no allocation.
            gameCopy.move(bestMove);
            const repeats = repetitionPenalty(gameCopy) > 0;
            gameCopy.undo();

            if (repeats) {
              const alternatives = gameCopy.moves({ verbose: true });
              const currentKey = `${(bestMove as any).from}${(bestMove as any).to}`;

              for (const alt of alternatives) {
                if (`${alt.from}${alt.to}` === currentKey) continue;
                gameCopy.move(alt);
                const clean = repetitionPenalty(gameCopy) === 0;
                gameCopy.undo();
                if (clean) {
                  bestMove = alt;
                  break;
                }
              }
            }
          } catch {
            /* keep the original move */
          }
        }
      }

      try {
        const played = gameCopy.move(bestMove);
        if (played) {
          setGame(gameCopy);
          setLastMove({ from: played.from as Square, to: played.to as Square });
          // Append rather than replace: gameCopy was rebuilt from a FEN, which
          // carries no history, so gameCopy.history() is just this one move.
          setMoveHistory((prev) => [...prev, played.san]);
          recordPosition(gameCopy.fen());
          triggerSoundForMove(gameCopy, played);
          checkGameOver(gameCopy);
        }
      } catch (e) {
        console.error('Engine move error', e);
      }

      setIsEngineThinking(false);
    },
    [engineLevel, checkGameOver, isMuted]
  );

  /**
   * The bot answers almost instantly, which reads as unnatural and means its
   * clock never moves. Every bot reply is held until at least MIN_THINK_MS have
   * passed since the request, so the move lands at a human pace and the engine
   * clock actually ticks. If the engine took longer than the floor, it plays
   * immediately — this only ever adds the missing remainder.
   */
  const scheduleBotMove = useCallback((apply: () => void) => {
    const elapsed = Date.now() - (thinkStartedAtRef.current || Date.now());
    const wait = Math.max(0, MIN_THINK_MS - elapsed);

    if (botDelayTimerRef.current) clearTimeout(botDelayTimerRef.current);
    if (wait === 0) {
      apply();
      return;
    }
    botDelayTimerRef.current = setTimeout(() => {
      botDelayTimerRef.current = null;
      apply();
    }, wait);
  }, []);

  const makeEngineMove = useCallback(
    (moveUci: string, currentFen: string) => {
      if (engineFallbackTimerRef.current) {
        clearTimeout(engineFallbackTimerRef.current);
        engineFallbackTimerRef.current = null;
      }
      if (botDelayTimerRef.current) {
        clearTimeout(botDelayTimerRef.current);
        botDelayTimerRef.current = null;
      }

      const gameCopy = new Chess(currentFen);
      try {
        const from = moveUci.substring(0, 2) as Square;
        const to = moveUci.substring(2, 4) as Square;
        const promotion = moveUci.length > 4 ? moveUci.charAt(4) : 'q';

        const move = gameCopy.move({ from, to, promotion });
        if (move) {
          setGame(gameCopy);
          setLastMove({ from: move.from as Square, to: move.to as Square });
          setMoveHistory((prev) => [...prev, move.san]);
        recordPosition(gameCopy.fen());
          recordPosition(gameCopy.fen());
          triggerSoundForMove(gameCopy, move);
          checkGameOver(gameCopy);
        } else {
          executeJsEngineMove(gameCopy);
        }
      } catch {
        executeJsEngineMove(gameCopy);
      }
      setIsEngineThinking(false);
    },
    [checkGameOver, executeJsEngineMove, isMuted]
  );

  const requestEngineMove = useCallback(
    (currentGame: Chess) => {
      setIsEngineThinking(true);

      thinkStartedAtRef.current = Date.now();

      if (engineFallbackTimerRef.current) clearTimeout(engineFallbackTimerRef.current);
      engineFallbackTimerRef.current = setTimeout(() => {
        scheduleBotMove(() => executeJsEngineMove(currentGame));
      }, 900);

      if (engineRef.current && engineRef.current !== 'fallback') {
        onEngineMove.current = (uci) => {
          scheduleBotMove(() => makeEngineMove(uci, currentGame.fen()));
        };

        try {
          const skillLevel = Math.max(0, Math.min(20, Math.floor((engineLevel - 100) / 145)));
          engineRef.current.postMessage('position fen ' + currentGame.fen());
          engineRef.current.postMessage(`setoption name Skill Level value ${skillLevel}`);
          engineRef.current.postMessage('go depth 8');
        } catch {
          executeJsEngineMove(currentGame);
        }
      } else {
        scheduleBotMove(() => executeJsEngineMove(currentGame));
      }
    },
    [engineLevel, makeEngineMove, executeJsEngineMove, scheduleBotMove]
  );

  // Execute Human Move
  const makeAMove = (moveObj: { from: string; to: string; promotion?: string }) => {
    if (gameStatus !== 'playing' || isEngineThinking) return false;

    const gameCopy = new Chess(game.fen());
    try {
      const move = gameCopy.move(moveObj);
      if (move) {
        setGame(gameCopy);
        setLastMove({ from: move.from as Square, to: move.to as Square });
        setMoveHistory((prev) => [...prev, move.san]);
        setSelectedSquare(null);
        setOptionSquares({});
        setPendingPromotion(null);

        triggerSoundForMove(gameCopy, move);

        if (!gameCopy.isGameOver()) {
          requestEngineMove(gameCopy);
        } else {
          checkGameOver(gameCopy);
        }
        return true;
      }
    } catch {
      return false;
    }
    return false;
  };

  // Drag and Drop Handler
  const onDrop = ({ sourceSquare, targetSquare }: { piece: any; sourceSquare: string; targetSquare: string | null }) => {
    if (!targetSquare) return false;
    if (gameStatus !== 'playing' || game.turn() === 'b' || isEngineThinking) return false;

    // Check promotion
    const moves = game.moves({ square: sourceSquare as Square, verbose: true });
    const targetMove = moves.find((m) => m.to === targetSquare);
    if (targetMove && targetMove.flags.includes('p')) {
      setPendingPromotion({ from: sourceSquare as Square, to: targetSquare as Square });
      return false;
    }

    return makeAMove({
      from: sourceSquare,
      to: targetSquare,
      promotion: 'q',
    });
  };

  // Square Click / Tap Handler
  const getMoveOptions = (square: Square) => {
    const moves = game.moves({ square, verbose: true });
    if (moves.length === 0) {
      setOptionSquares({});
      return;
    }

    const newSquares: Record<string, any> = {};
    moves.forEach((move) => {
      newSquares[move.to] = {
        background:
          game.get(move.to as Square) && game.get(move.to as Square)?.color !== game.get(square)?.color
            ? 'radial-gradient(circle, rgba(239, 68, 68, 0.7) 85%, transparent 85%)'
            : 'radial-gradient(circle, rgba(16, 185, 129, 0.7) 28%, transparent 28%)',
        borderRadius: '50%',
      };
    });
    newSquares[square] = {
      background: 'rgba(245, 158, 11, 0.4)',
    };
    setOptionSquares(newSquares);
  };

  const handleSquareClick = ({ square }: { piece: any; square: string }) => {
    const sq = square as Square;
    if (gameStatus !== 'playing' || game.turn() === 'b' || isEngineThinking) return;

    if (selectedSquare) {
      const moves = game.moves({ square: selectedSquare, verbose: true });
      const targetMove = moves.find((m) => m.to === sq);

      if (targetMove) {
        if (targetMove.flags.includes('p')) {
          setPendingPromotion({ from: selectedSquare, to: sq });
          return;
        }
        makeAMove({
          from: selectedSquare,
          to: sq,
          promotion: 'q',
        });
        setSelectedSquare(null);
        setOptionSquares({});
        return;
      }
    }

    const piece = game.get(sq);
    if (piece && piece.color === 'w') {
      setSelectedSquare(sq);
      getMoveOptions(sq);
    } else {
      setSelectedSquare(null);
      setOptionSquares({});
    }
  };

  // Start new match
  const startGame = () => {
    resetPositionHistory();
    setDrawReason(null);
    const newG = new Chess();
    setGame(newG);
    setWhiteTime(selectedTimeOption);
    setBlackTime(selectedTimeOption);
    setGameStatus('playing');
    setIsEngineThinking(false);
    setSelectedSquare(null);
    setOptionSquares({});
    setLastMove(null);
    setMoveHistory([]);
    setPendingPromotion(null);
    setEloDelta(null);
    if (!isMuted) soundFx.playChessMove();
  };

  // Captured pieces calculation
  const getCapturedPieces = () => {
    const board = game.board();
    const currentCounts: Record<string, number> = {
      w_p: 0, w_n: 0, w_b: 0, w_r: 0, w_q: 0,
      b_p: 0, b_n: 0, b_b: 0, b_r: 0, b_q: 0,
    };
    const initialCounts: Record<string, number> = {
      p: 8, n: 2, b: 2, r: 2, q: 1,
    };

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.type !== 'k') {
          currentCounts[`${piece.color}_${piece.type}`]++;
        }
      }
    }

    const capturedByWhite: { type: PieceSymbol; color: Color }[] = [];
    const capturedByBlack: { type: PieceSymbol; color: Color }[] = [];

    (['p', 'n', 'b', 'r', 'q'] as PieceSymbol[]).forEach((p) => {
      const bLost = initialCounts[p] - currentCounts[`b_${p}`];
      for (let i = 0; i < bLost; i++) capturedByWhite.push({ type: p, color: 'b' });

      const wLost = initialCounts[p] - currentCounts[`w_${p}`];
      for (let i = 0; i < wLost; i++) capturedByBlack.push({ type: p, color: 'w' });
    });

    let whiteMaterial = capturedByWhite.reduce((sum, p) => sum + (PIECE_VALUES[p.type] || 0) / 100, 0);
    let blackMaterial = capturedByBlack.reduce((sum, p) => sum + (PIECE_VALUES[p.type] || 0) / 100, 0);
    const diff = whiteMaterial - blackMaterial;

    return { capturedByWhite, capturedByBlack, diff };
  };

  const { capturedByWhite, capturedByBlack, diff } = getCapturedPieces();

  // King in check square
  let kingCheckSquare: Square | null = null;
  if (game.inCheck()) {
    const turn = game.turn();
    const board = game.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.type === 'k' && p.color === turn) {
          const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
          kingCheckSquare = `${files[c]}${8 - r}` as Square;
        }
      }
    }
  }

  // Highlight Styles for Chessboard
  const customSquareStyles = {
    ...optionSquares,
    ...(lastMove
      ? {
          [lastMove.from]: { backgroundColor: 'rgba(234, 179, 8, 0.4)' },
          [lastMove.to]: { backgroundColor: 'rgba(234, 179, 8, 0.4)' },
        }
      : {}),
    ...(kingCheckSquare
      ? {
          [kingCheckSquare]: { backgroundColor: 'rgba(225, 29, 72, 0.7)' },
        }
      : {}),
  };

  const formatTimer = (secs: number) => {
    if (secs === 0 && selectedTimeOption === 0) return '∞';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (isFullscreen) {
    const clock = (side: 'w' | 'b') => {
      const t = side === 'w' ? whiteTime : blackTime;
      const live = game.turn() === side && gameStatus === 'playing';
      return (
        <div
          className={`px-3 py-2 rounded-xl border flex items-center gap-2 min-w-[92px] justify-center ${
            live
              ? t <= 10
                ? 'bg-rose-500/20 border-rose-500 eb-danger animate-pulse'
                : 'bg-emerald-500/20 border-emerald-500/50 eb-done'
              : 'bg-[#0E1116] border-[#2A313C] text-[#98A2B3]'
          }`}
        >
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span className="text-sm font-mono font-black tabular-nums">{formatTimer(t)}</span>
        </div>
      );
    };

    return (
      <div className="fixed inset-0 z-[60] bg-[#07090D] flex flex-col items-center justify-between p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {/* Result overlay. The fullscreen view returns before the standard
            overlay renders, so winning in fullscreen previously showed
            nothing at all. */}
        <AnimatePresence>
          {gameStatus !== 'playing' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 bg-[#07090D]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
            >
              <div
                className={`p-5 rounded-3xl mb-4 border ${
                  gameStatus === 'won' || gameStatus === 'timeout_win'
                    ? 'bg-amber-500/20 eb-warn border-amber-500/40'
                    : gameStatus === 'drawn'
                      ? 'bg-slate-500/20 text-slate-300 border-slate-500/40'
                      : 'bg-rose-500/20 eb-danger border-rose-500/40'
                }`}
              >
                {gameStatus === 'won' || gameStatus === 'timeout_win' ? (
                  <Trophy className="w-11 h-11" />
                ) : gameStatus === 'drawn' ? (
                  <ShieldAlert className="w-11 h-11" />
                ) : (
                  <RotateCcw className="w-11 h-11" />
                )}
              </div>

              <h3 className="text-2xl font-black text-white uppercase tracking-wide">
                {gameStatus === 'won'
                  ? 'Checkmate — you win'
                  : gameStatus === 'timeout_win'
                    ? 'Win on time'
                    : gameStatus === 'timeout_loss'
                      ? 'Out of time'
                      : gameStatus === 'drawn'
                        ? 'Draw'
                        : 'Checkmate — you lose'}
              </h3>

              {eloDelta !== null && (
                <p className="text-sm font-mono text-[#98A2B3] mt-2">
                  ELO {userElo}{' '}
                  <span className={eloDelta >= 0 ? 'eb-done' : 'eb-danger'}>
                    {eloDelta >= 0 ? `+${eloDelta}` : eloDelta}
                  </span>
                </p>
              )}

              <p className="text-[11px] font-mono text-[#5A6472] mt-1">
                {moveHistory.length} moves
              </p>

              <div className="flex items-center gap-2 mt-6 flex-wrap justify-center">
                <button
                  onClick={startGame}
                  className="eb-btn-primary px-5 py-3 rounded-xl text-xs font-mono font-black flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Play again
                </button>
                <button
                  onClick={() => setIsFullscreen(false)}
                  className="eb-btn-ghost px-5 py-3 rounded-xl text-xs font-mono font-bold"
                >
                  Exit fullscreen
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Opponent row */}
        <div className="w-full max-w-[640px] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <BrainCircuit
              className={`w-4 h-4 shrink-0 ${isEngineThinking ? 'eb-danger animate-pulse' : 'text-[#98A2B3]'}`}
            />
            <span className="text-xs font-mono font-bold text-[#F4F6F8] truncate">
              Bot · {engineLevel}
            </span>
            {game.inCheck() && gameStatus === 'playing' && (
              <span className="text-[9px] font-mono font-black px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 eb-danger shrink-0">
                CHECK
              </span>
            )}
          </div>
          {clock('b')}
        </div>

        {/* Board */}
        <div className="my-2">
          <Chessboard
            options={{
              position: game.fen(),
              onPieceDrop: onDrop,
              onSquareClick: handleSquareClick,
              boardStyle: {
                width: `${boardWidth}px`,
                height: `${boardWidth}px`,
                borderRadius: '12px',
              },
              darkSquareStyle: { backgroundColor: '#779556' },
              lightSquareStyle: { backgroundColor: '#ebecd0' },
              squareStyles: customSquareStyles,
              animationDurationInMs: 220,
            }}
          />
        </div>

        {/* Player row */}
        <div className="w-full max-w-[640px] flex items-center justify-between gap-2">
          <span className="text-xs font-mono font-bold text-[#F4F6F8] truncate min-w-0">
            You · {userElo}
          </span>
          {clock('w')}
        </div>

        {/* Controls */}
        <div className="w-full max-w-[640px] flex items-center gap-2 mt-2">
          <button
            onClick={() => setIsFullscreen(false)}
            className="eb-press flex-1 py-3 rounded-xl bg-[#8B5CF6] hover:brightness-110 text-white text-xs font-mono font-black flex items-center justify-center gap-1.5 min-h-[44px]"
          >
            <Minimize2 className="w-4 h-4" />
            Exit fullscreen
          </button>
          <button
            onClick={startGame}
            className="eb-press px-4 py-3 rounded-xl bg-[#171B22] border border-[#2A313C] text-[#F4F6F8] text-xs font-mono font-bold min-h-[44px]"
          >
            New
          </button>
        </div>

        {moveHistory.length > 0 && (
          <p className="text-[10px] font-mono text-[#5A6472] mt-1.5">
            Move {moveHistory.length} · {moveHistory[moveHistory.length - 1]}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Top Header & Rating Card */}
      <div className="bg-[#12161F] border border-[#2A313C] rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Eyebrow className="eb-danger border-rose-500/30 bg-rose-500/10">
                CHESS.COM ARENA ENGINE
              </Eyebrow>
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="p-1.5 bg-[#0E1116] border border-[#2A313C] rounded-lg text-[#98A2B3] hover:text-white transition-colors cursor-pointer"
                title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
              >
                {isMuted ? <VolumeX className="w-4 h-4 eb-danger" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-white">Cognitive Chess</h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Persistent User Chess ELO Badge */}
            <div className="flex items-center gap-2.5 px-4 py-2 bg-gradient-to-r from-amber-500/20 to-amber-600/10 border border-amber-500/40 rounded-2xl shadow-lg">
              <Trophy className="w-4 h-4 eb-warn" />
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider eb-warn font-bold">
                  Your Rating
                </div>
                <div className="text-sm font-mono font-black text-white">{userElo} ELO</div>
              </div>
            </div>

            {/* AI ELO Display */}
            <div className="flex items-center gap-2 px-3.5 py-2 bg-[#0E1116] border border-[#2A313C] rounded-2xl">
              <span className="text-xs text-[#98A2B3]">Bot ELO:</span>
              <span className="text-xs font-mono font-black eb-danger">{engineLevel} ELO</span>
            </div>

            {/* Time Control Options */}
            {gameStatus === 'idle' && (
              <div className="flex items-center gap-1.5 bg-[#0E1116] p-1 border border-[#2A313C] rounded-2xl">
                {TIMER_OPTIONS.map((opt) => (
                  <button
                    key={opt.seconds}
                    onClick={() => setSelectedTimeOption(opt.seconds)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                      selectedTimeOption === opt.seconds
                        ? 'bg-rose-500 text-slate-950 shadow-md'
                        : 'text-[#98A2B3] hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {gameStatus === 'idle' && (
          <div className="mt-5 pt-4 border-t border-[#2A313C]/80 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex-1 w-full">
              <div className="flex justify-between items-center mb-1.5 text-xs font-mono">
                <span className="text-[#98A2B3]">Bot Difficulty Level</span>
                <span className="eb-danger font-bold">
                  {engineLevel <= 500
                    ? 'Beginner Bot'
                    : engineLevel <= 1200
                    ? 'Intermediate Bot'
                    : engineLevel <= 2000
                    ? 'Advanced Master'
                    : 'Grandmaster AI'}
                </span>
              </div>
              <input
                type="range"
                min="100"
                max="3000"
                step="50"
                value={engineLevel}
                onChange={(e) => setEngineLevel(Number(e.target.value))}
                className="w-full accent-rose-500 h-2 bg-[#171B22] rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <button
              onClick={startGame}
              className="w-full sm:w-auto px-8 py-3.5 bg-rose-500 hover:bg-rose-400 text-slate-950 font-display text-sm font-black uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2.5 shadow-[0_0_25px_rgba(244,63,94,0.4)] transition-all transform hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Swords className="w-5 h-5" />
              <span>Start Match</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Arena Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Board Column (8 cols) */}
        <div className="lg:col-span-8 space-y-3" ref={boardContainerRef}>
          <button
            onClick={() => setIsFullscreen(true)}
            className="eb-press eb-shine lg:hidden w-full py-2.5 rounded-xl bg-[#8B5CF6]/12 border border-[#8B5CF6]/35 text-[#A78BFA] text-[11px] font-mono font-bold flex items-center justify-center gap-1.5 min-h-[42px]"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            Fullscreen board
          </button>

          {/* Black / AI Opponent Card */}
          <div className="bg-[#12161F] border border-[#2A313C] rounded-2xl px-4 py-3 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-200 shadow-inner">
                <BrainCircuit className={`w-5 h-5 ${isEngineThinking ? 'eb-danger animate-pulse' : ''}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-display font-extrabold text-white">Grandmaster Bot</h4>
                  <span className="px-2 py-0.5 bg-rose-500/10 border border-rose-500/30 eb-danger text-[10px] font-mono font-bold rounded-md">
                    {engineLevel} ELO
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-0.5 min-h-[18px]">
                  {capturedByBlack.map((p, idx) => (
                    <span key={idx} className="text-xs uppercase font-mono text-slate-400 font-black">
                      {p.type}
                    </span>
                  ))}
                  {diff < 0 && (
                    <span className="text-[11px] font-mono font-bold eb-danger ml-1">+{Math.abs(diff)}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Black Timer Clock */}
            <div
              className={`px-4 py-2 rounded-xl border flex items-center gap-2 transition-all ${
                game.turn() === 'b' && gameStatus === 'playing'
                  ? blackTime <= 10
                    ? 'bg-rose-500/20 border-rose-500 eb-danger animate-pulse'
                    : 'bg-emerald-500/20 border-emerald-500/50 eb-done shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                  : 'bg-[#0E1116] border-[#2A313C] text-[#98A2B3]'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span className="text-base font-mono font-black tracking-wider">{formatTimer(blackTime)}</span>
            </div>
          </div>

          {/* Large High-Res Chessboard Stage */}
          <div className="relative w-full bg-[#171B22] rounded-3xl p-3 sm:p-4 border-2 border-[#2A313C] shadow-2xl flex items-center justify-center overflow-hidden">
            {/* GameOver Overlay Screen */}
            <AnimatePresence>
              {(gameStatus === 'won' ||
                gameStatus === 'lost' ||
                gameStatus === 'drawn' ||
                gameStatus === 'timeout_win' ||
                gameStatus === 'timeout_loss') && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="absolute inset-0 z-30 bg-[#0D1117]/94 backdrop-blur-md rounded-3xl flex flex-col items-center justify-center p-6 text-center"
                >
                  <div
                    className={`p-5 rounded-3xl mb-4 ${
                      gameStatus === 'won' || gameStatus === 'timeout_win'
                        ? 'bg-amber-500/20 eb-warn border border-amber-500/40 shadow-[0_0_30px_rgba(245,158,11,0.3)]'
                        : gameStatus === 'drawn'
                        ? 'bg-slate-500/20 text-slate-300 border border-slate-500/40'
                        : 'bg-rose-500/20 eb-danger border border-rose-500/40 shadow-[0_0_30px_rgba(244,63,94,0.3)]'
                    }`}
                  >
                    {gameStatus === 'won' || gameStatus === 'timeout_win' ? (
                      <Trophy className="w-12 h-12" />
                    ) : gameStatus === 'drawn' ? (
                      <ShieldAlert className="w-12 h-12" />
                    ) : (
                      <RotateCcw className="w-12 h-12" />
                    )}
                  </div>

                  <h3 className="text-3xl font-display font-black text-white uppercase tracking-wider mb-2">
                    {gameStatus === 'won'
                      ? 'Checkmate Victory!'
                      : gameStatus === 'timeout_win'
                      ? 'Victory on Time!'
                      : gameStatus === 'timeout_loss'
                      ? 'Out of Time'
                      : gameStatus === 'drawn'
                      ? drawReason || 'Draw'
                      : 'Match Defeat'}
                  </h3>

                  {eloDelta !== null && (
                    <div className="flex items-center gap-2 mb-6 bg-[#12161F] border border-[#2A313C] px-5 py-2.5 rounded-2xl">
                      <span className="text-xs text-[#98A2B3]">ELO RATING:</span>
                      <div className="flex items-center gap-1 text-sm font-mono font-black text-white">
                        <span>{userElo}</span>
                        <span
                          className={`flex items-center ${
                            eloDelta >= 0 ? 'eb-done' : 'eb-danger'
                          }`}
                        >
                          {eloDelta >= 0 ? (
                            <TrendingUp className="w-4 h-4 ml-1" />
                          ) : (
                            <TrendingDown className="w-4 h-4 ml-1" />)}
                          {eloDelta >= 0 ? `+${eloDelta}` : eloDelta}
                        </span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={startGame}
                    className="px-8 py-3.5 bg-white text-slate-950 font-mono text-xs font-bold uppercase rounded-xl hover:bg-slate-200 transition-all active:scale-95 cursor-pointer shadow-xl flex items-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Play Again</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Pawn Promotion Overlay */}
            <AnimatePresence>
              {pendingPromotion && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-center p-6"
                >
                  <h4 className="text-lg font-display font-extrabold text-white mb-4 uppercase tracking-wider">
                    Promote Pawn
                  </h4>
                  <div className="flex gap-4">
                    {[
                      { code: 'q', label: 'Queen ♕' },
                      { code: 'r', label: 'Rook ♖' },
                      { code: 'b', label: 'Bishop ♗' },
                      { code: 'n', label: 'Knight ♘' },
                    ].map((p) => (
                      <button
                        key={p.code}
                        onClick={() =>
                          makeAMove({
                            from: pendingPromotion.from,
                            to: pendingPromotion.to,
                            promotion: p.code,
                          })
                        }
                        className="px-4 py-3 bg-[#12161F] border-2 border-rose-500/60 rounded-2xl hover:bg-rose-500/20 text-white font-mono font-bold text-sm hover:scale-110 transition-all cursor-pointer shadow-xl"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* High Quality Chessboard Component */}
            <div className="rounded-2xl overflow-hidden border-2 border-[#2A313C] shadow-2xl">
              <Chessboard
                options={{
                  position: game.fen(),
                  onPieceDrop: onDrop,
                  onSquareClick: handleSquareClick,
                  boardStyle: {
                    width: `${boardWidth}px`,
                    height: `${boardWidth}px`,
                    borderRadius: '16px',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
                  },
                  darkSquareStyle: { backgroundColor: '#779556' },
                  lightSquareStyle: { backgroundColor: '#ebecd0' },
                  squareStyles: customSquareStyles,
                  animationDurationInMs: 220,
                }}
              />
            </div>
          </div>

          {/* White / You Player Card */}
          <div className="bg-[#12161F] border border-[#2A313C] rounded-2xl px-4 py-3 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center eb-warn font-black shadow-inner">
                <User className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-display font-extrabold text-white">
                    {(profile as any).name || 'You'}
                  </h4>
                  <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 eb-warn text-[10px] font-mono font-bold rounded-md">
                    {userElo} ELO
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-0.5 min-h-[18px]">
                  {capturedByWhite.map((p, idx) => (
                    <span key={idx} className="text-xs uppercase font-mono eb-warn font-black">
                      {p.type}
                    </span>
                  ))}
                  {diff > 0 && (
                    <span className="text-[11px] font-mono font-bold eb-done ml-1">+{diff}</span>
                  )}
                </div>
              </div>
            </div>

            {/* White Timer Clock */}
            <div
              className={`px-4 py-2 rounded-xl border flex items-center gap-2 transition-all ${
                game.turn() === 'w' && gameStatus === 'playing'
                  ? whiteTime <= 10
                    ? 'bg-rose-500/20 border-rose-500 eb-danger animate-pulse'
                    : 'bg-emerald-500/20 border-emerald-500/50 eb-done shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                  : 'bg-[#0E1116] border-[#2A313C] text-[#98A2B3]'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span className="text-base font-mono font-black tracking-wider">{formatTimer(whiteTime)}</span>
            </div>
          </div>
        </div>

        {/* Sidebar Log & Game Stats (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Match Info & Controls */}
          <div className="bg-[#12161F] border border-[#2A313C] rounded-3xl p-5 shadow-xl">
            <h3 className="text-sm font-display font-extrabold text-white mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 eb-danger" />
              <span>Match Status</span>
            </h3>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs font-mono p-3 bg-[#0E1116] rounded-2xl border border-[#2A313C]">
                <span className="text-[#98A2B3]">Active Turn:</span>
                <span className="font-bold text-white uppercase flex items-center gap-1.5">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      game.turn() === 'w' ? 'bg-white' : 'bg-slate-800 border border-slate-500'
                    }`}
                  />
                  {game.turn() === 'w' ? 'White (You)' : 'Black (Bot)'}
                </span>
              </div>

              {game.inCheck() && !game.isGameOver() && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/40 rounded-2xl text-xs font-mono font-bold eb-danger flex items-center gap-2 animate-pulse">
                  <ShieldAlert className="w-4 h-4" />
                  <span>KING IS IN CHECK!</span>
                </div>
              )}

              {gameStatus === 'playing' && (
                <button
                  onClick={() => finishMatch('lost')}
                  className="w-full py-3 border border-rose-500/40 hover:bg-rose-500/10 eb-danger font-mono text-xs font-bold uppercase rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Resign Match</span>
                </button>
              )}
            </div>
          </div>

          {/* Live Move History Notation */}
          <div className="bg-[#12161F] border border-[#2A313C] rounded-3xl p-5 shadow-xl">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-display font-extrabold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 eb-warn" />
                <span>Move History</span>
              </h3>
              <span className="text-[10px] font-mono text-[#98A2B3]">{moveHistory.length} moves</span>
            </div>

            <div className="h-56 overflow-y-auto pr-1 space-y-1 font-mono text-xs custom-scrollbar">
              {moveHistory.length === 0 ? (
                <div className="text-center py-12 text-[#6C757D] text-xs">
                  No moves made yet
                </div>
              ) : (
                Array.from({ length: Math.ceil(moveHistory.length / 2) }).map((_, idx) => {
                  const whiteMove = moveHistory[idx * 2];
                  const blackMove = moveHistory[idx * 2 + 1];
                  return (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-1 px-3 py-1.5 rounded-xl bg-[#0E1116]/80 border border-white/5 hover:border-white/10"
                    >
                      <span className="col-span-2 text-[#6C757D] font-bold">{idx + 1}.</span>
                      <span className="col-span-5 text-white font-bold">{whiteMove}</span>
                      <span className="col-span-5 text-[#98A2B3]">{blackMove || ''}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
