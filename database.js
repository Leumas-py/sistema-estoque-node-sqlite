const Database = require('better-sqlite3');

const db = new Database('estoque.db');


db.exec(`
  CREATE TABLE IF NOT EXISTS produtos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    sku TEXT UNIQUE NOT NULL,
    quantidade INTEGER NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
    preco REAL NOT NULL DEFAULT 0 CHECK (preco >= 0),
    atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

module.exports = db;