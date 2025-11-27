import React from 'react';
import { ShipConfig, ShipType } from '../types';

interface ShipSelectorProps {
  fleet: ShipConfig[];
  selectedShip: ShipType | null;
  placedShipsCount: Record<ShipType, number>;
  onSelect: (ship: ShipType) => void;
  orientation: 'HORIZONTAL' | 'VERTICAL';
  toggleOrientation: () => void;
}

const ShipSelector: React.FC<ShipSelectorProps> = ({
  fleet,
  selectedShip,
  placedShipsCount,
  onSelect,
  orientation,
  toggleOrientation
}) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <h3 className="text-lg font-bold text-siemens-dark mb-4">1. Select Ship</h3>
      <div className="space-y-3">
        {fleet.map((ship) => {
          const isPlaced = placedShipsCount[ship.name] >= ship.count;
          const isSelected = selectedShip === ship.name;
          
          return (
            <button
              key={ship.name}
              onClick={() => !isPlaced && onSelect(ship.name)}
              disabled={isPlaced}
              className={`
                w-full flex items-center justify-between p-3 rounded border transition-all
                ${isPlaced 
                  ? 'bg-gray-100 text-gray-400 border-gray-100 cursor-default' 
                  : isSelected 
                    ? 'bg-orange-50 border-siemens-orange text-siemens-orange ring-1 ring-siemens-orange' 
                    : 'bg-white border-gray-200 hover:border-siemens-orange text-siemens-dark'
                }
              `}
            >
              <span className="font-medium">{ship.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                  {Array(ship.size).fill('■').join('')}
                </span>
                {isPlaced && <span className="text-green-600 text-xs font-bold">✓</span>}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 pt-4 border-t border-gray-100">
        <h3 className="text-lg font-bold text-siemens-dark mb-4">2. Orientation</h3>
        <button
          onClick={toggleOrientation}
          className="w-full py-3 px-4 bg-siemens-stone hover:bg-gray-200 text-siemens-dark font-semibold rounded flex items-center justify-center gap-2 transition-colors"
        >
          <svg className={`w-5 h-5 transition-transform ${orientation === 'VERTICAL' ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
          {orientation}
        </button>
        <p className="text-xs text-gray-500 mt-2 text-center">
          Click board to place. Must have 1 cell spacing.
        </p>
      </div>
    </div>
  );
};

export default ShipSelector;
