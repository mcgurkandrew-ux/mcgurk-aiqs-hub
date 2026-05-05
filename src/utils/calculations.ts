import { Dimensions, BOQItem, ProjectSettings, UnitSystem, UNIT_CONVERSIONS } from '../types';

export const convertToMetric = (
  ft: number, 
  inch: number
): number => {
  return (ft * UNIT_CONVERSIONS.FT_TO_M) + (inch * UNIT_CONVERSIONS.IN_TO_M);
};

export const parseFeetInches = (str: string): { ft: number, in: number } | null => {
  // Matches 50' 6", 50'6, 50ft 6in, 50 6 etc.
  const regex = /^(\d+)'?\s*(\d*)"?$/;
  const match = str.trim().match(regex);
  if (match) {
    return {
      ft: parseInt(match[1] || '0'),
      in: parseInt(match[2] || '0')
    };
  }
  return null;
};

export const calculateBOQ = (
  dims: Dimensions,
  settings: ProjectSettings,
  unitCosts: Record<string, number>
): BOQItem[] => {
  // Master Reference Basis (15m x 2.5m x 0.3m)
  // These ratios derived from the "Site-Reality" Master Reference
  const { length, height, thickness } = dims;
  
  // 1. Concrete Volume (including user-defined wastage)
  const volume = length * height * thickness;
  const concreteQtyMetric = volume * (1 + settings.concreteWastage / 100);
  
  // 2. Formwork Area (Faces + Stop Ends)
  const formworkArea = (length * height * 2) + (thickness * height * 2);
  const scaledFormworkArea = formworkArea * (78 / 76.5); 

  const isImperial = dims.unitSystem === UnitSystem.IMPERIAL;
  const items: BOQItem[] = [];

  // Units & Conversions
  const concreteUnit = isImperial ? 'yd³' : 'm³';
  const concreteQty = isImperial ? concreteQtyMetric * 1.30795 : concreteQtyMetric;

  const timberUnit = isImperial ? 'ft' : 'm';
  const timberRatio = isImperial ? 3.28084 : 1.0;

  const weightUnit = isImperial ? 'lbs' : 'kg';
  const weightRatio = isImperial ? 2.20462 : 1.0;

  const liquidUnit = isImperial ? 'gal' : 'L';
  const liquidRatio = isImperial ? 0.264172 : 1.0;

  // McGurk AIQS Items:
  
  // Concrete
  items.push(createItem('concrete', isImperial ? 'Concrete (US Standard C35)' : 'Concrete (C35/45)', concreteUnit, concreteQty, unitCosts['concrete'] || 125, `Structural concrete including ${settings.concreteWastage}% wastage`));

  // Plywood (32 sq ft per sheet US standard)
  // Metric: 2.5m2 per sheet (including wastage factor). Ref area 78m2 -> 31 sheets.
  // 4x8 sheet is 2.97m2. If we keep the same relative wastage:
  const plywoodPcs = scaledFormworkArea / (isImperial ? 2.97 : 2.5); 
  items.push(createItem('plywood_sheets', isImperial ? 'Plywood (4\' x 8\' sheets)' : 'Plywood Sheets (18mm)', 'pcs', plywoodPcs, unitCosts['plywood_sheets'] || 45, isImperial ? 'US Standard 4x8 Structural Plywood' : '2.44x1.22 sheets including site factors'));

  // Primary Timbers
  const primaryTimber = length * 12.67 * timberRatio;
  items.push(createItem('primary_timber', isImperial ? 'Primary Timbers (4x2)' : 'Primary Timbers (100x50)', timberUnit, primaryTimber, unitCosts['primary_timber'] || 4.5, `Primary support timbers (${(12.67 * timberRatio).toFixed(1)}${timberUnit} per ${isImperial ? 'ft' : 'm'})`));

  // Secondary Timbers
  const secondaryTimber = length * 6.0 * timberRatio;
  items.push(createItem('secondary_timber', isImperial ? 'Secondary Timbers (3x2)' : 'Secondary Timbers (75x50)', timberUnit, secondaryTimber, unitCosts['secondary_timber'] || 3.2, `Secondary support timbers (${(6.0 * timberRatio).toFixed(1)}${timberUnit} per ${isImperial ? 'ft' : 'm'})`));

  // Tie Rods (formerly Dywi Bars)
  const dywiCount = length * 8.33;
  const dywiLength = 800 + ((thickness - 0.3) * 1000); 
  const tieRodName = isImperial ? 'US 15k/50k Tie Rods' : `Dywi Bars Ø16mm (${Math.round(dywiLength)}mm)`;
  items.push(createItem('dywi_bars', tieRodName, 'pcs', dywiCount, unitCosts['dywi_bars'] || 12, 'High-strength form ties scaled to thickness'));

  // Hardware
  items.push(createItem('hardware', isImperial ? 'Form Ties Hardware (Sets)' : 'Sleeves & Cones (Sets)', 'set', dywiCount, unitCosts['hardware'] || 1.2, 'Through-wall protection hardware'));

  // Release Agent
  const agentQty = scaledFormworkArea * 0.27 * liquidRatio;
  items.push(createItem('agent', 'Form Release Agent', liquidUnit, agentQty, unitCosts['agent'] || 5.5, `US Gallon consumption ratio (${(0.27 * liquidRatio).toFixed(3)}${liquidUnit}/sqm)`));

  // Steel Reinforcement
  const steelQty = volume * settings.reinforcementRatio * weightRatio;
  items.push(createItem('steel', isImperial ? 'Structural Rebar (#4/#5 Equivalent)' : 'High Tensile Rebar', weightUnit, steelQty, unitCosts['steel'] || 1.85, `Reinforcement based on ${settings.reinforcementRatio} ${weightUnit}/m³ density`));

  return items;
};

function createItem(id: string, name: string, unit: string, quantity: number, unitCost: number, description: string): BOQItem {
  return {
    id,
    name,
    unit,
    quantity,
    unitCost,
    totalCost: quantity * unitCost,
    description
  };
}
