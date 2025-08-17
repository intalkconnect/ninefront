// src/module/Admin/atendimento/OmnichannelDashboard.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Clock, User, MessageCircle, AlertTriangle, CheckCircle, Timer } from 'lucide-react';

/**
 * OmnichannelDashboard
 * - Mantém o layout/estilos do seu componente original
 * - Recebe os dados por props: `atendimentosExternos` (array)
 * - `tempoEspera` chega (do TempoReal.jsx) em MINUTOS
 * - `inicioConversa` pode ser Date ou string ISO
 */
export default function OmnichannelDashboard({ atendimentosExternos = [] }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedFilter, setSelectedFilter] = useState('todos');

  // Mantém os dados prontos para render (normaliza tipos)
  const atendimentos = useMemo(() => {
    return (atendimentosExternos || []).map((a) => ({
      ...a,
      // garante Date para o render
      inicioConversa: a?.inicioConversa
        ? (a.inicioConversa instanceof Date ? a.inicioConversa : new Date(a.inicioConversa))
        : new Date(),
      // garante número (minutos)
      tempoEspera: Number.isFinite(a?.tempoEspera) ? a.tempoEspera : 0,
    }));
  }, [atendimentosExternos]);

  // Atualiza o relógio apenas para o "Última atualização"
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const getChannelIcon = (canal) => {
    switch (canal) {
      case 'whatsapp': return '📱';
      case 'telegram': return '✈️';
      case 'webchat': return '💬';
      case 'instagram': return '📷';
      default: return '📞';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'aguardando': return 'bg-yellow-100 text-yellow-800';
      case 'em_atendimento': return 'bg-green-100 text-green-800';
      case 'finalizado': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (prioridade) => {
    switch (prioridade) {
      case 'alta': return 'text-red-600';
      case 'normal': return 'text-yellow-600';
      case 'baixa': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const formatTime = (minutes) => {
    const mins = Math.max(0, Math.floor(minutes || 0));
    const hours = Math.floor(mins / 60);
    const rem = mins % 60;
    return hours > 0 ? `${hours}h ${rem}m` : `${rem}m`;
  };

  const filteredAtendimentos = useMemo(() => {
    return atendimentos.filter((atendimento) => {
      if (selectedFilter === 'todos') return true;
      if (selectedFilter === 'aguardando') return atendimento.status === 'aguardando';
      if (selectedFilter === 'em_atendimento') return atendimento.status === 'em_atendimento';
      // Filtrar por fila
      if (['suporte_tecnico', 'vendas', 'cancelamento', 'financeiro'].includes(selectedFilter)) {
        return (atendimento.fila || '').toLowerCase().replace(' ', '_') === selectedFilter;
      }
      // Filtrar por canal
      return atendimento.canal === selectedFilter;
    });
  }, [atendimentos, selectedFilter]);

  // Estatísticas e métricas
  const filas = ['Suporte Técnico', 'Vendas', 'Cancelamento', 'Financeiro'];
  const stats = useMemo(() => {
    const aguardando = atendimentos.filter(a => a.status === 'aguardando');
    const emAtendimento = atendimentos.filter(a => a.status === 'em_atendimento');

    const tempoMedio = (arr, getter) => {
      if (!arr.length) return 0;
      const total = arr.reduce((sum, a) => sum + (getter(a) || 0), 0);
      return Math.round(total / arr.length);
    };

    return {
      clientesAguardando: aguardando.length,
      emAtendimento: emAtendimento.length,
      atendentesOnline: [...new Set(atendimentos.filter(a => a.agente).map(a => a.agente))].length,
      tempoMedioResposta: tempoMedio(emAtendimento, a => a.tempoEspera || 2),
      tempoMedioAtendimento: tempoMedio(emAtendimento, () => 8) || 12, // placeholder
      tempoMedioAguardando: tempoMedio(aguardando, a => a.tempoEspera),
    };
  }, [atendimentos]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Monitoramento Omnichannel
            </h1>
            <p className="text-gray-600">
              Última atualização: {currentTime.toLocaleTimeString('pt-BR')}
            </p>
          </div>
          <div className="flex space-x-4">
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              Exportar Relatório
            </button>
            <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
              Configurações
            </button>
          </div>
        </div>
      </div>

      {/* Métricas */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Métricas Gerais</h2>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border">
            <div className="text-center">
              <Clock className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
              <p className="text-gray-600 text-sm font-medium">Clientes Aguardando</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.clientesAguardando}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border">
            <div className="text-center">
              <MessageCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-gray-600 text-sm font-medium">Em Atendimento</p>
              <p className="text-2xl font-bold text-green-600">{stats.emAtendimento}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border">
            <div className="text-center">
              <User className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <p className="text-gray-600 text-sm font-medium">Atendentes Online</p>
              <p className="text-2xl font-bold text-blue-600">{stats.atendentesOnline}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border">
            <div className="text-center">
              <Timer className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <p className="text-gray-600 text-sm font-medium">T. Médio Resposta</p>
              <p className="text-2xl font-bold text-purple-600">{formatTime(stats.tempoMedioResposta)}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border">
            <div className="text-center">
              <CheckCircle className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
              <p className="text-gray-600 text-sm font-medium">T. Médio Atendimento</p>
              <p className="text-2xl font-bold text-indigo-600">{formatTime(stats.tempoMedioAtendimento)}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border">
            <div className="text-center">
              <AlertTriangle className="w-8 h-8 text-orange-600 mx-auto mb-2" />
              <p className="text-gray-600 text-sm font-medium">T. Médio Aguardando</p>
              <p className="text-2xl font-bold text-orange-600">{formatTime(stats.tempoMedioAguardando)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-xl shadow-sm border mb-6">
        <div className="flex flex-col space-y-4">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Filtros Gerais</h4>
            <div className="flex flex-wrap gap-2">
              {['todos', 'aguardando', 'em_atendimento'].map(filter => (
                <button
                  key={filter}
                  onClick={() => setSelectedFilter(filter)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedFilter === filter
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1).replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Filtrar por Fila</h4>
            <div className="flex flex-wrap gap-2">
              {['suporte_tecnico', 'vendas', 'cancelamento', 'financeiro'].map(filter => (
                <button
                  key={filter}
                  onClick={() => setSelectedFilter(filter)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedFilter === filter
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {filter.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Filtrar por Canal</h4>
            <div className="flex flex-wrap gap-2">
              {['whatsapp', 'telegram', 'webchat', 'instagram'].map(filter => (
                <button
                  key={filter}
                  onClick={() => setSelectedFilter(filter)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedFilter === filter
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <span className="mr-2">{getChannelIcon(filter)}</span>
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Atendimentos em Tempo Real ({filteredAtendimentos.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fila</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Canal</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Agente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tempo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prioridade</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAtendimentos.map((atendimento) => (
                <tr key={atendimento.id ?? `${atendimento.cliente}-${atendimento.inicioConversa?.toISOString?.() || ''}`} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                        <User className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{atendimento.cliente}</div>
                        <div className="text-sm text-gray-500">ID: #{atendimento.id ?? '—'}</div>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="text-sm font-medium text-gray-900">{atendimento.fila || '—'}</div>
                      {atendimento.posicaoFila ? (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          #{atendimento.posicaoFila}
                        </span>
                      ) : null}
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="text-lg mr-2">{getChannelIcon(atendimento.canal)}</span>
                      <span className="text-sm font-medium text-gray-900 capitalize">
                        {atendimento.canal}
                      </span>
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    {atendimento.agente ? (
                      <div className="text-sm text-gray-900">{atendimento.agente}</div>
                    ) : (
                      <span className="text-sm text-gray-500 italic">Não atribuído</span>
                    )}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(atendimento.status)}`}>
                      {atendimento.status === 'aguardando' && <Clock className="w-3 h-3 mr-1" />}
                      {atendimento.status === 'em_atendimento' && <CheckCircle className="w-3 h-3 mr-1" />}
                      {(atendimento.status || '').replace('_', ' ')}
                    </span>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{formatTime(atendimento.tempoEspera)}</div>
                    <div className="text-xs text-gray-500">
                      Início:{' '}
                      {atendimento.inicioConversa instanceof Date
                        ? atendimento.inicioConversa.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {atendimento.prioridade === 'alta' && <AlertTriangle className="w-4 h-4 mr-1" />}
                      <span className={`text-sm font-medium ${getPriorityColor(atendimento.prioridade)}`}>
                        {atendimento.prioridade
                          ? atendimento.prioridade.charAt(0).toUpperCase() + atendimento.prioridade.slice(1)
                          : '—'}
                      </span>
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button className="text-blue-600 hover:text-blue-900">Ver</button>
                      <button className="text-green-600 hover:text-green-900">Assumir</button>
                      <button className="text-red-600 hover:text-red-900">Transferir</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredAtendimentos.length && (
                <tr>
                  <td className="px-6 py-8 text-center text-gray-500" colSpan={8}>
                    Nenhum atendimento para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Alertas em tempo real (exemplo estático, igual ao original) */}
      <div className="mt-6 bg-white rounded-xl shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <AlertTriangle className="w-5 h-5 text-orange-500 mr-2" />
          Alertas e Notificações
        </h3>
        <div className="space-y-3">
          <div className="flex items-center p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-500 mr-3" />
            <span className="text-sm text-red-800">
              Exemplo: cliente X aguarda há mais de 8 minutos no webchat
            </span>
          </div>
          <div className="flex items-center p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <Clock className="w-5 h-5 text-yellow-500 mr-3" />
            <span className="text-sm text-yellow-800">
              Exemplo: cliente Y aguarda há mais de 15 minutos no Instagram
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
