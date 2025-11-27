import React, { useState, useEffect, useRef } from 'react';
import { GamePhase, ShipType, Orientation, Grid, PlacedShip, ShipConfig, GameStateData, CellState } from './types';
import { createEmptyGrid, placeShipOnGrid, generateAiFleet, processShot, toBoardCoord, fromBoardCoord, getBestMove } from './services/gameLogic';
import { FLEET_CONFIG, COLORS, MOCK_GAME_ID } from './constants';
import GameBoard from './components/GameBoard';
import ShipSelector from './components/ShipSelector';

// --- Main App Component ---
function App() {
  // --- State ---
  const [phase, setPhase] = useState<GamePhase>(GamePhase.WELCOME);
  const [turnCount, setTurnCount] = useState(0);
  
  // Player Data
  const [myGrid, setMyGrid] = useState<Grid>(createEmptyGrid());
  const [myShips, setMyShips] = useState<PlacedShip[]>([]);
  const [placedShipsCount, setPlacedShipsCount] = useState<Record<ShipType, number>>({
    [ShipType.CARRIER]: 0,
    [ShipType.BATTLESHIP]: 0,
    [ShipType.CRUISER]: 0,
    [ShipType.SUBMARINE]: 0,
    [ShipType.DESTROYER]: 0
  });

  // Placement State
  const [selectedShipType, setSelectedShipType] = useState<ShipType | null>(ShipType.CARRIER);
  const [orientation, setOrientation] = useState<Orientation>(Orientation.HORIZONTAL);

  // AI/Opponent Data
  const [enemyGrid, setEnemyGrid] = useState<Grid>(createEmptyGrid());
  const [enemyShips, setEnemyShips] = useState<PlacedShip[]>([]);

  // Gameplay State
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [gameLogs, setGameLogs] = useState<string[]>([]);
  const [gameResult, setGameResult] = useState<'WIN' | 'LOSE' | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameLogs]);

  // --- Helpers for Stats ---
  const calculateStats = (grid: Grid, ships: PlacedShip[]) => {
    let hits = 0;
    let misses = 0;
    let sunkShips = 0;

    grid.forEach(row => {
      row.forEach(cell => {
        if (cell.state === CellState.HIT || cell.state === CellState.SUNK) {
          hits++;
        } else if (cell.state === CellState.MISS) {
          misses++;
        }
      });
    });

    sunkShips = ships.filter(s => s.sunk).length;

    return {
      hits,
      misses,
      totalShots: hits + misses,
      sunkShips,
      accuracy: (hits + misses) > 0 ? Math.round((hits / (hits + misses)) * 100) : 0
    };
  };

  const addLog = (msg: string) => {
    setGameLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const resetGame = () => {
    setMyGrid(createEmptyGrid());
    setMyShips([]);
    setPlacedShipsCount({
      [ShipType.CARRIER]: 0,
      [ShipType.BATTLESHIP]: 0,
      [ShipType.CRUISER]: 0,
      [ShipType.SUBMARINE]: 0,
      [ShipType.DESTROYER]: 0
    });
    setEnemyGrid(createEmptyGrid());
    setEnemyShips([]);
    setGameLogs([]);
    setTurnCount(0);
    setGameResult(null);
    setSelectedShipType(ShipType.CARRIER);
    setPhase(GamePhase.WELCOME);
  };

  const handleShipPlacement = (r: number, c: number) => {
    if (phase !== GamePhase.PLACEMENT || !selectedShipType) return;
    
    const shipConfig = FLEET_CONFIG.find(s => s.name === selectedShipType);
    if (!shipConfig) return;

    import('./services/gameLogic').then(({ isValidPlacement, placeShipOnGrid }) => {
      if (isValidPlacement(myGrid, r, c, shipConfig.size, orientation)) {
        const { grid, ship } = placeShipOnGrid(myGrid, myShips, selectedShipType, r, c, shipConfig.size, orientation);
        setMyGrid(grid);
        setMyShips([...myShips, ship]);
        setPlacedShipsCount(prev => ({ ...prev, [selectedShipType]: 1 }));
        setSelectedShipType(null); // Deselect after placement
        addLog(`Placed ${selectedShipType} at ${toBoardCoord(r, c)}`);
      } else {
        addLog(`Cannot place ship there. Check bounds and 1-cell spacing rule.`);
      }
    });
  };

  const startGame = () => {
    // 1. Generate AI Fleet
    const { grid: aiGrid, ships: aiShips } = generateAiFleet(FLEET_CONFIG);
    setEnemyGrid(aiGrid);
    setEnemyShips(aiShips);

    // 2. Decide Start (Simulated Server Matchmaking)
    const playerStarts = Math.random() > 0.5;
    setIsMyTurn(playerStarts);
    setPhase(GamePhase.PLAYING);
    
    addLog("--- Game Started ---");
    addLog(`Joined Game ID: ${MOCK_GAME_ID}`);
    addLog(playerStarts ? "You start first!" : "Opponent starts first.");

    if (!playerStarts) {
      setTimeout(aiTurn, 1500);
    }
  };

  const handlePlayerShoot = (r: number, c: number) => {
    if (phase !== GamePhase.PLAYING || !isMyTurn) return;

    const { result, shipSunk, allSunk } = processShot(enemyGrid, enemyShips, { row: r, col: c });

    if (result === 'duplicate') {
      addLog("You already shot there!");
      return;
    }

    // Update Grid State (React needs new reference)
    setEnemyGrid([...enemyGrid]); 
    
    const coordStr = toBoardCoord(r, c);
    if (result === 'hit') {
      addLog(`You shot at ${coordStr}: HIT!`);
      if (shipSunk) addLog(`You SUNK the enemy ${shipSunk.type}!`);
      if (allSunk) {
        setGameResult('WIN');
        setPhase(GamePhase.GAME_OVER);
        addLog("CONGRATULATIONS! You destroyed all enemy ships.");
        return;
      }
      // Rule: "A hit allows the player to continue shooting"
      addLog("Hit! Take another shot.");
    } else {
      addLog(`You shot at ${coordStr}: MISS.`);
      setIsMyTurn(false);
      setTimeout(aiTurn, 1500);
    }
  };

  const aiTurn = () => {
    // --- Monte Carlo / Probability Density Strategy ---
    
    // 1. Identify remaining target ship types
    const remainingTargetTypes = myShips
      .filter(s => !s.sunk)
      .map(s => s.type);

    // 2. Fallback if list is empty
    const targets = remainingTargetTypes.length > 0 ? remainingTargetTypes : Object.values(ShipType);

    // 3. Get best statistical move
    const { row: r, col: c } = getBestMove(myGrid, targets);

    const { result, shipSunk, allSunk } = processShot(myGrid, myShips, { row: r, col: c });
    setMyGrid([...myGrid]);

    const coordStr = toBoardCoord(r, c);
    
    if (result === 'hit') {
      addLog(`Opponent shot at ${coordStr}: HIT!`);
      if (shipSunk) addLog(`Your ${shipSunk.type} has been sunk!`);
      
      if (allSunk) {
        setGameResult('LOSE');
        setPhase(GamePhase.GAME_OVER);
        addLog("GAME OVER. All your ships are destroyed.");
        return;
      }
      // AI shoots again
      setTimeout(aiTurn, 1500);
    } else {
      addLog(`Opponent shot at ${coordStr}: MISS.`);
      setIsMyTurn(true);
      addLog("Your turn.");
    }
  };

  // --- Render Helpers ---

  const renderWelcome = () => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 animate-pop-in">
      <div className="text-center space-y-4 max-w-2xl">
        <h2 className="text-3xl font-bold text-siemens-dark">Welcome to the Battle of Brains</h2>
        <p className="text-gray-600 text-lg">
          Position your fleet strategically and compete against our AI in this Siemens Healthineers edition Battleship game.
          Follow the rules strictly: ships cannot overlap or touch (1-cell spacing required).
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
        <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-siemens-orange hover:shadow-lg transition-shadow">
          <h3 className="text-xl font-bold text-siemens-dark mb-2">Single Player</h3>
          <p className="text-gray-500 mb-6">Train against the Server AI (Monte Carlo Strategy). Perfect for testing your strategy.</p>
          <button 
            onClick={() => setPhase(GamePhase.PLACEMENT)}
            className="w-full py-3 bg-siemens-orange text-white font-bold rounded-lg hover:bg-orange-700 transition-colors transform hover:scale-[1.02]"
          >
            Start Mission
          </button>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-gray-300 opacity-60 cursor-not-allowed">
          <h3 className="text-xl font-bold text-siemens-dark mb-2">Multiplayer</h3>
          <p className="text-gray-500 mb-6">Compete against other teams via API. (Currently simulating Server Mode)</p>
          <button disabled className="w-full py-3 bg-gray-200 text-gray-400 font-bold rounded-lg cursor-not-allowed">
            Connecting...
          </button>
        </div>
      </div>
    </div>
  );

  const renderPlacement = () => {
    const allPlaced = FLEET_CONFIG.every(s => placedShipsCount[s.name] >= 1);
    
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full max-w-6xl mx-auto animate-pop-in">
        {/* Left: Ship Selection */}
        <div className="space-y-6">
          <ShipSelector 
            fleet={FLEET_CONFIG}
            selectedShip={selectedShipType}
            placedShipsCount={placedShipsCount}
            onSelect={setSelectedShipType}
            orientation={orientation}
            toggleOrientation={() => setOrientation(prev => prev === Orientation.HORIZONTAL ? Orientation.VERTICAL : Orientation.HORIZONTAL)}
          />
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-blue-800">
            <strong>Rule:</strong> Ships must have at least one empty grid space between them (including diagonals).
          </div>
        </div>

        {/* Center: Board */}
        <div className="lg:col-span-2 flex flex-col items-center">
          <h2 className="text-2xl font-bold text-siemens-dark mb-6">Deploy Your Fleet</h2>
          <GameBoard 
            grid={myGrid} 
            onCellClick={(r, c) => handleShipPlacement(r, c)}
            placementMode={true}
            placingShipSize={selectedShipType ? FLEET_CONFIG.find(s => s.name === selectedShipType)?.size || 0 : 0}
            placementOrientation={orientation}
            activeShipType={selectedShipType}
          />
          
          <div className="mt-8 flex gap-4">
            <button 
              onClick={resetGame}
              className="px-6 py-2 text-gray-500 hover:text-red-600 font-semibold transition-colors"
            >
              Reset Board
            </button>
            <button 
              onClick={startGame}
              disabled={!allPlaced}
              className={`
                px-8 py-3 rounded-lg font-bold shadow-md transition-all
                ${allPlaced 
                  ? 'bg-siemens-orange text-white hover:bg-orange-700 transform hover:-translate-y-0.5' 
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }
              `}
            >
              Confirm Deployment
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderPlaying = () => (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-8 animate-pop-in">
      {/* HUD */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-siemens-orange text-white px-3 py-1 rounded text-sm font-bold">GAME ID: {MOCK_GAME_ID}</div>
          <div className={`px-4 py-1 rounded-full text-sm font-bold flex items-center gap-2 ${isMyTurn ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            <span className={`w-2 h-2 rounded-full ${isMyTurn ? 'bg-green-600 animate-pulse' : 'bg-red-600'}`}></span>
            {isMyTurn ? "YOUR TURN" : "OPPONENT'S TURN"}
          </div>
        </div>
        <button onClick={resetGame} className="text-sm text-red-500 hover:underline">Surrender / Cancel</button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
        {/* Enemy Board */}
        <div className="flex flex-col items-center">
          <h3 className="text-lg font-bold text-siemens-dark mb-2 flex items-center gap-2">
            <span>📡 Enemy Waters</span>
            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-500">CLICK TO SHOOT</span>
          </h3>
          <div className={`transition-opacity duration-300 ${!isMyTurn ? 'opacity-75 pointer-events-none grayscale-[0.5]' : ''}`}>
             <GameBoard 
              grid={enemyGrid} 
              isEnemy={true} 
              onCellClick={handlePlayerShoot} 
            />
          </div>
        </div>

        {/* Friendly Board */}
        <div className="flex flex-col items-center">
          <h3 className="text-lg font-bold text-siemens-dark mb-2">🛡️ Your Fleet</h3>
          <GameBoard 
            grid={myGrid} 
            isEnemy={false} 
            onCellClick={() => {}} 
          />
        </div>
      </div>

      {/* Logs */}
      <div className="bg-siemens-stone rounded-lg p-4 border border-gray-200 h-48 overflow-y-auto font-mono text-sm">
        {gameLogs.length === 0 && <span className="text-gray-400 italic">Game logs will appear here...</span>}
        {gameLogs.map((log, i) => (
          <div key={i} className="mb-1 border-b border-gray-200 last:border-0 pb-1 text-siemens-text">
            {log}
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>
    </div>
  );

  const renderGameOver = () => {
    const playerStats = calculateStats(enemyGrid, enemyShips);
    const aiStats = calculateStats(myGrid, myShips);

    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-8 animate-pop-in">
        {/* Header Result */}
        <div className="text-center">
          <div className={`text-6xl mb-4 ${gameResult === 'WIN' ? 'animate-bounce' : 'animate-shake'}`}>
            {gameResult === 'WIN' ? '🏆' : '💀'}
          </div>
          <h2 className={`text-5xl font-bold ${gameResult === 'WIN' ? 'text-siemens-orange' : 'text-gray-700'}`}>
            {gameResult === 'WIN' ? 'MISSION ACCOMPLISHED' : 'MISSION FAILED'}
          </h2>
          <p className="text-xl text-gray-500 mt-2">
            {gameResult === 'WIN' 
              ? "You have successfully neutralized the enemy fleet." 
              : "Your fleet was compromised. The AI strategy was superior."}
          </p>
        </div>

        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
          {/* Player Card */}
          <div className={`bg-white rounded-xl shadow-lg border-t-8 ${gameResult === 'WIN' ? 'border-siemens-orange' : 'border-gray-300'} p-6`}>
            <h3 className="text-2xl font-bold text-siemens-dark mb-4 border-b pb-2">Your Performance</h3>
            <div className="space-y-4">
               <div className="flex justify-between items-center">
                  <span className="text-gray-500">Ships Sunk</span>
                  <span className="text-xl font-bold text-siemens-orange">{playerStats.sunkShips} / 5</span>
               </div>
               <div className="flex justify-between items-center">
                  <span className="text-gray-500">Accuracy</span>
                  <span className="text-xl font-bold text-siemens-dark">{playerStats.accuracy}%</span>
               </div>
               <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                  <div className="bg-gray-50 p-2 rounded">
                    <div className="text-xs text-gray-400 uppercase">Shots</div>
                    <div className="font-bold">{playerStats.totalShots}</div>
                  </div>
                  <div className="bg-green-50 p-2 rounded">
                    <div className="text-xs text-green-600 uppercase">Hits</div>
                    <div className="font-bold text-green-700">{playerStats.hits}</div>
                  </div>
                  <div className="bg-red-50 p-2 rounded">
                    <div className="text-xs text-red-600 uppercase">Misses</div>
                    <div className="font-bold text-red-700">{playerStats.misses}</div>
                  </div>
               </div>
            </div>
          </div>

          {/* AI Card */}
          <div className={`bg-white rounded-xl shadow-lg border-t-8 ${gameResult === 'LOSE' ? 'border-red-500' : 'border-gray-300'} p-6`}>
            <h3 className="text-2xl font-bold text-siemens-dark mb-4 border-b pb-2">AI Performance</h3>
            <div className="space-y-4">
               <div className="flex justify-between items-center">
                  <span className="text-gray-500">Ships Sunk</span>
                  <span className="text-xl font-bold text-gray-800">{aiStats.sunkShips} / 5</span>
               </div>
               <div className="flex justify-between items-center">
                  <span className="text-gray-500">Accuracy</span>
                  <span className="text-xl font-bold text-siemens-dark">{aiStats.accuracy}%</span>
               </div>
               <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                  <div className="bg-gray-50 p-2 rounded">
                    <div className="text-xs text-gray-400 uppercase">Shots</div>
                    <div className="font-bold">{aiStats.totalShots}</div>
                  </div>
                  <div className="bg-green-50 p-2 rounded">
                    <div className="text-xs text-green-600 uppercase">Hits</div>
                    <div className="font-bold text-green-700">{aiStats.hits}</div>
                  </div>
                  <div className="bg-red-50 p-2 rounded">
                    <div className="text-xs text-red-600 uppercase">Misses</div>
                    <div className="font-bold text-red-700">{aiStats.misses}</div>
                  </div>
               </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4 mt-8">
          <button 
            onClick={resetGame}
            className="px-8 py-4 bg-siemens-orange text-white font-bold text-lg rounded-lg hover:bg-orange-700 transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-1"
          >
            Start New Mission
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 font-sans text-siemens-text">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* BRAND COLOR UPDATE: Siemens Petrol for 'SIEMENS', Orange for 'Healthineers' */}
            <span className="text-siemens-petrol font-bold text-2xl tracking-tight">SIEMENS</span>
            <span className="text-siemens-orange font-medium text-lg border-l border-gray-300 pl-2 ml-2">Healthineers</span>
          </div>
          <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider hidden sm:block">
            Battle of Brains
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow p-4 md:p-8">
        {phase === GamePhase.WELCOME && renderWelcome()}
        {phase === GamePhase.PLACEMENT && renderPlacement()}
        {phase === GamePhase.PLAYING && renderPlaying()}
        {phase === GamePhase.GAME_OVER && renderGameOver()}
      </main>

      {/* Footer */}
      <footer className="bg-siemens-stone py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-gray-500">
          <p>© 2025 Siemens Healthineers AG. Battle of Brains Initiative.</p>
          <p className="mt-1">Developed for the Internal Company Challenge.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;