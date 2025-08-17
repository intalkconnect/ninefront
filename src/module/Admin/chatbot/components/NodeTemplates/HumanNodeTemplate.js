export const HumanNodeTemplate = {
  label: 'Atendimento Humano',
  type: 'human',
  color: '#8E24AA',
  iconName: 'Headphones',
  block: {
    type: 'human',
    content: {
      queueName: 'Atendimento Geral',
      transferMessage: 'Um momento enquanto conecto você com um atendente...',
      timeout: 300, // Tempo máximo de espera em segundos
      fallbackAction: 'continue' // 'continue' ou 'repeat'
    },
    awaitResponse: true,
    sendDelayInSeconds: 0,
    actions: [],
    escalationReason: '' // Motivo da transferência
  },
};
