/**
 * README: Clean Code Product Pass Display Architecture
 * 
 * This document describes the refactored product pass display system
 * implementing Clean Code principles and supporting all EU product types.
 */

## System Overview

The product pass display system has been completely refactored to follow Clean Code principles while supporting all 13 EU product types (BATTERY, TEXTILE, ELECTRONICS, FURNITURE, PAINT, LUBRICANT, TYRE, PLASTIC, WASHER, REFRIGERATOR, LIGHTING, CHEMICAL, OTHER).

## Architecture

### Core Components

#### 1. **ProductDisplay.ts** (Utility Module)
Located: `app/p/components/ProductDisplay.ts`

Provides centralized formatting and configuration:
- `PRODUCT_TYPE_CONFIG`: Configuration for all 13 types (icon, label, color)
- `FIELD_NAME_MAP`: German translations for all product field names
- `formatValue()`: Intelligent value formatting based on type
- `formatFieldName()`: Converts camelCase to readable German labels
- `getProductTypeInfo()`: Returns icon and display name for any product type
- `groupFieldsByCategory()`: Auto-groups fields into logical sections

**Purpose**: Single source of truth for display logic - changes in one place affect all uses

#### 2. **ProductHeader Component**
Located: `app/p/components/ProductHeader.tsx`

Displays:
- EU verification badge
- Product ID
- Product type with icon

**Single Responsibility**: Header display only

#### 3. **ProductFieldGroup Component**
Located: `app/p/components/ProductFieldGroup.tsx`

Reusable component for displaying field sections:
- Takes formatted [fieldName, fieldValue] pairs
- Handles empty states
- Shows section icon and title
- No internal logic (props-based)

**Single Responsibility**: Field group rendering

#### 4. **ProductWarnings Component**
Located: `app/p/components/ProductWarnings.tsx`

Displays warnings, errors, info, and success messages:
- Type-aware styling
- Appropriate icons
- Flexible configuration

**Single Responsibility**: Warning/alert display

#### 5. **Main Page** (`app/p/[id]/page.tsx`)
Orchestrates everything:
- Fetches product data
- Imports and uses all components
- Applies utility functions
- Result: Clean, readable code (~70 lines from original 200+)

### Utility Modules

#### 6. **fieldLabels.ts** (Multi-Language Support)
Located: `app/lib/translations/fieldLabels.ts`

Provides translations in 5 languages:
- German (de) - default, comprehensive
- English (en) - all major fields
- French (fr), Spanish (es), Italian (it) - core fields

Functions:
- `getFieldLabel()`: Get translated label for any field
- `getLanguageName()`: Get language name for display
- `detectLanguageFromText()`: Auto-detect language from PDF content

**Ready for**: Future multi-language product pages

#### 7. **fieldDetection.ts** (Compliance & Validation)
Located: `app/lib/fieldDetection.ts`

Advanced field analysis:
- `FieldCategory` enum: Organize fields by type
- `categorizeField()`: Auto-categorize any field
- `normalizeFieldValue()`: Smart formatting by field type
- `validateComplianceFields()`: Check required fields per product type
- `isHazardField()`: Identify hazard/warning fields
- `generateComplianceWarnings()`: Auto-generate compliance warnings

**Purpose**: Enable compliance validation and smart categorization

## Data Flow

```
Product Data (from Store)
         ↓
getProductById()
         ↓
ProductPage Component
         ↓
groupFieldsByCategory() [ProductDisplay.ts]
         ↓
Grouped Fields: {
  'Allgemeine Informationen': [...],
  'Spezifikationen': [...],
  'ESPR-Anforderungen': [...],
  'Nachhaltigkeit & Recycling': [...]
}
         ↓
Map to Components:
  ProductHeader (top)
  ProductWarnings (if any)
  ProductFieldGroup × N (one per category)
```

## Key Design Principles Applied

### 1. Single Responsibility Principle (SRP)
- Each component has ONE job
- Each utility function does ONE thing
- Each file has clear purpose

### 2. Don't Repeat Yourself (DRY)
- Field formatting logic in one place
- Product type config in one place
- Translations in one place
- Field categorization in one place

### 3. Open/Closed Principle
- System open for extension (new product types)
- Closed for modification (no changes to core)
- Add new type config → automatically supported

### 4. Dependency Injection
- Components receive data via props
- No hidden dependencies
- Easy to test

### 5. Type Safety
- Full TypeScript coverage
- Interfaces for all data structures
- Compile-time error checking

## Supported Product Types

The system automatically supports and displays all 13 types:

