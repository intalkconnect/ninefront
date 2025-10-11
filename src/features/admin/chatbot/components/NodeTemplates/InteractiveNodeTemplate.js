// src/features/admin/chatbot/components/NodeTemplates/InteractiveNodeTemplate.js

// Template ÚNICO exibido na paleta
export const InteractiveNodeTemplate = {
  type: 'interactive',
  label: 'Interativo',
  iconName: 'ListEnd',
  color: '#00796B',
  block: {
    type: 'interactive',
    awaitResponse: true,
    awaitTimeInSeconds: 0,
    sendDelayInSeconds: 0,
    actions: [],
    // default em "button"; o painel já permite trocar para "list"
    content: {
      type: 'button',
      header: { type: 'text', text: '🎯 Menu de Opções' },
      body: { text: 'Escolha uma opção:' },
      footer: { text: '' },
      action: {
        buttons: [
          { type: 'reply', reply: { id: 'sim', title: '👍 Sim' } },
          { type: 'reply', reply: { id: 'nao', title: '👎 Não' } }
        ]
      }
    }
  }
};

/* ===== Exports legados (opcionais) — não entram na paleta =====
   Mantidos só para não quebrar imports antigos em outras partes do app.
   Se não houver referência em lugar nenhum, pode remover com segurança.
*/
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
      type: 'button',
      body: { text: 'Escolha uma opção:' },
      footer: { text: '' },
      action: {
        buttons: [
          { type: 'reply', reply: { id: '1', title: 'Opção 1' } },
          { type: 'reply', reply: { id: '2', title: 'Opção 2' } }
        ]
      }
    }
  }
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
      header: { type: 'text', text: '🎯 Menu de Opções' },
      body: { text: 'Escolha um item da lista:' },
      footer: { text: 'Toque para selecionar' },
      action: {
        button: 'Abrir lista',
        sections: [
          {
            title: 'Seção 1',
            rows: [
              { id: 'item_1', title: 'Item 1', description: 'Descrição do item 1' },
              { id: 'item_2', title: 'Item 2', description: 'Descrição do item 2' }
            ]
          }
        ]
      }
    }
  }
};
