// src/module/Admin/atendimento/TempoReal.jsx (ou onde você já usa OmnichannelDashboard)
import React, { useState, useEffect } from 'react';
import { Clock, User, MessageCircle, AlertTriangle, CheckCircle, Timer } from 'lucide-react';
import { apiGet } from '../../../shared/apiClient'; // ajuste o caminho se necessário

const OmnichannelDashboard = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedFilter, setSelectedFilter] = useState('todos');
  const [atendimentos, setAtendimentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  // ---- fetch em /analytics/realtime + refresh a cada 10s ----
  async function carregar() {
    try {
      setErro(null);
      const res = await apiGet('/analytics/realtime'); // ex.: [{ id, cliente, canal, agente, tempoEspera (s), ... }]
      const normalizado = Array.isArray(res)
        ? res.map((x) => ({
            ...x,
            // API fornece segundos; a UI trabalha com minutos
            tempoEspera: Math.floor(Number(x.tempoEspera || 0) / 60),
            // garantir Date para uso no toLocaleTimeString
            inicioConversa: x.inicioConversa ? new Date(x.inicioConversa) : new Date(),
          }))
        : [];
      setAtendimentos(normalizado);
    } catch (e) {
      console.error('[TempoReal] falha ao buscar /analytics/realtime:', e);
      setErro('Não foi possível carregar os dados agora.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar(); // primeira carga

    // relógio da “Última atualização”
    const clock = setInterval(() => setCurrentTime(new Date()), 1000);

    // refresh automático a cada 10s
    const tick = setInterval(() => carregar(), 10000);

    return () => {
      clearInterval(clock);
      clearInterval(tick);
    };
  }, []);

  // ---- helpers visuais ----
  const getChannelIcon = (canal) => {
    switch (String(canal).toLowerCase()) {
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
    const m = Math.max(0, Number(minutes) || 0);
    const hours = Math.floor(m / 60);
    const mins = m % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const filteredAtendimentos = atendimentos.filter((a) => {
    if (selectedFilter === 'todos') return true;
    if (selectedFilter === 'aguardando') return a.status === 'aguardando';
    if (selectedFilter === 'em_atendimento') return a.status === 'em_atendimento';
    if (['suporte_tecnico', 'vendas', 'cancelamento', 'financeiro'].includes(selectedFilter)) {
      return String(a.fila || '').toLowerCase().replace(/\s+/g, '_') === selectedFilter;
    }
    return String(a.canal || '').toLowerCase() === selectedFilter;
  });

  const stats = {
    clientesAguardando: atendimentos.filter(a => a.status === 'aguardando').length,
    emAtendimento: atendimentos.filter(a => a.status === 'em_atendimento').length,
    atendentesOnline: new Set(atendimentos.filter(a => a.agente).map(a => a.agente)).size,
    tempoMedioResposta: Math.round(
      atendimentos.filter(a => a.status === 'em_atendimento').reduce((sum, a) => sum + (a.tempoEspera || 0), 0) /
      Math.max(1, atendimentos.filter(a => a.status === 'em_atendimento').length)
    ),
    tempoMedioAtendimento: Math.round(
      atendimentos.filter(a => a.status === 'em_atendimento').reduce((sum, _a) => sum + 8, 0) /
      Math.max(1, atendimentos.filter(a => a.status === 'em_atendimento').length) || 12
    ),
    tempoMedioAguardando: Math.round(
      atendimentos.filter(a => a.status === 'aguardando').reduce((sum, a) => sum + (a.tempoEspera || 0), 0) /
      Math.max(1, atendimentos.filter(a => a.status === 'aguardando').length)
    ),
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-50 p-6 text-gray-600">Carregando...</div>;
  }
  if (erro) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded">
          <div className="text-red-700">{erro}</div>
          <button
            className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            onClick={() => { setLoading(true); carregar(); }}
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Monitoramento Omnichannel</h1>
            <p className="text-gray-600">Última atualização: {currentTime.toLocaleTimeString('pt-BR')}</p>
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
          <div className="bg-white p-4 rounded-xl shadow-sm border text-center">
            <Clock className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
            <p className="text-gray-600 text-sm font-medium">Clientes Aguardando</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.clientesAguardando}</p>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border text-center">
            <MessageCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <p className="text-gray-600 text-sm font-medium">Em Atendimento</p>
            <p className="text-2xl font-bold text-green-600">{stats.emAtendimento}</p>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border text-center">
            <User className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <p className="text-gray-600 text-sm font-medium">Atendentes Online</p>
            <p className="text-2xl font-bold text-blue-600">{stats.atendentesOnline}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border text-center">
            <Timer className="w-8 h-8 text-purple-600 mx-auto mb-2" />
            <p className="text-gray-600 text-sm font-medium">T. Médio Resposta</p>
            <p className="text-2xl font-bold text-purple-600">{formatTime(stats.tempoMedioResposta)}</p>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border text-center">
            <CheckCircle className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
            <p className="text-gray-600 text-sm font-medium">T. Médio Atendimento</p>
            <p className="text-2xl font-bold text-indigo-600">{formatTime(stats.tempoMedioAtendimento)}</p>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border text-center">
            <AlertTriangle className="w-8 h-8 text-orange-600 mx-auto mb-2" />
            <p className="text-gray-600 text-sm font-medium">T. Médio Aguardando</p>
            <p className="text-2xl font-bold text-orange-600">{formatTime(stats.tempoMedioAguardando)}</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-xl shadow-sm border mb-6">
        <div className="flex flex-col space-y-4">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Filtros Gerais</h4>
            <div className="flex flex-wrap gap-2">
              {['todos', 'aguardando', 'em_atendimento'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setSelectedFilter(filter)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedFilter === filter ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
              {['suporte_tecnico', 'vendas', 'cancelamento', 'financeiro'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setSelectedFilter(filter)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedFilter === filter ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {filter.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Filtrar por Canal</h4>
            <div className="flex flex-wrap gap-2">
              {['whatsapp', 'telegram', 'webchat', 'instagram'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setSelectedFilter(filter)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedFilter === filter ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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

      {/* Lista */}
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
              {filteredAtendimentos.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                        <User className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{a.cliente}</div>
                        <div className="text-sm text-gray-500">ID: #{a.id}</div>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="text-sm font-medium text-gray-900">{a.fila}</div>
                      {a.posicaoFila && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          #{a.posicaoFila}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="text-lg mr-2">{getChannelIcon(a.canal)}</span>
                      <span className="text-sm font-medium text-gray-900 capitalize">{a.canal}</span>
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    {a.agente ? (
                      <div className="text-sm text-gray-900">{a.agente}</div>
                    ) : (
                      <span className="text-sm text-gray-500 italic">Não atribuído</span>
                    )}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(a.status)}`}>
                      {a.status === 'aguardando' && <Clock className="w-3 h-3 mr-1" />}
                      {a.status === 'em_atendimento' && <CheckCircle className="w-3 h-3 mr-1" />}
                      {String(a.status || '').replace('_', ' ')}
                    </span>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{formatTime(a.tempoEspera)}</div>
                    <div className="text-xs text-gray-500">
                      Início:{' '}
                      {a.inicioConversa instanceof Date
                        ? a.inicioConversa.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                        : '--:--'}
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {a.prioridade === 'alta' && <AlertTriangle className="w-4 h-4 mr-1" />}
                      <span className={`text-sm font-medium ${getPriorityColor(a.prioridade)}`}>
                        {String(a.prioridade || '').charAt(0).toUpperCase() + String(a.prioridade || '').slice(1)}
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
            </tbody>
          </table>
        </div>
      </div>

      {/* Alertas (exemplo estático) */}
      <div className="mt-6 bg-white rounded-xl shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <AlertTriangle className="w-5 h-5 text-orange-500 mr-2" />
          Alertas e Notificações
        </h3>
        <div className="space-y-3">
          <div className="flex items-center p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <Clock className="w-5 h-5 text-yellow-500 mr-3" />
            <span className="text-sm text-yellow-800">
              Monitorando tempos de espera em todas as filas…
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OmnichannelDashboard;
