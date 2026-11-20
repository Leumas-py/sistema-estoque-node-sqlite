const db = require('./database');


function cadastrarProduto(nome, sku, quantidadeInicial = 0, preco = 0) {
  const stmt = db.prepare(`
    INSERT INTO produtos (nome, sku, quantidade, preco)
    VALUES (?, ?, ?, ?)
  `);
  const info = stmt.run(nome, sku, quantidadeInicial, preco);
  return { id: info.lastInsertRowid, nome, sku, quantidade: quantidadeInicial, preco };
}


function movimentarEstoque(sku, delta) {
  const transacao = db.transaction((skuAlvo, variacao) => {
    const produto = db.prepare('SELECT * FROM produtos WHERE sku = ?').get(skuAlvo);

    if (!produto) {
      throw new Error(`Produto com SKU "${skuAlvo}" não encontrado.`);
    }

    const novaQuantidade = produto.quantidade + variacao;
    if (novaQuantidade < 0) {
      throw new Error(
        `Estoque insuficiente para "${produto.nome}". Atual: ${produto.quantidade}, saída solicitada: ${Math.abs(variacao)}.`
      );
    }

    db.prepare(`
      UPDATE produtos
      SET quantidade = ?, atualizado_em = CURRENT_TIMESTAMP
      WHERE sku = ?
    `).run(novaQuantidade, skuAlvo);

    return { ...produto, quantidade: novaQuantidade };
  });

  return transacao(sku, delta);
}


function listarProdutos() {
  return db.prepare('SELECT * FROM produtos ORDER BY nome ASC').all();
}


try {
  const existente = db.prepare('SELECT * FROM produtos WHERE sku = ?').get('TEC-001');
  if (!existente) {
    cadastrarProduto('Teclado Mecânico', 'TEC-001', 10, 249.9);
  }

  console.log('Entrada de 5 unidades:');
  console.log(movimentarEstoque('TEC-001', 5));

  console.log('Saída de 3 unidades:');
  console.log(movimentarEstoque('TEC-001', -3));

  console.log('Estoque atual:');
  console.table(listarProdutos());
} catch (err) {
  console.error('Erro na operação:', err.message);
}