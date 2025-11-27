import { GRID_SIZE, ROW_LABELS, FLEET_CONFIG } from '../constants';
import { Cell, CellState, Coordinate, Grid, Orientation, PlacedShip, ShipType } from '../types';

// Utils
export const toBoardCoord = (row: number, col: number): string => {
  return `${ROW_LABELS[row]}${col}`;
};

export const fromBoardCoord = (coord: string): Coordinate | null => {
  if (!coord || coord.length < 2) return null;
  const rowChar = coord.charAt(0).toUpperCase();
  const colChar = coord.slice(1);
  
  const row = ROW_LABELS.indexOf(rowChar);
  const col = parseInt(colChar, 10);

  if (row === -1 || isNaN(col) || col < 0 || col >= GRID_SIZE) return null;
  return { row, col };
};

export const createEmptyGrid = (): Grid => {
  const grid: Grid = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < GRID_SIZE; c++) {
      row.push({ row: r, col: c, state: CellState.EMPTY });
    }
    grid.push(row);
  }
  return grid;
};

// Returns true if placement is valid (including spacing rules)
export const isValidPlacement = (
  grid: Grid,
  row: number,
  col: number,
  size: number,
  orientation: Orientation
): boolean => {
  // 1. Check bounds
  if (orientation === Orientation.HORIZONTAL) {
    if (col + size > GRID_SIZE) return false;
  } else {
    if (row + size > GRID_SIZE) return false;
  }

  // 2. Check collision and Spacing Rule (1 empty space between ships)
  // We check the ship's cells AND the surrounding halo
  const rStart = Math.max(0, row - 1);
  const rEnd = Math.min(GRID_SIZE - 1, (orientation === Orientation.VERTICAL ? row + size : row + 1));
  
  const cStart = Math.max(0, col - 1);
  const cEnd = Math.min(GRID_SIZE - 1, (orientation === Orientation.HORIZONTAL ? col + size : col + 1));

  for (let r = rStart; r <= rEnd; r++) {
    for (let c = cStart; c <= cEnd; c++) {
      if (grid[r][c].state !== CellState.EMPTY && grid[r][c].state !== CellState.RESTRICTED) {
        return false;
      }
    }
  }

  return true;
};

// Place ship and mark restricted halo
export const placeShipOnGrid = (
  currentGrid: Grid,
  currentShips: PlacedShip[],
  type: ShipType,
  row: number,
  col: number,
  size: number,
  orientation: Orientation
): { grid: Grid; ship: PlacedShip } => {
  // Deep copy grid to avoid mutation issues
  const newGrid = currentGrid.map(r => r.map(c => ({ ...c })));
  const coords: Coordinate[] = [];

  // Calculate coordinates
  for (let i = 0; i < size; i++) {
    if (orientation === Orientation.HORIZONTAL) {
      coords.push({ row, col: col + i });
    } else {
      coords.push({ row: row + i, col });
    }
  }

  const shipId = `${type}-${Date.now()}`;

  // Mark restricted zones (halo)
  // We mark everything in the bounding box as restricted first, then overwrite ship cells
  const rStart = Math.max(0, row - 1);
  const rEnd = Math.min(GRID_SIZE - 1, (orientation === Orientation.VERTICAL ? row + size : row + 1));
  const cStart = Math.max(0, col - 1);
  const cEnd = Math.min(GRID_SIZE - 1, (orientation === Orientation.HORIZONTAL ? col + size : col + 1));

  for (let r = rStart; r <= rEnd; r++) {
    for (let c = cStart; c <= cEnd; c++) {
      if (newGrid[r][c].state === CellState.EMPTY) {
        newGrid[r][c].state = CellState.RESTRICTED;
      }
    }
  }

  // Mark actual ship cells
  coords.forEach(c => {
    newGrid[c.row][c.col].state = CellState.SHIP;
    newGrid[c.row][c.col].shipId = shipId;
  });

  const newShip: PlacedShip = {
    id: shipId,
    type,
    orientation,
    coordinates: coords,
    hits: 0,
    sunk: false
  };

  return { grid: newGrid, ship: newShip };
};

// AI Logic: Random Placement with Retry
export const generateAiFleet = (fleetConfig: any[]): { grid: Grid; ships: PlacedShip[] } => {
  let grid = createEmptyGrid();
  let ships: PlacedShip[] = [];
  
  for (const shipConf of fleetConfig) {
    let placed = false;
    let attempts = 0;
    while (!placed && attempts < 1000) {
      const isVertical = Math.random() > 0.5;
      const orient = isVertical ? Orientation.VERTICAL : Orientation.HORIZONTAL;
      const r = Math.floor(Math.random() * GRID_SIZE);
      const c = Math.floor(Math.random() * GRID_SIZE);
      
      if (isValidPlacement(grid, r, c, shipConf.size, orient)) {
        const result = placeShipOnGrid(grid, ships, shipConf.name, r, c, shipConf.size, orient);
        grid = result.grid;
        ships.push(result.ship);
        placed = true;
      }
      attempts++;
    }
    if (!placed) {
      // If we fail, restart recursion (simple robust way)
      return generateAiFleet(fleetConfig);
    }
  }
  return { grid, ships };
};

