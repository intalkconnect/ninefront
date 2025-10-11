export const nodeTemplates = [
  {
    type: 'audio',
    label: 'Áudio',
    iconName: 'Zap',
    color: '#5D4037',
    block: {
      type: 'audio',
      content: {
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
      },
      awaitResponse: false,
      awaitTimeInSeconds: 0,
      sendDelayInSeconds: 1
    }
  },
  {
    type: 'document',
    label: 'Documento',
    iconName: 'Zap',
    color: '#6D4C41',
    block: {
      type: 'document',
      content: {
        url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        caption: '📄 Documento solicitado'
      },
      awaitResponse: false,
      awaitTimeInSeconds: 0,
      sendDelayInSeconds: 1
    }
  },
  {
    type: 'location',
    label: 'Localização',
    iconName: 'Zap',
    color: '#455A64',
    block: {
      type: 'location',
      content: {
        name: 'São Paulo',
        address: 'São Paulo - SP',
        latitude: '-23.550520',
        longitude: '-46.633308'
      },
      awaitResponse: false,
      awaitTimeInSeconds: 0,
      sendDelayInSeconds: 1
    }
  },
  {
    type: 'script',
    label: 'Script',
    iconName: 'Zap',
    color: '#283593',
    block: {
      type: 'script',
      code: "function run() { return '🧠 Você escolheu conteúdo customizado com script!'; }",
      function: 'run()',
      outputVar: 'mensagemFinal',
      awaitResponse: false,
      awaitTimeInSeconds: 0,
      sendDelayInSeconds: 1
    }
  },
    {
    type: 'text',
    label: 'Mensagem',
    iconName: 'MessageCircle',
    color: '#263238',
    block: {
      type: 'text',
      content: 'Digite sua mensagem...',
      awaitResponse: false,
      awaitTimeInSeconds: 0,
      sendDelayInSeconds: 1
    }
  },
  {
    type: 'image',
    label: 'Imagem',
    iconName: 'HelpCircle',
    color: '#37474F',
    block: {
      type: 'image',
      content: {
        url: 'https://www.w3.org/Icons/w3c_home.png',
        caption: '📸 Aqui está sua imagem!'
      },
      awaitResponse: false,
      awaitTimeInSeconds: 0,
      sendDelayInSeconds: 1
    }
  },
  {
    type: 'interactive',
    label: 'Botões',
    iconName: 'Zap',
    color: '#455A64',
    block: {
      type: 'interactive',
      content: {
        body: {
          text: 'Deseja continuar?'
        },
        type: 'button',
        action: {
          buttons: [
            {
              type: 'reply',
              reply: {
                id: 'sim',
                title: '👍 Sim'
              }
            },
            {
              type: 'reply',
              reply: {
                id: 'nao',
                title: '👎 Não'
              }
            }
          ]
        },
        footer: {
          text: 'Selecione uma opção'
        }
      },
      awaitResponse: true,
      awaitTimeInSeconds: 0,
      sendDelayInSeconds: 0
    }
  }
];


