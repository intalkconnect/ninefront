import React, { useState, useEffect, useMemo } from 'react';
import { apiGet } from '../../../shared/apiClient';
import { Clock, User, MessageCircle, AlertTriangle, CheckCircle, Timer } from 'lucide-react';
import styles from './styles/TempoReal.module.css';

// Normaliza nomes das filas (ex.: "Suporte Técnico" -> "suporte_tecnico")
const slugify = (str = '') =>
  String(str)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\w_]/g, '');

const canais = ['whatsapp', 'telegram', 'webchat', 'instagram'];

const TempoReal = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedFilter, setSelectedFilter] = useState('todos');
  const [atendimentos, setAtendimentos] = useState([]);
  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    let mounted = true;

    const fetchAll = async () => {
      try {
        // IMPORTANTE: apiGet é função -> use apiGet('/caminho'), NÃO apiGet.get(...)
        const [rt, fs] = await Promise.all([
          apiGet('/analytics/realtime'),
          apiGet('/filas'),
        ]);

        if (!mounted) return;

        // /analytics/realtime (aceita Array direto ou {data: Array})
        const rtArray = Array.isArray(rt) ? rt : (Array.isArray(rt?.data) ? rt.data : []);
        const formatados = rtArray.map((item) => {
          const inicio = new Date(item.inicioConversa);
          const esperaMinCalc = Math.floor((Date.now() - inicio.getTime()) / 60000);
          const esperaSegApi = Number(item.tempoEspera ?? 0); // vem em segundos no seu exemplo
          const esperaMinApi = Math.floor(esperaSegApi / 60);

          return {
            ...item,
            inicioConversa: inicio,
            tempoEspera: item.status === 'aguardando' ? esperaMinCalc : esperaMinApi,
          };
        });

        // /filas (aceita array de strings ou objetos { nome })
        const filasIn = Array.isArray(fs) ? fs : (Array.isArray(fs?.data) ? fs.data : []);
        const filasNorm = filasIn
          .map((f) => {
            if (typeof f === 'string') return { nome: f, slug: slugify(f) };
            const nome = f?.nome || f?.name || f?.titulo || '';
            return nome ? { nome, slug: slugify(nome) } : null;
          })
          .filter(Boolean);

        setAtendimentos(formatados);
        setFilas(filasNorm);
        setErro(null);
        setCurrentTime(new Date());
      } catch (e) {
        console.error('Erro ao buscar dados:', e);
        setErro('Falha ao atualizar dados. Tentaremos novamente em 10s.');
      } finally {
        setLoading(false);
      }
    };

    // primeira carga + refresh a cada 10s
    fetchAll();
    const interval = setInterval(fetchAll, 10000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const formatTime = (m = 0) => {
    const mins = Math.max(0, Math.floor(m));
    const h = Math.floor(mins / 60);
    const r = mins % 60;
    return h > 0 ? `${h}h ${r}m` : `${r}m`;
  };

  const filasParaFiltro = filas.length
    ? filas
    : Array.from(new Set(atendimentos.map((a) => a.fila).filter(Boolean)))
        .map((nome) => ({ nome, slug: slugify(nome) }));

  const filtered = useMemo(() => {
    return atendimentos.filter((a) => {
      if (selectedFilter === 'todos') return true;
      if (selectedFilter === 'aguardando') return a.status === 'aguardando';
      if (selectedFilter === 'em_atendimento') return a.status === 'em_atendimento';
      if (filasParaFiltro.some((f) => f.slug === selectedFilter)) return slugify(a.fila) === selectedFilter;
      if (canais.includes(selectedFilter)) return a.canal === selectedFilter;
      return true;
    });
  }, [atendimentos, selectedFilter, filasParaFiltro]);

  const stats = useMemo(() => ({
    clientesAguardando: atendimentos.filter((a) => a.status === 'aguardando').length,
    emAtendimento: atendimentos.filter((a) => a.status === 'em_atendimento').length,
    atendentesOnline: new Set(atendimentos.filter((a) => a.agente).map((a) => a.agente)).size,
    tempoMedioResposta: Math.round(
      atendimentos
        .filter((a) => a.status === 'em_atendimento')
        .reduce((s, a) => s + (a.tempoEspera || 0), 0) /
      Math.max(1, atendimentos.filter((a) => a.status === 'em_atendimento').length)
    ),
    // Placeholder simples, até termos endpoint de métricas
    tempoMedioAtendimento: Math.round(
      (atendimentos.filter((a) => a.status === 'em_atendimento').length ? 8 : 12)
    ),
    tempoMedioAguardando: Math.round(
      atendimentos
        .filter((a) => a.status === 'aguardando')
        .reduce((s, a) => s + (a.tempoEspera || 0), 0) /
      Math.max(1, atendimentos.filter((a) => a.status === 'aguardando').length)
    ),
  }), [atendimentos]);

  const alertas = useMemo(() => (
    atendimentos
      .filter((a) => a.status === 'aguardando' && (a.tempoEspera || 0) >= 8)
      .sort((a, b) => (b.tempoEspera || 0) - (a.tempoEspera || 0))
      .slice(0, 3)
  ), [atendimentos]);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Tempo Real</h1>
          <p className={styles.subtitle}>
            Última atualização: {currentTime.toLocaleTimeString('pt-BR')}
          </p>
          {erro && <p className={styles.error}>{erro}</p>}
        </div>
      </div>

      {/* Métricas */}
      <section className={styles.cardGroup}>
        <div className={styles.card}>
          <Clock className={styles.cardIcon} />
          <p className={styles.cardLabel}>Clientes Aguardando</p>
          <p className={`${styles.cardValue} ${styles.yellow}`}>{stats.clientesAguardando}</p>
        </div>
        <div className={styles.card}>
          <MessageCircle className={styles.cardIcon} />
          <p className={styles.cardLabel}>Em Atendimento</p>
          <p className={`${styles.cardValue} ${styles.green}`}>{stats.emAtendimento}</p>
        </div>
        <div className={styles.card}>
          <User className={styles.cardIcon} />
          <p className={styles.cardLabel}>Atendentes Online</p>
          <p className={`${styles.cardValue} ${styles.blue}`}>{stats.atendentesOnline}</p>
        </div>
        <div className={styles.card}>
          <Timer className={styles.cardIcon} />
          <p className={styles.cardLabel}>T. Médio Resposta</p>
          <p className={`${styles.cardValue} ${styles.purple}`}>{formatTime(stats.tempoMedioResposta)}</p>
        </div>
        <div className={styles.card}>
          <CheckCircle className={styles.cardIcon} />
          <p className={styles.cardLabel}>T. Médio Atendimento</p>
          <p className={`${styles.cardValue} ${styles.indigo}`}>{formatTime(stats.tempoMedioAtendimento)}</p>
        </div>
        <div className={styles.card}>
          <AlertTriangle className={styles.cardIcon} />
          <p className={styles.cardLabel}>T. Médio Aguardando</p>
          <p className={`${styles.cardValue} ${styles.orange}`}>{formatTime(stats.tempoMedioAguardando)}</p>
        </div>
      </section>

      {/* Filtros */}
      <section className={styles.filters}>
        <div className={styles.filterGroup}>
          <h4 className={styles.filterTitle}>Filtros Gerais</h4>
          <div className={styles.filterChips}>
            {['todos', 'aguardando', 'em_atendimento'].map((f) => (
              <button
                key={f}
                onClick={() => setSelectedFilter(f)}
                className={`${styles.chip} ${selectedFilter === f ? styles.chipActive : ''}`}
              >
                {f.replace('_', ' ').replace(/^\w/, (c) => c.toUpperCase())}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.filterGroup}>
          <h4 className={styles.filterTitle}>Filtrar por Fila</h4>
          <div className={styles.filterChips}>
            {filasParaFiltro.map(({ nome, slug }) => (
              <button
                key={slug}
                onClick={() => setSelectedFilter(slug)}
                className={`${styles.chip} ${selectedFilter === slug ? styles.chipGreen : ''}`}
              >
                {nome}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.filterGroup}>
          <h4 className={styles.filterTitle}>Filtrar por Canal</h4>
          <div className={styles.filterChips}>
            {canais.map((f) => (
              <button
                key={f}
                onClick={() => setSelectedFilter(f)}
                className={`${styles.chip} ${selectedFilter === f ? styles.chipPurple : ''}`}
              >
                {f[0].toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Tabela */}
      <section className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <h2 className={styles.tableTitle}>Atendimentos em Tempo Real ({filtered.length})</h2>
        </div>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Fila</th>
                <th>Canal</th>
                <th>Agente</th>
                <th>Status</th>
                <th>Tempo</th>
                <th>Prioridade</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className={styles.loadingCell}>Carregando…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className={styles.emptyCell}>Sem atendimentos no filtro atual.</td></tr>
              ) : filtered.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div className={styles.clientCell}>
                      <div className={styles.avatar}><User size={14} /></div>
                      <div>
                        <div className={styles.clientName}>{a.cliente}</div>
                        <div className={styles.clientSub}>Ticket: #{a.ticket_number}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className={styles.queueCell}>
                      <span>{a.fila}</span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.channelCell}>
                      <span className={styles.cap}>{a.canal}</span>
                    </div>
                  </td>
                  <td>{a.agente ? a.agente : <em className={styles.muted}>Não atribuído</em>}</td>
                  <td>
                    <span className={`${styles.status} ${
                      a.status === 'aguardando' ? styles.statusWait :
                      a.status === 'em_atendimento' ? styles.statusLive :
                      styles.statusDone
                    }`}>
                      {a.status === 'aguardando' && <Clock size={12} className={styles.statusIcon} />}
                      {a.status === 'em_atendimento' && <CheckCircle size={12} className={styles.statusIcon} />}
                      {String(a.status || '').replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    <div>{formatTime(a.tempoEspera)}</div>
                    <div className={styles.subtle}>
                      Início: {a?.inicioConversa instanceof Date && !isNaN(a.inicioConversa)
                        ? a.inicioConversa.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                        : '--:--'}
                    </div>
                  </td>
                  <td>
                    <div className={styles.priorityCell}>
                      {a.prioridade === 'alta' && <AlertTriangle size={14} className={styles.priorityIcon} />}
                      <span className={`${styles.priorityText} ${
                        a.prioridade === 'alta' ? styles.red :
                        a.prioridade === 'normal' ? styles.amber :
                        a.prioridade === 'baixa' ? styles.green : styles.gray
                      }`}>
                        {a.prioridade ? a.prioridade[0].toUpperCase() + a.prioridade.slice(1) : '—'}
                      </span>
                    </div>
                  </td>
                  <td className={styles.actionsCell}>
                    <button className={styles.linkBtn}>Ver</button>
                    <button className={styles.linkBtnSuccess}>Assumir</button>
                    <button className={styles.linkBtnDanger}>Transferir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
};

export default TempoReal;
