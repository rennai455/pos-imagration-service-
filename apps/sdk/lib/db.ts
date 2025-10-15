import * as SQLite from "expo-sqlite";

export type ProductRecord = {
  id: string;
  name: string;
  barcode: string | null;
  price: number | null;
  stock: number;
  updatedAt: string;
  synced: number;
};

const db = SQLite.openDatabase("inventory.db");

export function initDB() {
  db.transaction((tx) => {
    tx.executeSql(
      `CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT,
        barcode TEXT,
        price REAL,
        stock INTEGER,
        updatedAt TEXT,
        synced INTEGER DEFAULT 1
      );`
    );
  });
}

export function upsertProduct(product: {
  id: string;
  name: string;
  barcode?: string | null;
  price?: number | null;
  stock: number;
  updatedAt?: string;
  synced?: number;
}) {
  const updatedAt = product.updatedAt ?? new Date().toISOString();
  const synced = product.synced ?? 0;

  db.transaction((tx) => {
    tx.executeSql(
      `INSERT INTO products (id, name, barcode, price, stock, updatedAt, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name=excluded.name,
         barcode=COALESCE(excluded.barcode, products.barcode),
         price=excluded.price,
         stock=excluded.stock,
         updatedAt=excluded.updatedAt,
         synced=excluded.synced;`,
      [
        product.id,
        product.name,
        product.barcode ?? null,
        product.price ?? null,
        product.stock,
        updatedAt,
        synced,
      ]
    );
  });
}

export function markUnsynced(id: string) {
  db.transaction((tx) => {
    tx.executeSql(
      "UPDATE products SET synced = 0, updatedAt = ? WHERE id = ?;",
      [new Date().toISOString(), id]
    );
  });
}

export function updateProductStock(id: string, stock: number) {
  db.transaction((tx) => {
    tx.executeSql(
      "UPDATE products SET stock = ?, synced = 0, updatedAt = ? WHERE id = ?;",
      [stock, new Date().toISOString(), id]
    );
  });
}

export function getProductById(id: string, callback: (product: ProductRecord | null) => void) {
  db.transaction((tx) => {
    tx.executeSql(
      "SELECT * FROM products WHERE id = ? LIMIT 1;",
      [id],
      (_, { rows }) => {
        callback(rows.length ? (rows.item(0) as ProductRecord) : null);
      }
    );
  });
}

export function getProductByBarcode(barcode: string, callback: (product: ProductRecord | null) => void) {
  db.transaction((tx) => {
    tx.executeSql(
      "SELECT * FROM products WHERE barcode = ? LIMIT 1;",
      [barcode],
      (_, { rows }) => {
        callback(rows.length ? (rows.item(0) as ProductRecord) : null);
      }
    );
  });
}

export function getAllProducts(callback: (products: ProductRecord[]) => void) {
  db.transaction((tx) => {
    tx.executeSql("SELECT * FROM products ORDER BY name ASC;", [], (_, { rows }) => {
      callback(rows._array as ProductRecord[]);
    });
  });
}

export function getUnsynced(callback: (rows: ProductRecord[]) => void) {
  db.transaction((tx) => {
    tx.executeSql(
      "SELECT * FROM products WHERE synced = 0;",
      [],
      (_, { rows }) => callback(rows._array as ProductRecord[])
    );
  });
}

export default db;