// Check for hit
export const processShot = (
  grid: Grid,
  ships: PlacedShip[],
  target: Coordinate
): { result: 'hit' | 'miss' | 'duplicate'; shipSunk?: PlacedShip; allSunk: boolean } => {
  const cell = grid[target.row][target.col];
  
  if (cell.state === CellState.HIT || cell.state === CellState.MISS || cell.state === CellState.SUNK) {
    return { result: 'duplicate', allSunk: false };
  }

  if (cell.state === CellState.SHIP) {
    // HIT
    const ship = ships.find(s => s.id === cell.shipId);
    if (ship) {
      ship.hits++;
      cell.state = CellState.HIT;
      
      // Check sunk
      if (ship.hits >= ship.coordinates.length) {
        ship.sunk = true;
        // Mark all ship cells as SUNK for visual clarity
        ship.coordinates.forEach(c => {
          grid[c.row][c.col].state = CellState.SUNK;
        });
        
        const allSunk = ships.every(s => s.sunk);
        return { result: 'hit', shipSunk: ship, allSunk };
      }
      return { result: 'hit', allSunk: false };
    }
  }

  // MISS
  cell.state = CellState.MISS;
  return { result: 'miss', allSunk: false };
};

// --- Monte Carlo Probability Density AI ---

/**
 * Calculates the best move based on probability density of all valid ship placements
 * for the remaining enemy ships.
 */
export const getBestMove = (grid: Grid, remainingShipTypes: ShipType[]): Coordinate => {
  const density: number[][] = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0));
  
  // 1. Identify active hits (HIT cells that are not part of a sunk ship)
  // The 'SUNK' state handles sunk ships, so 'HIT' strictly means "hit but still afloat"
  const activeHits: Coordinate[] = [];
  grid.forEach(row => row.forEach(cell => {
    if (cell.state === CellState.HIT) activeHits.push({ row: cell.row, col: cell.col });
  }));

  // HUNT mode is active if we have unexplained hits
  const mode = activeHits.length > 0 ? 'HUNT' : 'SEARCH';
  const validConfigs = FLEET_CONFIG.filter(config => remainingShipTypes.includes(config.name));

  // 2. Iterate through all remaining ships and all possible positions
  validConfigs.forEach(shipConfig => {
    [Orientation.HORIZONTAL, Orientation.VERTICAL].forEach(orientation => {
      
      // Try every cell as a starting point
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          
          const placementCoords: Coordinate[] = [];
          for (let i = 0; i < shipConfig.size; i++) {
             if (orientation === Orientation.HORIZONTAL) placementCoords.push({ row: r, col: c + i });
             else placementCoords.push({ row: r + i, col: c });
          }

          // Boundary Check
          const outOfBounds = placementCoords.some(coord => coord.row >= GRID_SIZE || coord.col >= GRID_SIZE);
          if (outOfBounds) continue;

          // Validity Check (Board State & Spacing Rules)
          let isValid = true;
          let hitsCovered = 0;

          for (const p of placementCoords) {
             const cell = grid[p.row][p.col];
             
             // Invalid if it sits on a known MISS or a known SUNK ship
             if (cell.state === CellState.MISS || cell.state === CellState.SUNK) {
               isValid = false; 
               break;
             }
             
             // Count how many active hits this placement explains
             if (cell.state === CellState.HIT) hitsCovered++;

             // SPACING RULE: Check neighbors for SUNK cells
             // We only check against SUNK cells because we know those are definitely other ships.
             // We don't check against HIT/EMPTY/RESTRICTED/SHIP because those could be valid targets or unknown.
             const neighbors = [
               {r: p.row-1, c: p.col}, {r: p.row+1, c: p.col},
               {r: p.row, c: p.col-1}, {r: p.row, c: p.col+1},
               {r: p.row-1, c: p.col-1}, {r: p.row-1, c: p.col+1},
               {r: p.row+1, c: p.col-1}, {r: p.row+1, c: p.col+1}
             ];
             for (const n of neighbors) {
               if (n.r >= 0 && n.r < GRID_SIZE && n.c >= 0 && n.c < GRID_SIZE) {
                 if (grid[n.r][n.c].state === CellState.SUNK) {
                   isValid = false; // Too close to a sunk ship (violation of 1-cell spacing)
                   break;
                 }
               }
             }
             if (!isValid) break;
          }

          if (!isValid) continue;

          // Weight Calculation
          let weight = 1;
          
          if (mode === 'HUNT') {
            // In Hunt mode, placements that explain existing hits are weighted massively higher
            if (hitsCovered > 0) {
              weight = 1000 + (hitsCovered * 100);
            } else {
              // Valid placement but doesn't explain current hits. Low priority.
              weight = 1; 
            }
          }

          // Add density to the grid
          placementCoords.forEach(p => {
             const st = grid[p.row][p.col].state;
             // Only add density to targetable cells (not already HIT, SUNK, or MISS)
             // We treat EMPTY, RESTRICTED, and SHIP (which AI sees as hidden) as valid targets
             if (st !== CellState.HIT && st !== CellState.SUNK && st !== CellState.MISS) {
               density[p.row][p.col] += weight;
             }
          });
        }
      }
    });
  });

  // 3. Find the cell with the maximum probability density
  let bestScore = -1;
  const candidates: Coordinate[] = [];
  
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (density[r][c] > bestScore) {
        bestScore = density[r][c];
        candidates.length = 0; // Clear previous candidates
        candidates.push({ row: r, col: c });
      } else if (density[r][c] === bestScore && bestScore > 0) {
        candidates.push({ row: r, col: c });
      }
    }
  }

  // Fallback: Random valid shot (only if map is empty/bugged)
  if (candidates.length === 0) {
      let r, c;
      let attempts = 0;
      do {
          r = Math.floor(Math.random()*GRID_SIZE);
          c = Math.floor(Math.random()*GRID_SIZE);
          attempts++;
      } while(
        (grid[r][c].state === CellState.HIT || 
         grid[r][c].state === CellState.MISS || 
         grid[r][c].state === CellState.SUNK) && attempts < 100
      );
      return { row: r, col: c };
  }

  // Randomly select one of the best candidates (to avoid predictable patterns if density is equal)
  return candidates[Math.floor(Math.random() * candidates.length)];
};