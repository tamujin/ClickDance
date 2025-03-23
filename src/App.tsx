import { useState, useEffect, useRef } from 'react'
import './App.css'

interface Target {
  id: number;
  x: number;
  y: number;
}

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
  const canvasRef = useRef<HTMLDivElement>(null)

  const generateTarget = () => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const canvasRect = canvas.getBoundingClientRect();
    const targetSize = Math.min(50, window.innerWidth * 0.06); // 50px or 6vw
    const margin = targetSize / 2;

    // Generate random position within the canvas (accounting for target size)
    const x = Math.random() * (canvasRect.width - targetSize) + margin;
    const y = Math.random() * (canvasRect.height - targetSize) + margin;
    
    const newTarget: Target = {
      id: Date.now(),
      x,
      y,
    }
    
    setTargets(prev => [...prev, newTarget])
  }

  const handleTargetClick = (targetId: number) => {
    setTargets(prev => prev.filter(target => target.id !== targetId))
    setScore(prev => prev + 1)
  }

  const startGame = () => {
    setIsGameStarted(true)
    setScore(0)
    // Generate first target
    generateTarget()
  }

  const stopGame = () => {
    setIsGameStarted(false)
    setTargets([])
    setScore(0)
  }

  // When a target is clicked, generate a new one
  useEffect(() => {
    if (isGameStarted && targets.length === 0) {
      generateTarget()
    }
  }, [targets, isGameStarted])

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (isGameStarted) {
        setTargets([]); // Clear targets
        generateTarget(); // Generate new target with updated dimensions
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isGameStarted]);

  return (
    <>
      <div className="gradient-overlay"></div>
      <div className="app-container">
        <h1>ClickDance</h1>
        <div className="game-area">
          <div className="settings-panel">
            <label htmlFor="cursor-select">Select Cursor: </label>
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
          
          {!isGameStarted ? (
            <button onClick={startGame} className="start-button">
              Start Game
            </button>
          ) : (
            <div className="play-area">
              <div className="game-stats">
                <button onClick={stopGame} className="stop-button">
                  Stop Game
                </button>
                <div className="score">Score: {score}</div>
              </div>
              <div 
                ref={canvasRef}
                className="game-canvas"
                style={{ cursor: selectedCursor }}
              >
                {targets.map(target => (
                  <div
                    key={target.id}
                    className="target"
                    style={{
                      left: `${target.x}px`,
                      top: `${target.y}px`
                    }}
                    onClick={() => handleTargetClick(target.id)}
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
