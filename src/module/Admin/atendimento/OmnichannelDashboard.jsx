import React from 'react';

export default function OmnichannelDashboard({ atendimentos = [] }) {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold">Monitoramento Omnichannel</h1>
      <p className="text-sm text-gray-500">Última atualização: {new Date().toLocaleTimeString()}</p>

      {/* Métricas Gerais */}
      <h2 className="mt-4 font-semibold">Métricas Gerais</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2 text-center">
        <div><p>Clientes Aguardando</p><span className="font-bold">{atendimentos.filter(a => a.status === 'aguardando').length}</span></div>
        <div><p>Em Atendimento</p><span className="font-bold">{atendimentos.filter(a => a.status === 'em atendimento').length}</span></div>
        <div><p>Atendentes Online</p><span className="font-bold">{new Set(atendimentos.map(a => a.agente)).size}</span></div>
        <div><p>T. Médio Atendimento</p><span className="font-bold">8m</span></div>
      </div>

      {/* Lista em tempo real */}
      <h2 className="mt-6 font-semibold">Atendimentos em Tempo Real ({atendimentos.length})</h2>
      <table className="w-full border mt-2 text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 text-left">Cliente</th>
            <th className="p-2">Fila</th>
            <th className="p-2">Canal</th>
            <th className="p-2">Agente</th>
            <th className="p-2">Status</th>
            <th className="p-2">Tempo</th>
            <th className="p-2">Prioridade</th>
            <th className="p-2">Ações</th>
          </tr>
        </thead>
        <tbody>
          {atendimentos.map((a, idx) => (
            <tr key={idx} className="border-b">
              <td className="p-2">{a.cliente}</td>
              <td className="p-2">{a.fila}</td>
              <td className="p-2">{a.canal}</td>
              <td className="p-2">{a.agente}</td>
              <td className="p-2">{a.status}</td>
              <td className="p-2">{a.tempo || '0m'}</td>
              <td className="p-2">{a.prioridade || 'Normal'}</td>
              <td className="p-2">
                <button className="px-2 py-1 bg-gray-200 rounded mr-1">Ver</button>
                <button className="px-2 py-1 bg-blue-500 text-white rounded mr-1">Assumir</button>
                <button className="px-2 py-1 bg-yellow-500 text-white rounded">Transferir</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Alertas */}
      <h2 className="mt-6 font-semibold">Alertas e Notificações</h2>
      <p className="text-sm text-gray-600">Monitorando tempos de espera em todas as filas...</p>
    </div>
  );
}
