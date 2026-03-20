import { ProductPassport } from '../types/dpp-types';
import { getProductFromStore } from './server-store';

/**
 * Holt ein Produkt anhand der ID.
 * Nutzt den globalen Server-Store.
 */
export const getProductById = (id: string): ProductPassport | undefined => {
  console.log(`[getProductById] Suche nach ID: ${id}`);
  
  const product = getProductFromStore(id);
  
  if (product) {
    console.log(`[getProductById] ✅ Gefunden: ${id}`);
  } else {
    console.log(`[getProductById] ❌ Nicht gefunden: ${id}`);
  }
  
  return product;
};