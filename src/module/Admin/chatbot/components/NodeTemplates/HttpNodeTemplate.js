export const ApiCallNodeTemplate = {
  type: 'api_call',
  label: 'Requisição HTTP',
  iconName: 'Globe',
  color: '#7B1FA2',
  block: {
    type: 'api_call',
    awaitResponse: false,
    sendDelayInSeconds: 1,
    actions: [],
    // ↓ campos na RAIZ do bloco (o executor lê aqui)
    method: 'GET',
    url: 'https://api.exemplo.com/endpoint',
    headers: { 'Content-Type': 'application/json' },
    body: {},               // objeto (não string)
    timeout: 10000,
    outputVar: 'apiResponse',
    statusVar: 'apiStatus',
  },
};
