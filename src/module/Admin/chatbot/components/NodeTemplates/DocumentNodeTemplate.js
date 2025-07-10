export const DocumentNodeTemplate = {
  type: 'document',
  label: 'Enviar Documento',
  iconName: 'FileText', // Ícone mais apropriado (precisa importar)
  color: '#6A1B9A',
  block: {
    type: 'media', // Alterado para media para consistência
    mediaType: 'document', // Especifica o tipo
    awaitResponse: false,
    sendDelayInSeconds: 1,
    actions: [],
    content: {
      url: '',
      caption: '📄 Aqui está o documento solicitado',
      filename: '' // Novo campo para nome do arquivo
    },
    validExtensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx'] // Extensões permitidas
  },
};