/**
 * Globaler In-Memory Store para o servidor.
 * Persiste dados entre requisições HTTP.
 * 
 * Nota: Isso é para MVP. Em produção, usar Supabase PostgreSQL.
 */

import { ProductPassport } from '../types/dpp-types';

// Use globalThis para persistir dados entre requests
declare global {
  var __dpp_store__: {
    products: Map<string, ProductPassport>;
  };
}

// Inicializa o store global se não existir
if (!globalThis.__dpp_store__) {
  globalThis.__dpp_store__ = {
    products: new Map(),
  };
  
  // Preenche com dados iniciais
  const initialProducts: ProductPassport[] = [
    {
      id: "123",
      type: "BATTERY",
      createdAt: new Date("2026-03-19"),
      hersteller: "TechVolt GmbH",
      modellname: "PowerCell Pro T100",
      kapazitaetKWh: 100,
      chemischesSystem: "Lithium-Ionen (NMC)"
    },
    {
      id: "tex-2027",
      type: "TEXTILE",
      createdAt: new Date("2026-03-19"),
      hersteller: "EcoStyle Solutions",
      modellname: "Recycled Ocean Shirt",
      materialZusammensetzung: "95% Recyceltes Polyester, 5% Elasthan",
      herkunftsland: "Portugal"
    }
  ];
  
  initialProducts.forEach(product => {
    globalThis.__dpp_store__.products.set(product.id, product);
  });
  
  console.log('🟢 Global Store initialized with:', Array.from(globalThis.__dpp_store__.products.keys()));
}

/**
 * Holt alle Produkte
 */
export function getAllProducts(): ProductPassport[] {
  return Array.from(globalThis.__dpp_store__.products.values());
}

/**
 * Holt ein Produkt nach ID
 */
export function getProductFromStore(id: string): ProductPassport | undefined {
  return globalThis.__dpp_store__.products.get(id);
}

/**
 * Speichert ein Produkt
 */
export function saveProductToStore(product: ProductPassport): ProductPassport {
  globalThis.__dpp_store__.products.set(product.id, product);
  console.log(`💾 Produto salvo no global store: ${product.id}`);
  console.log(`📦 Total de produtos no store: ${globalThis.__dpp_store__.products.size}`);
  console.log(`🔑 IDs disponíveis: ${Array.from(globalThis.__dpp_store__.products.keys()).join(', ')}`);
  return product;
}

/**
 * Deleta um Produkt
 */
export function deleteProductFromStore(id: string): boolean {
  const deleted = globalThis.__dpp_store__.products.delete(id);
  if (deleted) {
    console.log(`🗑️  Produto deletado: ${id}`);
  }
  return deleted;
}
