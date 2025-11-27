import { ShipConfig, ShipType } from './types';

export const GRID_SIZE = 10;
export const ROW_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
export const COL_LABELS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

// Fleet definition from PDF Page 6
export const FLEET_CONFIG: ShipConfig[] = [
  { name: ShipType.CARRIER, size: 5, count: 1 },
  { name: ShipType.BATTLESHIP, size: 4, count: 1 },
  { name: ShipType.CRUISER, size: 3, count: 1 },
  { name: ShipType.SUBMARINE, size: 3, count: 1 },
  { name: ShipType.DESTROYER, size: 2, count: 1 },
];

export const MOCK_PLAYER_ID = "b7o1cafe2168761022a23717f053af74";
export const MOCK_GAME_ID = "Game0000476";

// Siemens Brand Colors mapped to hex for canvas/js usage if needed
export const COLORS = {
  orange: '#ec6602',
  dark: '#002830',
  stone: '#eef1f3',
  white: '#ffffff',
  error: '#dc2626',
  success: '#16a34a'
};
