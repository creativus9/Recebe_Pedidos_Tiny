// Importa as bibliotecas necessárias.
// 'express' para criar o servidor web e 'axios' para fazer as requisições.
const express = require('express');
const axios = require('axios');

// Cria uma instância do aplicativo Express.
const app = express();
app.use(express.json());

// --- CONFIGURAÇÕES ---
const TINY_API_TOKEN = '62c5bc5db80bf5ef0c26a3a33f15db309da48b5612e90fe786d30b9d2184675a';
const TINY_API_URL_OBTER_PEDIDO = 'https://api.tiny.com.br/api2/pedido.obter.php';
const PORT = process.env.PORT || 3000;
// --- FIM DAS CONFIGURAÇÕES ---

/**
 * Função auxiliar para extrair mensagens de erro da resposta da API do Tiny.
 * @param {object} retorno O objeto 'retorno' da resposta da API.
 * @returns {string} Uma mensagem de erro formatada.
 */
const getTinyErrorMessage = (retorno) => {
  if (retorno && retorno.registros && retorno.registros.registro && retorno.registros.registro.erros) {
    return retorno.registros.registro.erros.join(', ');
  }
  return 'A API do Tiny retornou um erro, mas sem detalhes específicos.';
};

app.post('/processar-pedido', async (req, res) => {
  const { orderId } = req.body;
  console.log(`[INFO] Recebida requisição para processar o pedido ID: ${orderId}`);

  if (!orderId) {
    console.warn('[AVISO] Requisição recebida sem um orderId.');
    return res.status(400).json({ error: 'O campo "orderId" é obrigatório no corpo da requisição.' });
  }

  const params = new URLSearchParams();
  params.append('token', TINY_API_TOKEN);
  params.append('id', orderId);
  params.append('formato', 'JSON');

  try {
    // Faz a chamada POST para a API do Tiny para obter os detalhes do pedido.
    const tinyResponse = await axios.post(TINY_API_URL_OBTER_PEDIDO, params);

    // Verifica se a resposta do Tiny foi bem-sucedida.
    if (tinyResponse.data.retorno && tinyResponse.data.retorno.status === 'OK') {
      console.log(`[SUCESSO] Detalhes do pedido ${orderId} obtidos com sucesso.`);
      // Envia o objeto completo do pedido de volta para o n8n.
      res.status(200).json(tinyResponse.data.retorno.pedido);
    } else {
      // Se o Tiny retornou um erro conhecido (ex: pedido não encontrado).
      const errorMessage = getTinyErrorMessage(tinyResponse.data.retorno);
      console.error(`[ERRO] A API do Tiny retornou um erro: ${errorMessage}`);
      res.status(400).json({ 
        error: 'A API do Tiny retornou um erro.', 
        details: errorMessage
      });
    }
  } catch (error) {
    // Se ocorreu um erro de rede ou na própria requisição.
    console.error('[ERRO FATAL] Falha ao conectar com a API do Tiny:', error.message);
    res.status(500).json({ 
      error: 'Falha ao comunicar com a API do Tiny.',
      details: error.message
    });
  }
});

// Inicia o servidor para que ele comece a "escutar" por requisições na porta definida.
app.listen(PORT, () => {
  console.log(`[INFO] Servidor iniciado e escutando na porta ${PORT}`);
});
