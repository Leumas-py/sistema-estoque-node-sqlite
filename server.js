const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('./database');

const PORT = 3000;

function cadastrarProduto({ nome, codigo, quantidade = 0, preco = 0 }) {
  const codigoLimpo = String(codigo).trim().toUpperCase();
  const stmt = db.prepare(`
    INSERT INTO produtos (nome, sku, quantidade, preco)
    VALUES (?, ?, ?, ?)
  `);
  const info = stmt.run(String(nome).trim(), codigoLimpo, Number(quantidade), Number(preco));
  return db.prepare('SELECT * FROM produtos WHERE id = ?').get(info.lastInsertRowid);
}

function movimentarEstoque(codigo, delta) {
  const transacao = db.transaction((codigoAlvo, variacao) => {
    const codigoFormatado = String(codigoAlvo).trim().toUpperCase();
    const produto = db.prepare('SELECT * FROM produtos WHERE sku = ?').get(codigoFormatado);

    if (!produto) {
      throw new Error(`Produto com código "${codigoFormatado}" não encontrado.`);
    }

    const novaQuantidade = produto.quantidade + Number(variacao);
    if (novaQuantidade < 0) {
      throw new Error(`Estoque insuficiente para "${produto.nome}" (atual: ${produto.quantidade}).`);
    }

    db.prepare(`
      UPDATE produtos
      SET quantidade = ?, atualizado_em = CURRENT_TIMESTAMP
      WHERE sku = ?
    `).run(novaQuantidade, produto.sku);

    return db.prepare('SELECT * FROM produtos WHERE sku = ?').get(produto.sku);
  });

  return transacao(codigo, delta);
}

function listarProdutos() {
  return db.prepare('SELECT * FROM produtos ORDER BY id DESC').all();
}

function lerCorpoJson(req) {
  return new Promise((resolve, reject) => {
    let dados = '';
    req.on('data', (chunk) => (dados += chunk));
    req.on('end', () => {
      try {
        resolve(dados ? JSON.parse(dados) : {});
      } catch {
        reject(new Error('JSON inválido na requisição.'));
      }
    });
  });
}

function enviarJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  try {
    if (req.method === 'GET' && url.pathname === '/') {
      const htmlPath = path.join(__dirname, 'public', 'index.html');
      const html = fs.readFileSync(htmlPath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    }

    if (req.method === 'GET' && url.pathname === '/api/produtos') {
      return enviarJson(res, 200, listarProdutos());
    }

    if (req.method === 'POST' && url.pathname === '/api/produtos') {
      const { nome, codigo, quantidade, preco } = await lerCorpoJson(req);
      if (!nome || !codigo) {
        return enviarJson(res, 400, { erro: 'Nome e código de referência são obrigatórios.' });
      }
      const criado = cadastrarProduto({ nome, codigo, quantidade, preco });
      return enviarJson(res, 201, criado);
    }

    if (req.method === 'POST' && url.pathname === '/api/movimentar') {
      const { codigo, quantidade } = await lerCorpoJson(req);
      const delta = Number(quantidade);
      if (!codigo || !Number.isFinite(delta) || delta === 0) {
        return enviarJson(res, 400, { erro: 'Informe um código de referência válido e uma quantidade diferente de zero.' });
      }
      const atualizado = movimentarEstoque(codigo, delta);
      return enviarJson(res, 200, atualizado);
    }

    enviarJson(res, 404, { erro: 'Rota não encontrada.' });
  } catch (err) {
    const mensagem = err.code === 'SQLITE_CONSTRAINT_UNIQUE'
      ? 'Já existe um produto com esse código de referência.'
      : err.message;
    enviarJson(res, 400, { erro: mensagem });
  }
});

server.listen(PORT, () => {
  console.log(`Interface disponível em http://localhost:${PORT}`);
});