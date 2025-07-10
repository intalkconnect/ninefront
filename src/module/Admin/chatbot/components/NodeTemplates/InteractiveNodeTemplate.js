export const QuickReplyTemplate = {
  type: 'interactive',
  label: 'Botões',
  iconName: 'HelpCircle',
  color: '#388E3C',
  block: {
    type: 'interactive',
    awaitResponse: true,
    awaitTimeInSeconds: 0,
    sendDelayInSeconds: 1,
    actions: [],
    content: {
      type: 'button', // quickreply
      body: { text: 'Escolha uma opção:' },
      footer: { text: '' },
      action: {
        buttons: [
          { type: 'reply', reply: { id: '1', title: 'Opção 1' } },
          { type: 'reply', reply: { id: '2', title: 'Opção 2' } }
        ]
      }
    }
  },
};

export const MenuListTemplate = {
  type: 'interactive',
  label: 'Lista',
  iconName: 'ListEnd',
  color: '#00796B',
  block: {
    type: 'interactive',
    awaitResponse: true,
    awaitTimeInSeconds: 0,
    sendDelayInSeconds: 1,
    actions: [],
    content: {
      type: 'list',
      body: { text: 'Escolha um item da lista:' },
      footer: { text: 'Toque para selecionar' },
      header: { type: 'text', text: '🎯 Menu de Opções' },
      action: {
        button: 'Abrir lista',
        sections: [
          {
            title: 'Seção 1',
            rows: [
              {
                id: 'item_1',
                title: 'Item 1',
                description: 'Descrição do item 1',
              },
              {
                id: 'item_2',
                title: 'Item 2',
                description: 'Descrição do item 2',
              },
            ],
          },
        ],
      },
    },
  },
};
