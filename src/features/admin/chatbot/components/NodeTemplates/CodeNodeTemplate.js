export const CodeNodeTemplate = {
  type: 'script',
  label: 'Executar Script',
  iconName: 'Code',
  color: '#F57C00',
  block: {
    type: 'script',           // ← importante: "script"
    awaitResponse: false,
    sendDelayInSeconds: 1,
    actions: [],
    code: `function handler(vars) {
  // faça o que precisar aqui
  vars.testFlag = 'ok';
  return 'done';
}`,
    function: 'run(vars)', // ← chamada, não só o nome
    outputVar: 'resultado',
    // os campos abaixo são opcionais para UI; o executor não usa:
    language: 'javascript',
    timeout: 5000
  },
};


