
export interface User {
  email: string;
  name: string;
  loginCount: number;
  lastLogin: string;
}

export interface RedoxElement {
  id: string; // unique id to distinguish same elements in different compounds
  symbol: string;
  compound: string;
  side: 'left' | 'right';
  oxidationState: number;
  isChanging: boolean;
}

export interface RedoxStepData {
  originalEquation: string;
  compoundsLeft: string[];
  compoundsRight: string[];
  elementsChanging: {
    symbol: string;
    leftState: number;
    rightState: number;
    compoundLeft: string;
    compoundRight: string;
  }[];
  reducingAgent: string;
  oxidizingAgent: string;
  oxidationProcess: string; // e.g. "Fe -> Fe+3 + 3e"
  reductionProcess: string; // e.g. "S+6 + 2e -> S+4"
  multiplierOx: number;
  multiplierRed: number;
  balancedCoefficients: number[]; // In order of compounds in equation
}

export type Step = 1 | 2 | 3 | 4;
