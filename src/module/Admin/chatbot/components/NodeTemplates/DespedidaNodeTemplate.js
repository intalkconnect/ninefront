export const DespedidaNodeTemplate = {
  label: 'Mensagem de Despedida',
  type: 'end',
  color: '#E53935', // Vermelho mais vibrante
  iconName: 'ListEnd',
  block: {
    type: 'text',
    content: 'Obrigado por conversar conosco! Até a próxima. 👋',
    awaitResponse: false, // Alterado para false em mensagem de fim
    sendDelayInSeconds: 1,
    actions: [],
    isTerminal: true // Novo campo para indicar que é um nó final
  },
};