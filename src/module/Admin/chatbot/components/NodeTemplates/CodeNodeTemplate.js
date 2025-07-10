export const CodeNodeTemplate = {
  type: 'code',
  label: 'Executar Script',
  iconName: 'Code',
  color: '#F57C00',
  block: {
    type: 'code',
    awaitResponse: false,
    sendDelayInSeconds: 1,
    actions: [],
    code: '// Escreva seu código aqui\n// Use context para acessar dados da conversa\n// Retorne um valor com return',
    function: 'handler',
    outputVar: 'resultado',
    language: 'javascript', // Novo campo para especificar linguagem
    timeout: 5000 // Tempo máximo de execução em ms
  },
  
};