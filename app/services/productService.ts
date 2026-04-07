import { ProductPassport } from '../types/dpp-types';
import { v4 as uuidv4 } from 'uuid';
import { saveProductToStore, getProductFromStore, getAllProducts, deleteProductFromStore } from '../lib/server-store';

/**
 * Product Service – Speichern & Abrufen von Produkten.
 * 
 * Architektur:
 * - MVP: In-Memory Mock-Daten (MOCK_PRODUCTS)
 * - Zukünftig: Supabase PostgreSQL
 * - Austauschbar ohne Änderung der API
 */

/**
 * Speichert ein validiertes Produkt.
 * Generiert automatisch ID und Timestamp wenn nicht vorhanden.
 * 
 * @param product - Produktdaten (Partial für neue Einträge)
 * @param tenantId - Mandanten-ID (für zukünftige Multi-Tenancy)
 * @returns Gespeichertes Produkt mit eindeutiger ID
 */
export async function saveProduct(
  product: Partial<ProductPassport>,
  tenantId?: string
): Promise<ProductPassport> {
  // Generiere ID wenn nicht vorhanden
  const id = product.id || uuidv4();
  
  // Parsiere createdAt: wenn es ein String ist (aus JSON), konvertiere zu Date
  let createdAt = product.createdAt;
  if (typeof createdAt === 'string') {
    createdAt = new Date(createdAt);
  } else if (!createdAt) {
    createdAt = new Date();
  }

  // Validiere Pflichtfelder
  if (!product.hersteller || !product.modellname || !product.type) {
    throw new Error('Pflichtfelder erforderlich: hersteller, modellname, type');
  }

  // Spread ALL incoming fields — never drop anything from the PDF extraction
  const completeProduct: ProductPassport = {
    ...product,
    id,
    createdAt: createdAt as Date,
    hersteller: product.hersteller,
    modellname: product.modellname,
    type: product.type,
  } as ProductPassport;

  // MVP: Speichern in Global Store
  const savedProduct = await saveProductToStore(completeProduct);

  return savedProduct;
}

/**
 * Holt ein Produkt nach ID.
 * 
 * @param productId - Eindeutige Produkt-ID
 * @param tenantId - Optional: Validate Tenant-Zugehörigkeit
 * @returns Produkt oder undefined wenn nicht gefunden
 */
export async function getProduct(
  productId: string,
  tenantId?: string
): Promise<ProductPassport | undefined> {
  const product = await getProductFromStore(productId);

  if (!product) {
    console.warn(`⚠️ Produto não encontrado: ${productId}`);
    return undefined;
  }

  return product;
}

/**
 * Listet alle Produkte eines Mandanten auf.
 * 
 * @param tenantId - Mandanten-ID
 * @returns Array aller Produkte
 */
export async function listProducts(tenantId?: string): Promise<ProductPassport[]> {
  // MVP: Alle Produkte zurückgeben
  return getAllProducts();
}

/**
 * Aktualisiert ein existierendes Produkt.
 * 
 * @param productId - ID des Produkts
 * @param updates - Zu ändernde Felder
 * @returns Aktualisiertes Produkt
 */
export async function updateProduct(
  productId: string,
  updates: Partial<ProductPassport>
): Promise<ProductPassport> {
  const existing = await getProductFromStore(productId);

  if (!existing) {
    throw new Error(`Produto não encontrado: ${productId}`);
  }

  const updated: ProductPassport = {
    ...existing,
    ...updates,
  } as ProductPassport;

  const savedProduct = await saveProductToStore(updated);

  console.log(`✏️ Produto atualizado: ${productId}`);
  return savedProduct;
}

/**
 * Löscht ein Produkt (DSGVO: Recht auf Vergessenheit).
 * 
 * @param productId - ID des Produkts
 * @param tenantId - Mandanten-ID (Sicherheit)
 */
export async function deleteProduct(
  productId: string,
  tenantId?: string
): Promise<void> {
  const existing = await getProductFromStore(productId);
  
  if (!existing) {
    throw new Error(`Produto não encontrado: ${productId}`);
  }

  deleteProductFromStore(productId);
}
