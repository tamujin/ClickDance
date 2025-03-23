import { useState, useEffect, useRef } from 'react'
import './App.css'

interface Target {
  id: number;
  x: number;
  y: number;
  createdAt: number;
  isHit?: boolean;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  size: number;
}

interface GameStats {
  totalClicks: number;
  accurateClicks: number;
  averageReactionTime: number;
  missedTargets: number;
  totalDistance: number;
  lastMousePosition: { x: number; y: number };
}

type SessionDuration = 30 | 60 | 120 | 300 | 600;

const SESSION_OPTIONS: { value: SessionDuration; label: string }[] = [
  { value: 30, label: '30 Seconds' },
  { value: 60, label: '1 Minute' },
  { value: 120, label: '2 Minutes' },
  { value: 300, label: '5 Minutes' },
  { value: 600, label: '10 Minutes' },
];

type CursorType = 'default' | 'crosshair' | 'none' | 'pointer' | 'move' | 'grab' | 'cell';

const CURSOR_OPTIONS: { value: CursorType; label: string }[] = [
  { value: 'default', label: 'Default Cursor' },
  { value: 'crosshair', label: 'Crosshair' },
  { value: 'none', label: 'No Cursor' },
  { value: 'pointer', label: 'Pointer' },
  { value: 'move', label: 'Move' },
  { value: 'grab', label: 'Grab' },
  { value: 'cell', label: 'Cell' },
];

