/**
 * Globaler In-Memory Store para o servidor.
 * Persiste dados entre requisicoes HTTP.
 *
 * Auf Vercel: Supabase Storage als persistenter Fallback (serverless-safe).
 */

import { ProductPassport } from '../types/dpp-types';
import { supabase, STORAGE_BUCKETS } from './supabase';

declare global {
  var __dpp_store__: {
    products: Map<string, ProductPassport>;
  };
}

if (!globalThis.__dpp_store__) {
  globalThis.__dpp_store__ = {
    products: new Map(),
  };

  const initialProducts: ProductPassport[] = [
    {
      id: "123",
      type: "BATTERY",
      createdAt: new Date("2026-03-19"),
      language: "de",
      hersteller: "TechVolt GmbH",
      modellname: "PowerCell Pro T100",
      kapazitaetKWh: 100,
      chemischesSystem: "Lithium-Ionen (NMC)"
    },
    {
      id: "tex-2027",
      type: "TEXTILE",
      createdAt: new Date("2026-03-19"),
      language: "de",
      hersteller: "EcoStyle Solutions",
      modellname: "Recycled Ocean Shirt",
      materialZusammensetzung: "95% Recyceltes Polyester, 5% Elasthan",
      herkunftsland: "Portugal"
    }
  ];

  initialProducts.forEach(product => {
    globalThis.__dpp_store__.products.set(product.id, product);
  });

  console.log("Global Store initialized with:", Array.from(globalThis.__dpp_store__.products.keys()));
}

async function saveToSupabase(product: ProductPassport): Promise<void> {
  if (!supabase) return;
  try {
    const json = JSON.stringify(product);
    const blob = new Blob([json], { type: "application/json" });
    const { error } = await supabase.storage
      .from(STORAGE_BUCKETS.EXTRACTED_DATA)
      .upload(`products/${product.id}.json`, blob, { upsert: true });
    if (error) {
      console.warn(`Supabase save failed for ${product.id}:`, error.message);
    }
  } catch (err) {
    console.warn("Supabase save error:", err);
  }
}

async function loadFromSupabase(id: string): Promise<ProductPassport | undefined> {
  if (!supabase) return undefined;
  try {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKETS.EXTRACTED_DATA)
      .download(`products/${id}.json`);
    if (error || !data) return undefined;
    const text = await data.text();
    const product = JSON.parse(text) as ProductPassport;
    if (typeof (product as any).createdAt === "string") {
      (product as any).createdAt = new Date((product as any).createdAt);
    }
    return product;
  } catch {
    return undefined;
  }
}

export function getAllProducts(): ProductPassport[] {
  return Array.from(globalThis.__dpp_store__.products.values());
}

export async function getProductFromStore(id: string): Promise<ProductPassport | undefined> {
  const cached = globalThis.__dpp_store__.products.get(id);
  if (cached) return cached;

  const product = await loadFromSupabase(id);
  if (product) {
    globalThis.__dpp_store__.products.set(id, product);
    return product;
  }

  return undefined;
}

export async function saveProductToStore(product: ProductPassport): Promise<ProductPassport> {
  globalThis.__dpp_store__.products.set(product.id, product);
  console.log(`Produkt gespeichert: ${product.id}`);
  await saveToSupabase(product);
  return product;
}

export function deleteProductFromStore(id: string): boolean {
  const deleted = globalThis.__dpp_store__.products.delete(id);
  return deleted;
}
