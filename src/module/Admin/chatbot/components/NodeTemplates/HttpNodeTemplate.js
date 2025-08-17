export const HttpNodeTemplate = {
  type: 'http',
  label: 'Requisição HTTP',
  iconName: 'Globe',
  color: '#7B1FA2',
  block: {
    type: 'http',
    awaitResponse: false,
    sendDelayInSeconds: 1,
    actions: [],
    content: {
      method: 'GET',
      url: 'https://api.exemplo.com/endpoint',
      headers: JSON.stringify({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token'
      }, null, 2),
      body: JSON.stringify({ key: 'value' }, null, 2),
      timeout: 10000, // Tempo máximo em ms
      outputVar: 'apiResponse' // Onde armazenar a resposta
    }
  },
};