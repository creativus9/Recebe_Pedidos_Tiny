// Importa as bibliotecas necessárias.
// 'express' para criar o servidor web e 'axios' para fazer as requisições.
const express = require('express');
const axios = require('axios');

// Cria uma instância do aplicativo Express.
const app = express();

// Middleware para permitir que o Express entenda requisições com corpo em JSON.
app.use(express.json());

// --- CONFIGURAÇÕES ---
// Suas informações do Tiny ERP inseridas diretamente no código.
const TINY_API_TOKEN = '62c5bc5db80bf5ef0c26a3a33f15db309da48b5612e90fe786d30b9d2184675a';
const TINY_API_URL_OBTER = 'https://api.tiny.com.br/api2/pedido.obter.php';

// Define a porta em que o servidor vai rodar. O Railway fornecerá essa variável.
// Se estiver rodando localmente, usará a porta 3000.
const PORT = process.env.PORT || 3000;
// --- FIM DAS CONFIGURAÇÕES ---

/**
 * Rota principal para processar os pedidos.
 * Ficará escutando por requisições POST em /processar-pedido
 */
app.post('/processar-pedido', async (req, res) => {
  // Pega o 'orderId' que o n8n enviou no corpo (body) da requisição.
  const { orderId } = req.body;

  console.log(`[INFO] Recebida requisição para processar o pedido ID: ${orderId}`);

  // Validação: Verifica se o n8n realmente enviou o orderId.
  if (!orderId) {
    console.warn('[AVISO] Requisição recebida sem um orderId.');
    // Retorna um erro 400 (Bad Request) indicando que a requisição está mal formatada.
    return res.status(400).json({ error: 'O campo "orderId" é obrigatório no corpo da requisição.' });
  }

  // Prepara os parâmetros para a chamada à API do Tiny.
  const params = new URLSearchParams();
  params.append('token', TINY_API_TOKEN);
  params.append('id', orderId);
  params.append('formato', 'JSON');

  try {
    // Faz a chamada POST para a API do Tiny.
    const tinyResponse = await axios.post(TINY_API_URL_OBTER, params);

    // Verifica se a resposta do Tiny foi bem-sucedida.
    if (tinyResponse.data.retorno && tinyResponse.data.retorno.status === 'OK') {
      console.log(`[SUCESSO] Detalhes do pedido ${orderId} obtidos com sucesso.`);
      // Envia o objeto completo do pedido de volta para o n8n.
      res.status(200).json(tinyResponse.data.retorno.pedido);
    } else {
      // Se o Tiny retornou um erro conhecido (ex: pedido não encontrado).
      console.error(`[ERRO] A API do Tiny retornou um erro:`, tinyResponse.data.retorno);
      res.status(400).json({ 
        error: 'A API do Tiny retornou um erro.', 
        details: tinyResponse.data.retorno 
      });
    }
  } catch (error) {
    // Se ocorreu um erro de rede ou na própria requisição.
    console.error('[ERRO FATAL] Falha ao conectar com a API do Tiny:', error.message);
    res.status(502).json({ 
      error: 'Falha ao comunicar com a API do Tiny.',
      details: error.message
    });
  }
});

// Inicia o servidor para que ele comece a "escutar" por requisições na porta definida.
app.listen(PORT, () => {
  console.log(`[INFO] Servidor iniciado e escutando na porta ${PORT}`);
});
