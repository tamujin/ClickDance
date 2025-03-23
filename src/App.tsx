import { useState, useEffect, useRef } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import './App.css'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Sound options
type SoundOption = 'none' | 'pikachu' | 'gun' | 'pop' | 'laser';

const SOUND_OPTIONS: { label: string; value: SoundOption }[] = [
  { label: 'No Sound', value: 'none' },
  { label: 'Pikachu', value: 'pikachu' },
  { label: 'Gun Shot', value: 'gun' },
  { label: 'Pop', value: 'pop' },
  { label: 'Laser', value: 'laser' },
];

// Mouse sensitivity options
const SENSITIVITY_OPTIONS = [
  { label: 'Very Low', value: 0.5 },
  { label: 'Low', value: 0.75 },
  { label: 'Normal', value: 1 },
  { label: 'High', value: 1.25 },
  { label: 'Very High', value: 1.5 },
];

interface PathPoint {
  x: number;
  y: number;
}

interface Target {
  id: number;
  x: number;
  y: number;
  createdAt: number;
  isHit?: boolean;
  requiresDoubleClick?: boolean;
  clickCount?: number;
  isPathTarget?: boolean;
  pathPoints?: PathPoint[];
  progress?: number;
  isDragging?: boolean;
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

type SessionDuration = 15 | 30 | 60 | 120 | 300 | 600;

const SESSION_OPTIONS: { value: SessionDuration; label: string }[] = [
  { value: 15, label: '15 Seconds' },
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

interface GameRecord {
  id: string;
  date: string;
  score: number;
  accuracy: number;
  averageReactionTime: number;
  totalDistance: number;
  clicksPerSecond: number;
  sessionDuration: number;
  totalClicks: number;
  accurateClicks: number;
}

function App() {
  const [isGameStarted, setIsGameStarted] = useState(false)
  const [targets, setTargets] = useState<Target[]>([])
  const [score, setScore] = useState(0)
  const [selectedCursor, setSelectedCursor] = useState<CursorType>('default')
  const [sessionDuration, setSessionDuration] = useState<SessionDuration>(15)
  const [timeLeft, setTimeLeft] = useState<number>(15)
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
  const [selectedSound, setSelectedSound] = useState<SoundOption>('none')
  const [mouseSensitivity, setMouseSensitivity] = useState(1)
  const soundsRef = useRef<{ [key: string]: HTMLAudioElement }>({})
  const [dragTarget, setDragTarget] = useState<Target | null>(null)
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [showProfile, setShowProfile] = useState(false)

  // Initialize sound effects
  useEffect(() => {
    const loadSound = async (name: string) => {
      const audio = new Audio();
      audio.volume = 0.5; // Set volume to 50%
      try {
        const response = await fetch(`./sounds/${name}.wav`);
        if (!response.ok) {
          throw new Error(`Failed to load sound: ${name}`);
        }
        const blob = await response.blob();
        audio.src = URL.createObjectURL(blob);
        await audio.load();
        return audio;
      } catch (err) {
        console.error(`Error loading sound ${name}:`, err);
        return null;
      }
    };

    const initSounds = async () => {
      const sounds = {
        pikachu: await loadSound('pikachu'),
        gun: await loadSound('gun'),
        pop: await loadSound('pop'),
        laser: await loadSound('laser')
      };

      // Filter out any null values from failed loads
      soundsRef.current = Object.fromEntries(
        Object.entries(sounds).filter(([_, audio]) => audio !== null)
      ) as { [key: string]: HTMLAudioElement };
    };

    initSounds();

    // Cleanup
    return () => {
      Object.values(soundsRef.current).forEach(audio => {
        URL.revokeObjectURL(audio.src);
      });
    };
  }, []);

  const playSound = (sound: SoundOption) => {
    if (sound !== 'none' && soundsRef.current[sound]) {
      try {
        const audio = soundsRef.current[sound];
        audio.currentTime = 0;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(err => {
            if (err.name !== 'AbortError') {
              console.error('Error playing sound:', err);
            }
          });
        }
      } catch (err) {
        console.error('Error playing sound:', err);
      }
    }
  };

  const generateCurvePath = (startX: number, startY: number, width: number, height: number): PathPoint[] => {
    const points: PathPoint[] = [];
    const numPoints = 30;
    const pathRadius = Math.min(width, height) / 4;
    const centerX = startX + pathRadius;
    const centerY = startY;
    
    // Randomly decide if the curve should be clockwise or counter-clockwise
    const isClockwise = Math.random() > 0.5;
    
    for (let i = 0; i < numPoints; i++) {
      const t = i / (numPoints - 1);
      const angle = isClockwise ? Math.PI * t : Math.PI * (1 - t);
      
      // Create a semicircular path
      const x = centerX + pathRadius * Math.cos(angle);
      const y = centerY + pathRadius * Math.sin(angle);
      
      points.push({ x, y });
    }
    
    return points;
  };

  const generateTarget = () => {
    if (!canvasRef.current) return;
    if (targets.length >= 3) return;

    const canvas = canvasRef.current;
    const canvasRect = canvas.getBoundingClientRect();
    const targetSize = Math.min(50, window.innerWidth * 0.06);
    const margin = targetSize;

    const targetsToGenerate = isIntenseMode && Math.random() > 0.5 ? 2 : 1;
    
    const newTargets: Target[] = [];
    for (let i = 0; i < targetsToGenerate; i++) {
      const x = Math.random() * (canvasRect.width - 2 * margin) + margin;
      const y = Math.random() * (canvasRect.height - 2 * margin) + margin;
      
      newTargets.push({
        id: Date.now() + i,
        x,
        y,
        createdAt: Date.now(),
        requiresDoubleClick: Math.random() < 0.2,
        clickCount: 0
      });
    }
    
    setTargets(prev => {
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
    if (!target) return;

    if (target.requiresDoubleClick) {
      // Handle double-click targets
      const updatedClickCount = (target.clickCount || 0) + 1;
      if (updatedClickCount < 2) {
        setTargets(prev => prev.map(t =>
          t.id === targetId ? { ...t, clickCount: updatedClickCount } : t
        ));
        return;
      }
    }

    const reactionTime = Date.now() - target.createdAt;
    totalReactionTimeRef.current += reactionTime;
    
    setGameStats(prev => ({
      ...prev,
      accurateClicks: prev.accurateClicks + 1,
      averageReactionTime: totalReactionTimeRef.current / (prev.accurateClicks + 1)
    }));

    // Play sound effect
    playSound(selectedSound);

    // Create explosion effect and mark target as hit
    createParticles(target.x, target.y);
    setTargets(prev => prev.map(t => 
      t.id === targetId ? { ...t, isHit: true } : t
    ));
    
    setTimeout(() => {
      setTargets(prev => prev.filter(t => t.id !== targetId));
      setScore(prev => prev + 1);
    }, isIntenseMode ? 300 : 500);

    generateTarget();
  }

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (targets.length === 0) return;
    
    setGameStats(prev => ({
      ...prev,
      totalClicks: prev.totalClicks + 1,
    }));
  }

  const handleTargetMouseDown = (targetId: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event bubbling
    const target = targets.find(t => t.id === targetId);
    if (!target?.isPathTarget) return;

    setDragTarget(target);
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    
    setTargets(prev => prev.map(t =>
      t.id === targetId ? { ...t, isDragging: true } : t
    ));
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isGameStarted) return;
    
    const movementX = e.movementX * mouseSensitivity;
    const movementY = e.movementY * mouseSensitivity;
    
    setGameStats(prev => ({
      ...prev,
      totalDistance: prev.totalDistance + Math.sqrt(movementX * movementX + movementY * movementY)
    }));

    // Handle path target dragging
    if (dragTarget?.isPathTarget) {
      e.stopPropagation(); // Prevent event bubbling
      const target = targets.find(t => t.id === dragTarget.id);
      if (!target?.pathPoints || !target.isDragging) return;

      const mousePos = { x: e.clientX, y: e.clientY };
      const dx = mousePos.x - lastMousePosRef.current.x;
      
      // Update progress based on horizontal movement
      const pathLength = target.pathPoints[target.pathPoints.length - 1].x - target.pathPoints[0].x;
      const newProgress = Math.max(0, Math.min(1, (target.progress || 0) + (dx / pathLength)));

      if (newProgress >= 1) {
        // Path completed
        playSound(selectedSound);
        createParticles(target.x, target.y);
        setTargets(prev => prev.filter(t => t.id !== target.id));
        setScore(prev => prev + 1);
        setDragTarget(null);
        generateTarget();
      } else {
        // Update target position along path
        const pointIndex = Math.floor(newProgress * (target.pathPoints.length - 1));
        const point = target.pathPoints[pointIndex];
        
        setTargets(prev => prev.map(t =>
          t.id === target.id ? { 
            ...t, 
            progress: newProgress,
            x: point.x,
            y: point.y
          } : t
        ));
      }

      lastMousePosRef.current = mousePos;
    }
  };

  const handleMouseUp = () => {
    if (dragTarget) {
      setDragTarget(null);
      setTargets(prev => prev.map(t =>
        t.id === dragTarget.id ? { ...t, isDragging: false } : t
      ));
    }
  };

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
    saveGameRecord()
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

  const saveGameRecord = () => {
    const gameRecord: GameRecord = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      score,
      accuracy: gameStats.totalClicks > 0 ? (gameStats.accurateClicks / gameStats.totalClicks) * 100 : 0,
      averageReactionTime: gameStats.averageReactionTime,
      totalDistance: gameStats.totalDistance,
      clicksPerSecond: gameStats.accurateClicks / sessionDuration,
      sessionDuration,
      totalClicks: gameStats.totalClicks,
      accurateClicks: gameStats.accurateClicks
    };

    // Get existing records
    const existingRecords = JSON.parse(localStorage.getItem('gameRecords') || '[]') as GameRecord[];
    
    // Add new record
    const updatedRecords = [...existingRecords, gameRecord];
    
    // Sort by score in descending order
    updatedRecords.sort((a, b) => b.score - a.score);
    
    // Store in localStorage
    localStorage.setItem('gameRecords', JSON.stringify(updatedRecords));
  };

