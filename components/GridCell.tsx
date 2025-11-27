import React from 'react';
import { Cell, CellState } from '../types';

interface GridCellProps {
  cell: Cell;
  onClick: () => void;
  isEnemyBoard?: boolean;
  disabled?: boolean;
  preview?: boolean; // For placement hover
  previewValid?: boolean;
}

const GridCell: React.FC<GridCellProps> = ({ 
  cell, 
  onClick, 
  isEnemyBoard = false, 
  disabled = false,
  preview = false,
  previewValid = true
}) => {
  
  let bgColor = 'bg-white';
  let content = null;
  let borderColor = 'border-gray-200';
  let animationClass = '';

  // Base state styles
  if (cell.state === CellState.EMPTY || cell.state === CellState.RESTRICTED) {
    bgColor = 'bg-white hover:bg-gray-50';
  } else if (cell.state === CellState.SHIP) {
    // Hide ships on enemy board
    bgColor = isEnemyBoard ? 'bg-white hover:bg-gray-50' : 'bg-siemens-dark animate-pop-in';
  } else if (cell.state === CellState.MISS) {
    bgColor = 'bg-blue-50';
    // Interactive splash animation for miss
    content = (
      <>
        <div className="absolute inset-0 rounded-full bg-blue-400 animate-splash opacity-0 pointer-events-none"></div>
        <div className="w-2 h-2 rounded-full bg-blue-300 animate-pop-in" />
      </>
    );
  } else if (cell.state === CellState.HIT) {
    bgColor = 'bg-orange-100';
    // Interactive explosion/pulse animation for hit
    content = (
      <div className="w-full h-full p-1 relative">
        <div className="absolute inset-0 bg-siemens-orange rounded-full animate-ping opacity-75"></div>
        <div className="relative w-full h-full rounded-full bg-siemens-orange animate-pulse" />
      </div>
    );
  } else if (cell.state === CellState.SUNK) {
    bgColor = 'bg-red-50';
    borderColor = 'border-red-200';
    // Visual mark for sunk
    content = <div className="text-xs font-bold text-red-600 flex items-center justify-center w-full h-full animate-pop-in">X</div>;
  }

  // Preview Overrides (only valid for friendly placement)
  if (preview && !isEnemyBoard) {
    bgColor = previewValid ? 'bg-green-200' : 'bg-red-200';
    // Add subtle scale for placement feel
    animationClass = 'scale-95';
  }

  return (
    <div
      onClick={!disabled ? onClick : undefined}
      className={`
        w-full h-full aspect-square border ${borderColor} 
        flex items-center justify-center relative overflow-hidden
        transition-all duration-150 cursor-pointer
        ${disabled ? 'cursor-not-allowed opacity-90' : ''}
        ${bgColor}
        ${animationClass}
      `}
    >
      {content}
    </div>
  );
};

export default GridCell;