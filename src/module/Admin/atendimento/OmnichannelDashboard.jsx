
// src/module/Admin/atendimento/OmnichannelDashboard.jsx
import React from 'react';

/**
 * OmnichannelDashboard.jsx
 * - Componente de apresentação para dados de atendimento
 * - Recebe `atendimentosExternos` como prop (array de objetos)
 */
export default function OmnichannelDashboard({ atendimentosExternos = [] }) {
  if (!atendimentosExternos.length) {
    return (
      <div className="p-6 text-gray-500">
        Nenhum atendimento em andamento no momento.
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Atendimentos em Tempo Real</h2>
      <table className="w-full border border-gray-200">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-3 py-2 text-left">Cliente</th>
            <th className="px-3 py-2 text-left">Agente</th>
            <th className="px-3 py-2 text-left">Fila</th>
            <th className="px-3 py-2 text-left">Tempo de Espera (min)</th>
            <th className="px-3 py-2 text-left">Início da Conversa</th>
          </tr>
        </thead>
        <tbody>
          {atendimentosExternos.map((a, idx) => (
            <tr key={idx} className="border-t">
              <td className="px-3 py-2">{a.cliente || '-'}</td>
              <td className="px-3 py-2">{a.agente || '-'}</td>
              <td className="px-3 py-2">{a.fila || '-'}</td>
              <td className="px-3 py-2">{a.tempoEspera}</td>
              <td className="px-3 py-2">
                {a.inicioConversa
                  ? new Date(a.inicioConversa).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