function App() {
  const [isGameStarted, setIsGameStarted] = useState(false)
  const [targets, setTargets] = useState<Target[]>([])
  const [score, setScore] = useState(0)
  const [selectedCursor, setSelectedCursor] = useState<CursorType>('default')
  const [sessionDuration, setSessionDuration] = useState<SessionDuration>(60)
  const [timeLeft, setTimeLeft] = useState<number>(sessionDuration)
  const [gameStats, setGameStats] = useState<GameStats>({
    totalClicks: 0,
    accurateClicks: 0,
    averageReactionTime: 0,
    missedTargets: 0,
    totalDistance: 0,
    lastMousePosition: { x: 0, y: 0 },
  })
  const [showSummary, setShowSummary] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<number>()
  const totalReactionTimeRef = useRef(0)
  const [particles, setParticles] = useState<Particle[]>([])
  const [isIntenseMode, setIsIntenseMode] = useState(false)

  const generateTarget = () => {
    if (!canvasRef.current) return;

    // Don't generate more targets if we already have 3
    if (targets.length >= 3) return;

    const canvas = canvasRef.current;
    const canvasRect = canvas.getBoundingClientRect();
    const targetSize = Math.min(50, window.innerWidth * 0.06);
    const margin = targetSize / 2;

    // In intense mode, maybe generate an extra target (max 2 at once)
    const targetsToGenerate = isIntenseMode && Math.random() > 0.5 ? 2 : 1;
    
    const newTargets: Target[] = [];
    for (let i = 0; i < targetsToGenerate; i++) {
      const x = Math.random() * (canvasRect.width - targetSize) + margin;
      const y = Math.random() * (canvasRect.height - targetSize) + margin;
      
      newTargets.push({
        id: Date.now() + i,
        x,
        y,
        createdAt: Date.now(),
      });
    }
    
    setTargets(prev => {
      // Make sure we don't exceed 3 targets
      const combined = [...prev, ...newTargets];
      return combined.slice(0, 3);
    });
  }

  const createParticles = (x: number, y: number) => {
    const particleCount = isIntenseMode ? 16 : 12;
    const newParticles: Particle[] = [];
    
    for (let i = 0; i < particleCount; i++) {
      const angle = (i * 360) / particleCount;
      const velocity = isIntenseMode ? 150 + Math.random() * 100 : 100 + Math.random() * 50;
      const size = 3 + Math.random() * 3;
      
      newParticles.push({
        id: Date.now() + i,
        x,
        y,
        tx: Math.cos(angle * Math.PI / 180) * velocity,
        ty: Math.sin(angle * Math.PI / 180) * velocity,
        size,
      });
    }
    
    setParticles(prev => [...prev, ...newParticles]);
    setTimeout(() => {
      setParticles(prev => prev.filter(p => !newParticles.includes(p)));
    }, isIntenseMode ? 400 : 800);
  };

  const handleTargetClick = (targetId: number) => {
    const target = targets.find(t => t.id === targetId);
    if (target) {
      const reactionTime = Date.now() - target.createdAt;
      totalReactionTimeRef.current += reactionTime;
      
      setGameStats(prev => ({
        ...prev,
        accurateClicks: prev.accurateClicks + 1,
        averageReactionTime: totalReactionTimeRef.current / (prev.accurateClicks + 1)
      }));

      // Create explosion effect and mark target as hit
      createParticles(target.x, target.y);
      setTargets(prev => prev.map(t => 
        t.id === targetId ? { ...t, isHit: true } : t
      ));
      
      // Remove hit target and generate new one immediately
      setTimeout(() => {
        setTargets(prev => prev.filter(t => t.id !== targetId));
        setScore(prev => prev + 1);
      }, isIntenseMode ? 300 : 500);

      // Generate next target immediately
      generateTarget();
    }
  }

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (targets.length === 0) return;
    
    setGameStats(prev => ({
      ...prev,
      totalClicks: prev.totalClicks + 1,
    }));
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    const { clientX, clientY } = e;
    const { lastMousePosition } = gameStats;
    
    if (lastMousePosition.x === 0 && lastMousePosition.y === 0) {
      setGameStats(prev => ({
        ...prev,
        lastMousePosition: { x: clientX, y: clientY }
      }));
      return;
    }

    const distance = Math.sqrt(
      Math.pow(clientX - lastMousePosition.x, 2) +
      Math.pow(clientY - lastMousePosition.y, 2)
    );

    setGameStats(prev => ({
      ...prev,
      totalDistance: prev.totalDistance + distance,
      lastMousePosition: { x: clientX, y: clientY }
    }));
  }

  const startGame = () => {
    setIsGameStarted(true)
    setScore(0)
    setTimeLeft(sessionDuration)
    setShowSummary(false)
    setGameStats({
      totalClicks: 0,
      accurateClicks: 0,
      averageReactionTime: 0,
      missedTargets: 0,
      totalDistance: 0,
      lastMousePosition: { x: 0, y: 0 },
    })
    totalReactionTimeRef.current = 0
    generateTarget()

    timerRef.current = window.setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          endGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  const endGame = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setIsGameStarted(false)
    setTargets([])
    setShowSummary(true)
  }

  const stopGame = () => {
    endGame();
    setShowSummary(false);
  }

  useEffect(() => {
    if (isGameStarted) {
      // Check if we're in the last 25% of the game
      const intenseModeThreshold = sessionDuration * 0.75;
      setIsIntenseMode(timeLeft <= intenseModeThreshold);
    }
  }, [timeLeft, sessionDuration, isGameStarted]);

  useEffect(() => {
    if (isGameStarted && targets.length === 0) {
      generateTarget()
    }
  }, [targets, isGameStarted])

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  return (
    <>
      <div className="gradient-overlay"></div>
      <div className="app-container">
        <h1>ClickDance</h1>
        <div className="game-area">
          <div className="settings-panel">
            {!isGameStarted && (
              <>
                <div className="setting-group">
                  <label htmlFor="session-select">Session Duration: </label>
                  <select
                    id="session-select"
                    value={sessionDuration}
                    onChange={(e) => setSessionDuration(Number(e.target.value) as SessionDuration)}
                    className="session-select"
                  >
                    {SESSION_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="setting-group">
                  <label htmlFor="cursor-select">Cursor Style: </label>
                  <select
                    id="cursor-select"
                    value={selectedCursor}
                    onChange={(e) => setSelectedCursor(e.target.value as CursorType)}
                    className="cursor-select"
                  >
                    {CURSOR_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>
          
          {!isGameStarted ? (
            <>
              <button onClick={startGame} className="start-button">
                Start Game
              </button>
              {showSummary && (
                <div className="game-summary">
                  <h2>Game Summary</h2>
                  <div className="summary-stats">
                    <div className="stat-item">
                      <span className="stat-label">Final Score:</span>
                      <span className="stat-value">{score}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Accuracy:</span>
                      <span className="stat-value">
                        {gameStats.totalClicks > 0
                          ? `${((gameStats.accurateClicks / gameStats.totalClicks) * 100).toFixed(1)}%`
                          : '0%'}
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Average Reaction Time:</span>
                      <span className="stat-value">
                        {gameStats.averageReactionTime > 0
                          ? `${gameStats.averageReactionTime.toFixed(0)}ms`
                          : '0ms'}
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Total Distance Moved:</span>
                      <span className="stat-value">
                        {`${Math.round(gameStats.totalDistance)}px`}
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Clicks per Second:</span>
                      <span className="stat-value">
                        {(score / sessionDuration).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="play-area">
              <div className="game-stats">
                <button onClick={stopGame} className="stop-button">
                  Stop Game
                </button>
                <div className="live-stats">
                  <div className="stat">Score: {score}</div>
                  <div className="stat">Time: {formatTime(timeLeft)}</div>
                  <div className="stat">
                    Accuracy: {
                      gameStats.totalClicks > 0
                        ? `${((gameStats.accurateClicks / gameStats.totalClicks) * 100).toFixed(1)}%`
                        : '0%'
                    }
                  </div>
                </div>
              </div>
              <div 
                ref={canvasRef}
                className="game-canvas"
                style={{ cursor: selectedCursor }}
                onClick={handleCanvasClick}
                onMouseMove={handleMouseMove}
              >
                {targets.map(target => (
                  <div
                    key={target.id}
                    className={`target ${target.isHit ? 'hit' : ''}`}
                    style={{
                      left: `${target.x}px`,
                      top: `${target.y}px`
                    }}
                    onClick={() => handleTargetClick(target.id)}
                  />
                ))}
                {particles.map(particle => (
                  <div
                    key={particle.id}
                    className="particle"
                    style={{
                      left: `${particle.x}px`,
                      top: `${particle.y}px`,
                      width: `${particle.size}px`,
                      height: `${particle.size}px`,
                      '--tx': `${particle.tx}px`,
                      '--ty': `${particle.ty}px`,
                    } as React.CSSProperties}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default App
