import { GoogleGenAI } from "@google/genai";

export enum UnitSystem {
  METRIC = 'metric',
  IMPERIAL = 'imperial'
}

export interface Dimensions {
  length: number; // stores meters internally
  height: number; // stores meters internally
  thickness: number; // stores meters internally
  unitSystem: UnitSystem;
  imperial: {
    lengthFt: number;
    lengthIn: number;
    heightFt: number;
    heightIn: number;
    thicknessIn: number;
  };
}

export interface BOQItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  description: string;
}

export interface ProjectSettings {
  plywoodWastage: number;
  concreteWastage: number;
  reinforcementRatio: number; // kg per m3
  dywiBarSpacing: number; // meters
}

export const DEFAULT_SETTINGS: ProjectSettings = {
  plywoodWastage: 20,
  concreteWastage: 5,
  reinforcementRatio: 120, // 120kg/m3 default
  dywiBarSpacing: 0.6, // 600mm
};

export interface SiteDocument {
  id: string;
  type: 'photo' | 'drawing';
  url: string;
  name: string;
  timestamp: number;
}

export type Language = 'en' | 'fr' | 'es' | 'it' | 'zh';
export type Currency = 'GBP' | 'USD' | 'AUD' | 'CNY';

export interface ProjectState {
  activeHub: 'formwork' | 'steel';
  language: Language;
  currency: Currency;
  name: string;
  location: string;
  dims: Dimensions;
  settings: ProjectSettings;
  unitCosts: Record<string, number>;
  documents: SiteDocument[];
}

export interface RebarScheduleItem {
  mark: string;
  typeSize: string; // e.g. H12
  count: number;
  length: number; // meters
  weightPerM: number;
  totalWeight: number; // tonnes
}

export interface SteelBOQ {
  tonnageByDiameter: Record<string, number>;
  totalTonnage: number;
  tyingWireRolls: number;
  spacers: number;
  wastageFactor: number;
}

export const UNIT_CONVERSIONS = {
  FT_TO_M: 0.3048,
  IN_TO_M: 0.0254,
  M_TO_FT: 3.28084,
  M_TO_IN: 39.3701,
};
