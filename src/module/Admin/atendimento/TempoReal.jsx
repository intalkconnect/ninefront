import React, { useState, useEffect } from 'react';
import { apiGet } from '../../../shared/apiClient';
import {
  Clock,
  User,
  MessageCircle,
  Phone,
  Users,
  AlertTriangle,
  CheckCircle,
  Timer,
} from 'lucide-react';

const PaginaTempoReal = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedFilter, setSelectedFilter] = useState('todos');
  const [atendimentos, setAtendimentos] = useState([]);

  useEffect(() => {
    const fetchAtendimentos = async () => {
      try {
        const { data } = await apiGet.get('/analytics/realtime');

        const atendimentosFormatados = data.map((item) => ({
          ...item,
          inicioConversa: new Date(item.inicioConversa),
          tempoEspera:
            item.status === 'aguardando'
              ? Math.floor((Date.now() - new Date(item.inicioConversa).getTime()) / 60000)
              : Math.floor(item.tempoEspera / 60),
        }));

        setAtendimentos(atendimentosFormatados);
        setCurrentTime(new Date());
      } catch (error) {
        console.error('Erro ao buscar dados do endpoint:', error);
      }
    };

    fetchAtendimentos();
    const interval = setInterval(fetchAtendimentos, 10000);
    return () => clearInterval(interval);
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
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const filteredAtendimentos = atendimentos.filter((a) => {
    if (selectedFilter === 'todos') return true;
    if (selectedFilter === 'aguardando') return a.status === 'aguardando';
    if (selectedFilter === 'em_atendimento') return a.status === 'em_atendimento';
    if ([
      'suporte_tecnico',
      'vendas',
      'cancelamento',
      'financeiro',
    ].includes(selectedFilter)) {
      return a.fila.toLowerCase().replace(' ', '_') === selectedFilter;
    }
    return a.canal === selectedFilter;
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
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

      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Filtros</h2>
        <div className="flex flex-wrap gap-2">
          {['todos', 'aguardando', 'em_atendimento', 'suporte_tecnico', 'vendas', 'cancelamento', 'financeiro', 'whatsapp', 'telegram', 'webchat', 'instagram'].map((filter) => (
            <button
              key={filter}
              onClick={() => setSelectedFilter(filter)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedFilter === filter
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filter.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </button>
          ))}
        </div>
      </div>

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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fila
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Canal
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Agente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tempo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prioridade
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAtendimentos.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{a.cliente}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{a.fila}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-lg mr-2">{getChannelIcon(a.canal)}</span>
                    <span className="text-sm text-gray-900 capitalize">{a.canal}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {a.agente || <span className="text-sm text-gray-500 italic">Não atribuído</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(a.status)}`}>
                      {a.status === 'aguardando' && <Clock className="w-3 h-3 mr-1" />}
                      {a.status === 'em_atendimento' && <CheckCircle className="w-3 h-3 mr-1" />}
                      {a.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{formatTime(a.tempoEspera)}</div>
                    <div className="text-xs text-gray-500">
                      Início: {a.inicioConversa.toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {a.prioridade === 'alta' && <AlertTriangle className="w-4 h-4 mr-1" />}
                      <span className={`text-sm font-medium ${getPriorityColor(a.prioridade)}`}>
                        {a.prioridade.charAt(0).toUpperCase() + a.prioridade.slice(1)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PaginaTempoReal;
