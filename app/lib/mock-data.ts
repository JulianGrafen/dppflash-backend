import { ProductPassport } from '../types/dpp-types';

/**
 * Zentraler Datenspeicher für das MVP.
 * Clean Code: Nutzt die definierten Interfaces für Typsicherheit.
 */
export const MOCK_PRODUCTS: Record<string, ProductPassport> = {
  "123": {
    id: "123",
    type: "BATTERY",
    createdAt: new Date("2026-03-19"),
    hersteller: "TechVolt GmbH",
    modellname: "PowerCell Pro T100",
    kapazitaetKWh: 100,
    chemischesSystem: "Lithium-Ionen (NMC)"
  },
  "tex-2027": {
    id: "tex-2027",
    type: "TEXTILE",
    createdAt: new Date("2026-03-19"),
    hersteller: "EcoStyle Solutions",
    modellname: "Recycled Ocean Shirt",
    materialZusammensetzung: "95% Recyceltes Polyester, 5% Elasthan",
    herkunftsland: "Portugal"
  }
};

/**
 * Holt ein Produkt anhand der ID.
 * Futureproof: Kann später leicht durch einen Datenbank-Call (async/await) ersetzt werden.
 */
export const getProductById = (id: string): ProductPassport | undefined => {
console.log(MOCK_PRODUCTS[id])
  return MOCK_PRODUCTS[id];
};