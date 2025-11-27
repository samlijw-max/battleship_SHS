// Game Enums
export enum GamePhase {
  WELCOME = 'WELCOME',
  PLACEMENT = 'PLACEMENT',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER'
}

export enum PlayerType {
  HUMAN = 'HUMAN',
  AI = 'AI'
}

export enum ShipType {
  CARRIER = 'Carrier',
  BATTLESHIP = 'Battleship',
  CRUISER = 'Cruiser',
  SUBMARINE = 'Submarine',
  DESTROYER = 'Destroyer'
}

export enum Orientation {
  HORIZONTAL = 'HORIZONTAL',
  VERTICAL = 'VERTICAL'
}

export enum CellState {
  EMPTY = 'EMPTY',
  SHIP = 'SHIP',
  HIT = 'HIT',
  MISS = 'MISS',
  SUNK = 'SUNK',
  RESTRICTED = 'RESTRICTED' // Halo around ships
}

// Interfaces
export interface ShipConfig {
  name: ShipType;
  size: number;
  count: number;
}

export interface Coordinate {
  row: number; // 0-9 (A-J)
  col: number; // 0-9
}

export interface PlacedShip {
  id: string;
  type: ShipType;
  orientation: Orientation;
  coordinates: Coordinate[];
  hits: number;
  sunk: boolean;
}

export interface Cell {
  row: number;
  col: number;
  state: CellState;
  shipId?: string;
}

export type Grid = Cell[][];

// API-like Structures (as per PDF)
export interface PlayField {
  [key: string]: string[]; // "Carrier": ["A1", "A2", ...]
}

export interface JoinRequest {
  playerID: string;
  playField: any; // Using looser type to match PDF example structure if needed, but we will map internally
  multiplayer: boolean;
  tournament: boolean;
  endpoint: string;
}

export interface ShootResponse {
  hit: boolean;
  sunk: boolean;
  end: boolean;
  gameID: string;
}

export interface GameStateData {
  gameID: string;
  gameState: 'playing' | 'finished' | 'canceled';
  opponent: string;
  yourTurn: boolean;
  winner?: boolean;
  message?: string;
}