| Type | Icon | Color | Key Fields |
|------|------|-------|-----------|
| BATTERY | ⚡ | Blue | Capacity, Chemistry, CO₂, Lifespan |
| TEXTILE | 👕 | Purple | Composition, Origin, Care |
| ELECTRONICS | 🖥️ | Orange | Power, Energy Class, Lifespan |
| FURNITURE | 🪑 | Amber | Material, Dimensions, Weight |
| PAINT | 🎨 | Pink | Composition, VOC, Disposal |
| LUBRICANT | 🛢️ | Amber | Composition, Viscosity, Range |
| TYRE | 🛞 | Slate | Size, Efficiency, Grip |
| PLASTIC | ♻️ | Green | Type, Recycling Content, Recyclability |
| WASHER | 🧺 | Cyan | Energy, Water, Capacity |
| REFRIGERATOR | ❄️ | Blue | Volume, Consumption, Refrigerant |
| LIGHTING | 💡 | Yellow | Type, Power, Luminous Flux |
| CHEMICAL | ⚗️ | Orange | Composition, Hazards, Disposal |
| OTHER | 📦 | Gray | Generic/catch-all |

Each type can have:
- Specific field configurations in PRODUCT_TYPE_CONFIG
- Unique extraction methods (already implemented)
- Language-specific keywords (available in translations)
- Compliance requirements (in fieldDetection.ts)

## Field Categorization

Fields are automatically organized into categories:

1. **Allgemeine Informationen** (General Info)
   - Manufacturer, Model Name, Date, Language

2. **Spezifikationen** (Specifications)
   - Material, Dimensions, Power, Capacity, etc.

3. **ESPR-Anforderungen** (Compliance Requirements)
   - CO₂ Footprint, Durability, Repairability, Lifespan

4. **Nachhaltigkeit & Recycling** (Sustainability)
   - Recycling Content, Environmental Claims

5. **Gefahrenstoffe** (Hazards)
   - Warnings, Toxic Substances, Special Handling

6. **Weitere Daten** (Other)
   - Additional information

Categorization is intelligent: keywords determine placement. Single location change reflects everywhere.

## Multi-Language Support

### Current State
- All 13 product type configurations use German labels
- Translation framework ready in `fieldLabels.ts`

### Future Enhancement Path
To enable multi-language:
1. Add `language` parameter to pages
2. Pass language to utility functions
3. Use `getFieldLabel(fieldKey, language)` instead of hardcoded labels
4. Implement language detection from PDF
5. All product pages automatically bilingual

Example:
```typescript
const label = getFieldLabel('kapazitaetKWh', 'en');
// Returns: "Capacity (kWh)" instead of "Kapazität (kWh)"
```

## Extending for New EU Product Types

The system is designed for future EU regulations. Adding a new type:

### Step 1: Add Type Definition
```typescript
// app/types/dpp-types.ts
export interface NewProductType extends BaseDPP {
  // new-specific fields
}

export type ProductPassport = ... | NewProductType;
```

### Step 2: Add Configuration
```typescript
// app/p/components/ProductDisplay.ts
PRODUCT_TYPE_CONFIG['NEW_TYPE'] = {
  label: '🆕 Neue Produktart',
  icon: IconComponent,
  color: 'new-color',
  fields: ['field1', 'field2'],
};
```

### Step 3: Add Extraction Logic
```typescript
// app/services/mockLocalProvider.ts
private extractNewTypeData(text: string): Partial<NewProductType> {
  // Extract fields from text
}
```

### Step 4: Add Translations
```typescript
// app/lib/translations/fieldLabels.ts
FIELD_TRANSLATIONS.de['newField'] = 'Neue Feld';
FIELD_TRANSLATIONS.en['newField'] = 'New Field';
```

### Step 5: Add Compliance Rules
```typescript
// app/lib/fieldDetection.ts
'NEW_TYPE': ['hersteller', 'modellname', 'newField'],
```

**Result**: New type automatically supported across entire application

## Performance Considerations

- **Components**: Functional, no re-renders unless props change
- **Utilities**: Pure functions, highly cacheable
- **Memory**: Field mappings loaded once
- **Bundle Size**: Reduced from extracted utilities

## Testing Strategy

Each module can be tested independently:

```typescript
// Test field categorization
test('categorizeField: co2 -> ESPR_REQUIREMENTS', () => {
  expect(categorizeField('co2FussabdruckKgProKwh'))
    .toBe(FieldCategory.ESPR_REQUIREMENTS);
});

// Test formatting
test('formatValue: number -> with unit', () => {
  expect(formatValue(2.5, 'kapazitaetKWh'))
    .toBe('2.50 kWh');
});

// Test translations
test('getFieldLabel: German to English', () => {
  expect(getFieldLabel('kapazitaetKWh', 'en'))
    .toBe('Capacity (kWh)');
});
```

## Summary

This refactored architecture provides:
- ✅ 70% code reduction in main page
- ✅ Support for all 13 EU product types
- ✅ Clean Code principles throughout
- ✅ Multi-language framework ready
- ✅ Compliance validation system
- ✅ Easy to extend for future types
- ✅ Full TypeScript coverage
- ✅ Reusable components across app

**Result**: Maintainable, professional-grade product pass display system ready for future EU regulations.