  const getTopRecords = (limit: number = 10): GameRecord[] => {
    const records = JSON.parse(localStorage.getItem('gameRecords') || '[]') as GameRecord[];
    return records.slice(0, limit);
  };

  const getAllRecords = (): GameRecord[] => {
    return JSON.parse(localStorage.getItem('gameRecords') || '[]') as GameRecord[];
  };

  const getChartData = () => {
    const records = getAllRecords();
    const lastTenGames = records.slice(-10);

    return {
      labels: lastTenGames.map(record => new Date(record.date).toLocaleDateString()),
      datasets: [
        {
          label: 'Score',
          data: lastTenGames.map(record => record.score),
          borderColor: '#00ff9d',
          backgroundColor: 'rgba(0, 255, 157, 0.5)',
          tension: 0.4
        },
        {
          label: 'Accuracy (%)',
          data: lastTenGames.map(record => record.accuracy),
          borderColor: '#ff9d00',
          backgroundColor: 'rgba(255, 157, 0, 0.5)',
          tension: 0.4
        }
      ]
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#00ff9d'
        }
      },
      title: {
        display: true,
        text: 'Performance Trends',
        color: '#00ff9d',
        font: {
          size: 16
        }
      }
    },
    scales: {
      y: {
        grid: {
          color: 'rgba(0, 255, 157, 0.1)'
        },
        ticks: {
          color: '#00ff9d'
        }
      },
      x: {
        grid: {
          color: 'rgba(0, 255, 157, 0.1)'
        },
        ticks: {
          color: '#00ff9d'
        }
      }
    }
  };

  return (
    <>
      <div className="gradient-overlay"></div>
      <div className="app-container">
        {!isGameStarted ? (
          <>
            {showSummary ? (
              <div className="game-summary-modal">
                <div className="game-summary">
                  <h2>Game Over!</h2>
                  <div className="summary-stats">
                    <div className="stat">Final Score: {score}</div>
                    <div className="stat">
                      Accuracy: {
                        gameStats.totalClicks > 0
                          ? `${((gameStats.accurateClicks / gameStats.totalClicks) * 100).toFixed(1)}%`
                          : '0%'
                      }
                    </div>
                    <div className="stat">
                      Average Reaction Time: {gameStats.averageReactionTime.toFixed(0)}ms
                    </div>
                    <div className="stat">
                      Total Distance: {gameStats.totalDistance.toFixed(0)}px
                    </div>
                    <div className="stat">
                      Clicks per Second: {
                        (gameStats.accurateClicks / sessionDuration).toFixed(2)
                      }
                    </div>
                  </div>
                  <button className="ok-button" onClick={() => setShowSummary(false)}>OK</button>
                </div>
              </div>
            ) : showLeaderboard ? (
              <div className="leaderboard">
                <h2>Top Scores</h2>
                <div className="leaderboard-table">
                  {getTopRecords().map((record, index) => (
                    <div key={record.id} className="leaderboard-row">
                      <div className="rank">{index + 1}</div>
                      <div className="score">{record.score}</div>
                      <div className="accuracy">{record.accuracy.toFixed(1)}%</div>
                      <div className="date">{new Date(record.date).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
                <button className="back-button" onClick={() => setShowLeaderboard(false)}>Back</button>
              </div>
            ) : showProfile ? (
              <div className="profile-page">
                <h2>Your Performance History</h2>
                <div className="stats-overview">
                  <div className="chart-container">
                    <Line options={chartOptions} data={getChartData()} />
                  </div>
                  <div className="stats-summary">
                    <div className="stat-card">
                      <h3>Best Score</h3>
                      <div className="value">
                        {Math.max(...getAllRecords().map(r => r.score))}
                      </div>
                    </div>
                    <div className="stat-card">
                      <h3>Average Accuracy</h3>
                      <div className="value">
                        {(getAllRecords().reduce((acc, r) => acc + r.accuracy, 0) / getAllRecords().length).toFixed(1)}%
                      </div>
                    </div>
                    <div className="stat-card">
                      <h3>Total Games</h3>
                      <div className="value">
                        {getAllRecords().length}
                      </div>
                    </div>
                  </div>
                  <div className="performance-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Score</th>
                          <th>Accuracy</th>
                          <th>Reaction Time</th>
                          <th>CPS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getAllRecords().map(record => (
                          <tr 
                            key={record.id}
                            className={`performance-row ${
                              record.score > 50 ? 'excellent' :
                              record.score > 30 ? 'good' :
                              record.score > 15 ? 'average' : 'needs-improvement'
                            }`}
                          >
                            <td>{new Date(record.date).toLocaleDateString()}</td>
                            <td>{record.score}</td>
                            <td>{record.accuracy.toFixed(1)}%</td>
                            <td>{record.averageReactionTime.toFixed(0)}ms</td>
                            <td>{record.clicksPerSecond.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <button className="back-button" onClick={() => setShowProfile(false)}>Back</button>
              </div>
            ) : (
              <div className="settings-panel">
                <h1>ClickDance</h1>
                <div className="settings-group">
                  <label>Session Duration:</label>
                  <select 
                    value={sessionDuration} 
                    onChange={(e) => setSessionDuration(Number(e.target.value))}
                  >
                    {SESSION_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="settings-group">
                  <label>Cursor Style:</label>
                  <select 
                    value={selectedCursor} 
                    onChange={(e) => setSelectedCursor(e.target.value)}
                  >
                    {CURSOR_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="settings-group">
                  <label>Mouse Sensitivity:</label>
                  <select 
                    value={mouseSensitivity} 
                    onChange={(e) => setMouseSensitivity(Number(e.target.value))}
                  >
                    {SENSITIVITY_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="settings-group">
                  <label>Sound Effect:</label>
                  <select 
                    value={selectedSound} 
                    onChange={(e) => setSelectedSound(e.target.value as SoundOption)}
                  >
                    {SOUND_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="nav-buttons">
                  <button className="nav-button" onClick={() => setShowLeaderboard(true)}>
                    Leaderboard
                  </button>
                  <button className="nav-button" onClick={() => setShowProfile(true)}>
                    Profile
                  </button>
                </div>
                <button className="start-button" onClick={startGame}>Start Game</button>
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
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {targets.map(target => (
                <div key={target.id}>
                  {target.isPathTarget ? (
                    <>
                      <svg className="path-target" width="100%" height="100%" style={{ position: 'absolute', pointerEvents: 'none' }}>
                        <path
                          d={`M ${target.pathPoints?.map(p => `${p.x},${p.y}`).join(' L ')}`}
                          fill="none"
                          stroke="rgba(0, 255, 157, 0.3)"
                          strokeWidth="20"
                          strokeLinecap="round"
                        />
                      </svg>
                      <div
                        className={`target path-target ${target.isDragging ? 'dragging' : ''}`}
                        style={{
                          left: `${target.x}px`,
                          top: `${target.y}px`
                        }}
                        onMouseDown={(e) => handleTargetMouseDown(target.id, e)}
                      />
                    </>
                  ) : (
                    <div
                      className={`target ${target.isHit ? 'hit' : ''} ${target.requiresDoubleClick ? 'double-click' : ''} ${target.clickCount === 1 ? 'first-click' : ''}`}
                      style={{
                        left: `${target.x}px`,
                        top: `${target.y}px`
                      }}
                      onClick={() => handleTargetClick(target.id)}
                    />
                  )}
                </div>
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
    </>
  )
}

export default App
