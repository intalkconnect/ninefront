import React, { useState, useEffect } from 'react';
import { apiGet } from '../../../shared/apiClient';
import {
  Clock,
  User,
  MessageCircle,
  AlertTriangle,
  CheckCircle,
  Timer,
} from 'lucide-react';

// Padroniza nomes de filas para filtro (ex.: "Suporte Técnico" -> "suporte_tecnico")
const slugify = (str = '') =>
  String(str)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\w_]/g, '');

const TempoReal = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedFilter, setSelectedFilter] = useState('todos');
  const [atendimentos, setAtendimentos] = useState([]);
  const [filas, setFilas] = useState([]); // do endpoint /filas
  const [erro, setErro] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchAll = async () => {
      try {
        const [realtimeRes, filasRes] = await Promise.all([
          apiGet.get('/analytics/realtime'),
          apiGet.get('/filas'),
        ]);

        // --- Realtime ---
        const data = Array.isArray(realtimeRes?.data) ? realtimeRes.data : [];
        const atendimentosFormatados = data.map((item) => {
          const inicio = new Date(item.inicioConversa);
          const esperaMinCalc = Math.floor((Date.now() - inicio.getTime()) / 60000);
          const esperaDaApiSeg = Number(item.tempoEspera ?? 0);
          const esperaMinApi = Math.floor(esperaDaApiSeg / 60);

          return {
            ...item,
            inicioConversa: inicio,
            // Se estiver aguardando, calcula pelo relógio; senão usa valor da API (convertido para minutos)
            tempoEspera: item.status === 'aguardando' ? esperaMinCalc : esperaMinApi,
          };
        });

        // --- Filas ---
        const filasData = Array.isArray(filasRes?.data) ? filasRes.data : [];
        const filasNormalizadas = filasData
          .map((f) =>
            typeof f === 'string'
              ? { nome: f, slug: slugify(f) }
              : { nome: f?.nome || f?.name || '', slug: slugify(f?.nome || f?.name || '') }
          )
          .filter((f) => f.nome);

        if (!isMounted) return;
        setAtendimentos(atendimentosFormatados);
        if (filasNormalizadas.length) setFilas(filasNormalizadas);
        setErro(null);
        setCurrentTime(new Date());
      } catch (e) {
        if (!isMounted) return;
        console.error('Erro ao buscar dados:', e);
        setErro('Falha ao atualizar dados. Tentaremos novamente em 10s.');
      }
    };

    // Chamada imediata + intervalo de 10s
    fetchAll();
    const interval = setInterval(fetchAll, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
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

  const formatTime = (minutes = 0) => {
    const mins = Math.max(0, Math.floor(minutes));
    const hours = Math.floor(mins / 60);
    const rest = mins % 60;
    return hours > 0 ? `${hours}h ${rest}m` : `${rest}m`;
  };

  // Filtros dinâmicos
  const canais = ['whatsapp', 'telegram', 'webchat', 'instagram'];
  const filasParaFiltro = filas.length
    ? filas
    : Array.from(new Set(atendimentos.map((a) => a.fila)))
        .filter(Boolean)
        .map((nome) => ({ nome, slug: slugify(nome) }));

  const filteredAtendimentos = atendimentos.filter((a) => {
    if (selectedFilter === 'todos') return true;
    if (selectedFilter === 'aguardando') return a.status === 'aguardando';
    if (selectedFilter === 'em_atendimento') return a.status === 'em_atendimento';
    // Fila (por slug)
    if (filasParaFiltro.some((f) => f.slug === selectedFilter)) {
      return slugify(a.fila) === selectedFilter;
    }
    // Canal
    if (canais.includes(selectedFilter)) {
      return a.canal === selectedFilter;
    }
    return true;
  });

  // Métricas (podemos trocar por endpoint depois)
  const stats = {
    clientesAguardando: atendimentos.filter((a) => a.status === 'aguardando').length,
    emAtendimento: atendimentos.filter((a) => a.status === 'em_atendimento').length,
    atendentesOnline: new Set(atendimentos.filter((a) => a.agente).map((a) => a.agente)).size,
    tempoMedioResposta: Math.round(
      atendimentos
        .filter((a) => a.status === 'em_atendimento')
        .reduce((sum, a) => sum + (a.tempoEspera || 0), 0) /
        Math.max(1, atendimentos.filter((a) => a.status === 'em_atendimento').length)
    ),
    tempoMedioAtendimento: Math.round(
      atendimentos
        .filter((a) => a.status === 'em_atendimento')
        .reduce((sum) => sum + 8, 0) /
        Math.max(1, atendimentos.filter((a) => a.status === 'em_atendimento').length) || 12
    ),
    tempoMedioAguardando: Math.round(
      atendimentos
        .filter((a) => a.status === 'aguardando')
        .reduce((sum, a) => sum + (a.tempoEspera || 0), 0) /
        Math.max(1, atendimentos.filter((a) => a.status === 'aguardando').length)
    ),
  };

  // Alertas simples (dinâmicos): aguardando há 8+ min
  const alertas = atendimentos
    .filter((a) => a.status === 'aguardando' && (a.tempoEspera || 0) >= 8)
    .sort((a, b) => (b.tempoEspera || 0) - (a.tempoEspera || 0))
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Monitoramento Omnichannel</h1>
            <p className="text-gray-600">
              Última atualização: {currentTime.toLocaleTimeString('pt-BR')}
            </p>
            {erro && <p className="text-sm text-red-600 mt-1">{erro}</p>}
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

      {/* MÉTRICAS */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Métricas Gerais</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

      {/* FILTROS */}
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
              {filasParaFiltro.map(({ nome, slug }) => (
                <button
                  key={slug}
                  onClick={() => setSelectedFilter(slug)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedFilter === slug
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {nome}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Filtrar por Canal</h4>
            <div className="flex flex-wrap gap-2">
              {canais.map((filter) => (
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

      {/* LISTA */}
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
                      {a.posicaoFila ? (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          #{a.posicaoFila}
                        </span>
                      ) : null}
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
                      Início: {a?.inicioConversa instanceof Date && !isNaN(a.inicioConversa) ? a.inicioConversa.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {a.prioridade === 'alta' && <AlertTriangle className="w-4 h-4 mr-1" />}
                      <span className={`text-sm font-medium ${getPriorityColor(a.prioridade)}`}>
                        {a.prioridade ? a.prioridade.charAt(0).toUpperCase() + a.prioridade.slice(1) : '—'}
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

      {/* ALERTAS */}
      <div className="mt-6 bg-white rounded-xl shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <AlertTriangle className="w-5 h-5 text-orange-500 mr-2" />
          Alertas e Notificações
        </h3>
        <div className="space-y-3">
          {alertas.length === 0 ? (
            <div className="flex items-center p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
              <span className="text-sm text-green-800">Sem alertas no momento.</span>
            </div>
          ) : (
            alertas.map((a) => (
              <div key={a.id} className="flex items-center p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <Clock className="w-5 h-5 text-yellow-600 mr-3" />
                <span className="text-sm text-yellow-800">
                  {a.cliente} aguarda há {formatTime(a.tempoEspera)} no {a.canal}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default TempoReal;
