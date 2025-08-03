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
    code: `function handler () {
  return;
}`,
    function: 'handler',
    outputVar: 'resultado',
    language: 'javascript',
    timeout: 5000
  },
};
