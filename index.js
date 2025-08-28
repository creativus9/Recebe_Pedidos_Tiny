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
const TINY_API_URL_PESQUISA_CONTAS = 'https://api.tiny.com.br/api2/contas.receber.pesquisa.php';
const TINY_API_URL_OBTER_CONTA = 'https://api.tiny.com.br/api2/contas.receber.obter.php';
const PORT = process.env.PORT || 3000;
// --- FIM DAS CONFIGURAÇÕES ---

/**
 * Função auxiliar para extrair mensagens de erro da resposta da API do Tiny.
 * @param {object} retorno O objeto 'retorno' da resposta da API.
 * @returns {string} Uma mensagem de erro formatada.
 */
const getTinyErrorMessage = (retorno) => {
  if (retorno && retorno.registros && retorno.registros.registro && retorno.registros.registro.erros) {
    // Se houver uma lista de erros, junta todos numa única string.
    return retorno.registros.registro.erros.join(', ');
  }
  return 'A API do Tiny retornou um erro, mas sem detalhes específicos.';
};

app.post('/processar-pedido', async (req, res) => {
  const { orderId } = req.body;
  console.log(`[INFO] Recebida requisição para processar o pedido ID: ${orderId}`);

  if (!orderId) {
    console.warn('[AVISO] Requisição recebida sem um orderId.');
    return res.status(400).json({ error: 'O campo "orderId" é obrigatório.' });
  }

  try {
    // ETAPA 1: Obter os detalhes do pedido
    console.log(`[INFO] Etapa 1: Buscando detalhes do pedido ${orderId}...`);
    const paramsPedido = new URLSearchParams({ token: TINY_API_TOKEN, id: orderId, formato: 'JSON' });
    const pedidoResponse = await axios.post(TINY_API_URL_OBTER_PEDIDO, paramsPedido);

    if (pedidoResponse.data.retorno.status !== 'OK') {
      const errorMessage = getTinyErrorMessage(pedidoResponse.data.retorno);
      throw new Error(`Erro ao obter pedido: ${errorMessage}`);
    }
    const pedido = pedidoResponse.data.retorno.pedido;
    const idNotaFiscal = pedido.id_nota_fiscal;

    // Se não houver nota fiscal, não podemos buscar dados financeiros.
    if (!idNotaFiscal) {
      console.log(`[INFO] Pedido ${orderId} não possui nota fiscal. Retornando apenas dados do pedido.`);
      return res.status(200).json({ pedido, financeiro: null });
    }
    
    console.log(`[INFO] Etapa 2: Pedido ${orderId} tem NF ID: ${idNotaFiscal}. Pesquisando conta a receber...`);
    
    // ETAPA 2: Pesquisar a conta a receber usando o ID da Nota Fiscal
    const paramsPesquisaConta = new URLSearchParams({ token: TINY_API_TOKEN, idNotaFiscal, formato: 'JSON' });
    const pesquisaContaResponse = await axios.post(TINY_API_URL_PESQUISA_CONTAS, paramsPesquisaConta);

    // Se a pesquisa falhar ou não retornar resultados, encerramos o fluxo aqui.
    if (pesquisaContaResponse.data.retorno.status !== 'OK' || pesquisaContaResponse.data.retorno.numero_paginas === 0) {
      console.log(`[INFO] Nenhuma conta a receber encontrada para a NF ${idNotaFiscal}. Retornando apenas dados do pedido.`);
      return res.status(200).json({ pedido, financeiro: null });
    }

    const idContaReceber = pesquisaContaResponse.data.retorno.contas[0].id;
    console.log(`[INFO] Etapa 3: Conta a Receber encontrada (ID: ${idContaReceber}). Buscando detalhes...`);

    // ETAPA 3: Obter os detalhes da conta a receber
    const paramsObterConta = new URLSearchParams({ token: TINY_API_TOKEN, id: idContaReceber, formato: 'JSON' });
    const contaResponse = await axios.post(TINY_API_URL_OBTER_CONTA, paramsObterConta);

    if (contaResponse.data.retorno.status !== 'OK') {
      const errorMessage = getTinyErrorMessage(contaResponse.data.retorno);
      throw new Error(`Erro ao obter conta a receber: ${errorMessage}`);
    }
    const financeiro = contaResponse.data.retorno.conta;

    console.log(`[SUCESSO] Dados do pedido e financeiros obtidos para o pedido ${orderId}.`);
    res.status(200).json({ pedido, financeiro });

  } catch (error) {
    console.error('[ERRO FATAL] Ocorreu um erro no processamento:', error.message);
    res.status(500).json({ 
      error: 'Falha no processamento do pedido.',
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`[INFO] Servidor iniciado e escutando na porta ${PORT}`);
});
