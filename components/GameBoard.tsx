import React, { useState } from 'react';
import { GRID_SIZE, COL_LABELS, ROW_LABELS } from '../constants';
import { Cell, Grid, Orientation, ShipType } from '../types';
import GridCell from './GridCell';
import { isValidPlacement } from '../services/gameLogic';

interface GameBoardProps {
  grid: Grid;
  isEnemy?: boolean;
  onCellClick: (row: number, col: number) => void;
  // Placement props
  placementMode?: boolean;
  placingShipSize?: number;
  placementOrientation?: Orientation;
  activeShipType?: ShipType | null;
}

const GameBoard: React.FC<GameBoardProps> = ({
  grid,
  isEnemy = false,
  onCellClick,
  placementMode = false,
  placingShipSize = 0,
  placementOrientation = Orientation.HORIZONTAL,
  activeShipType = null
}) => {
  const [hoverCoord, setHoverCoord] = useState<{ r: number, c: number } | null>(null);

  const getPreviewState = (r: number, c: number) => {
    if (!placementMode || !hoverCoord || !activeShipType) return { isPreview: false, isValid: false };

    // Calculate ships cells based on hover
    const shipCells = [];
    for (let i = 0; i < placingShipSize; i++) {
      if (placementOrientation === Orientation.HORIZONTAL) {
        shipCells.push({ r: hoverCoord.r, c: hoverCoord.c + i });
      } else {
        shipCells.push({ r: hoverCoord.r + i, c: hoverCoord.c });
      }
    }

    // Check if current cell is part of the ship being hovered
    const isCellInShip = shipCells.some(cell => cell.r === r && cell.c === c);

    if (isCellInShip) {
      const valid = isValidPlacement(grid, hoverCoord.r, hoverCoord.c, placingShipSize, placementOrientation);
      return { isPreview: true, isValid: valid };
    }

    return { isPreview: false, isValid: false };
  };

  return (
    <div className="inline-block bg-white p-4 rounded-xl shadow-lg border border-gray-100">
      {/* Header Row (Numbers) */}
      <div className="flex mb-2">
        <div className="w-8 h-8 mr-1"></div> {/* Corner spacer */}
        {COL_LABELS.map(label => (
          <div key={label} className="w-8 h-8 flex items-center justify-center font-bold text-siemens-orange text-sm">
            {label}
          </div>
        ))}
      </div>

      {/* Grid Rows */}
      {grid.map((row, rIndex) => (
        <div key={rIndex} className="flex mb-1 last:mb-0">
          {/* Row Label (Letters) */}
          <div className="w-8 h-8 flex items-center justify-center font-bold text-siemens-orange text-sm mr-1">
            {ROW_LABELS[rIndex]}
          </div>

          {/* Cells */}
          {row.map((cell, cIndex) => {
            const { isPreview, isValid } = getPreviewState(rIndex, cIndex);
            
            return (
              <div 
                key={`${rIndex}-${cIndex}`} 
                className="w-8 h-8 mr-1 last:mr-0"
                onMouseEnter={() => placementMode && setHoverCoord({ r: rIndex, c: cIndex })}
                onMouseLeave={() => placementMode && setHoverCoord(null)}
              >
                <GridCell
                  cell={cell}
                  onClick={() => onCellClick(rIndex, cIndex)}
                  isEnemyBoard={isEnemy}
                  preview={isPreview}
                  previewValid={isValid}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default GameBoard;
