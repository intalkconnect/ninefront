import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { apiGet } from '../../../../shared/apiClient';
import {
  Clock, User, MessageCircle, AlertTriangle, CheckCircle, Timer,
  Headset, RefreshCw, Eye, ArrowLeftRight
} from 'lucide-react';
import { FaWhatsapp, FaTelegramPlane, FaGlobe, FaInstagram, FaFacebookF } from 'react-icons/fa';
import { toast } from 'react-toastify'; // NEW

import MiniChatDrawer from './MiniChatDrawer';
import TransferModal from './TransferModal';
import styles from './styles/ClientsMonitor.module.css';

// helper para ler e decodificar o JWT (email e role/profile)
const getAuthInfo = () => {
  try {
    const t = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!t) return { email: '', role: '' };
    let b64 = t.split('.')[1] || '';
    b64 = b64.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const json = atob(b64);
    const payload = JSON.parse(json);
    const email = payload?.email || payload?.user?.email || '';
    const role  = (payload?.profile || payload?.role || '').toLowerCase();
    return { email, role };
  } catch {
    return { email: '', role: '' };
  }
};

/* Utils ---------------------------------------------------- */
const slugify = (str = '') =>
  String(str)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim()
    .replace(/\s+/g, '_').replace(/[^\w_]/g, '');

const canais = ['Whatsapp', 'Telegram', 'Webchat', 'Instagram', 'Facebook'];

const cap = (s='') => String(s).replace('_', ' ')
  .replace(/^\w/u, c => c.toUpperCase());

const formatTime = (m = 0) => {
  const mins = Math.max(0, Math.floor(m));
  const h = Math.floor(mins / 60);
  const r = mins % 60;
  return h > 0 ? `${h}h ${r}m` : `${r}m`;
};

// Ícones por canal
const channelIcon = (canal) => {
  const c = String(canal || '').toLowerCase();
  switch (c) {
    case 'whatsapp':  return <FaWhatsapp />;
    case 'telegram':  return <FaTelegramPlane />;
    case 'webchat':   return <FaGlobe />;
    case 'instagram': return <FaInstagram />;
    case 'facebook':  return <FaFacebookF />;
    default:          return <FaGlobe />;
  }
};

/* Component ------------------------------------------------ */
export default function ClientsMonitor() {
  const unmountedRef = useRef(false); // NEW

  // settings vindos da API (null até carregar)
  const [settings, setSettings] = useState(null);

  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedFilter, setSelectedFilter] = useState('todos');
  const [atendimentos, setAtendimentos] = useState([]);
  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [transfer, setTransfer] = useState(null); // { userId, currentFila, currentAssigned }

  const onOpenTransfer = useCallback((a) => {
    setTransfer({
      userId: a.user_id,
      currentFila: a.fila || '',
      currentAssigned: a.assigned_to || a.agente_email || '',
    });
  }, []);

  const { email: currentUserEmail, role: currentUserRole } = useMemo(getAuthInfo, []);

  // Paginação
  const PAGE_SIZE = 30;
  const [page, setPage] = useState(1);

  const fetchAll = useCallback(async ({ fromButton = false } = {}) => {
    try {
      setRefreshing(true);
      const [rt, fs, st] = await Promise.all([
        apiGet('/analytics/realtime'),
        apiGet('/queues'),
        apiGet('/settings'),
      ]);
      if (unmountedRef.current) return; // NEW

      // realtime
      const rtArray = Array.isArray(rt) ? rt : (Array.isArray(rt?.data) ? rt.data : []);
      const formatados = rtArray.map((item) => {
        const inicio = new Date(item.inicioConversa);
        const esperaMinCalc = Math.floor((Date.now() - inicio.getTime()) / 60000);
        const esperaSegApi = Number(item.tempoEspera ?? 0);
        const esperaMinApi = Math.floor(esperaSegApi / 60);
        return {
          ...item,
          inicioConversa: inicio,
          tempoEspera: item.status === 'aguardando' ? esperaMinCalc : esperaMinApi,
        };
      });

      // filas
      const filasIn = Array.isArray(fs) ? fs : (Array.isArray(fs?.data) ? fs.data : []);
      const filasNorm = filasIn
        .map((f) => {
          if (typeof f === 'string') return { nome: f, slug: slugify(f) };
          const nome = f?.nome || f?.name || f?.titulo || '';
          return nome ? { nome, slug: slugify(nome) } : null;
        })
        .filter(Boolean);

      // settings
      const stArr = Array.isArray(st) ? st : (Array.isArray(st?.data) ? st.data : []);
      const kv = Object.fromEntries((stArr || []).map((s) => [String(s.key), String(s.value ?? '')]));

      let overrides = null;
      try {
        if (kv.overrides_por_prioridade_json) {
          overrides = JSON.parse(kv.overrides_por_prioridade_json);
        }
      } catch (e) {
        console.warn('overrides_por_prioridade_json inválido; ignorando.', e);
        overrides = null;
      }
      const habilitar = kv.habilitar_alertas_atendimento === 'true';

      setSettings({ habilitar, overrides });
      setAtendimentos(formatados);
      setFilas(filasNorm);
      setErro(null);
      setCurrentTime(new Date());
      if (fromButton) toast.success('Atualizado com sucesso'); // NEW
    } catch (e) {
      setErro('Falha ao atualizar. Tentaremos novamente em 10s.');
      if (fromButton) toast.error('Não foi possível atualizar agora'); // NEW
    } finally {
      if (!unmountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  const onCloseTransfer = useCallback(() => {
    setTransfer(null);
    fetchAll();
  }, [fetchAll]);

  // polling a cada 10s + pausa quando aba oculta
  useEffect(() => {
    unmountedRef.current = false;
    const run = () => fetchAll();
    run();
    let it = setInterval(run, 10000);

    const onVis = () => {
      if (document.hidden) {
        clearInterval(it);
      } else {
        run();
        it = setInterval(run, 10000);
      }
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      unmountedRef.current = true;
      clearInterval(it);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [fetchAll]);

  // “relógio” leve
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  /* Filtros ------------------------------------------------ */
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
      if (canais.map(c => c.toLowerCase()).includes(String(selectedFilter).toLowerCase()))
        return String(a.canal || '').toLowerCase() === String(selectedFilter).toLowerCase();
      return true;
    });
  }, [atendimentos, selectedFilter, filasParaFiltro]);

  useEffect(() => { setPage(1); }, [selectedFilter, atendimentos]);

  /* KPIs --------------------------------------------------- */
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

  /* ---------- Coloração por /settings ---------- */
  const getGlobalLimits = useCallback(() => {
    if (!settings || !settings.overrides) return null;
    const ov = settings.overrides;
    if (ov.media) return ov.media;
    if (ov.alta)  return ov.alta;
    return null;
  }, [settings]);

  const rowTone = useCallback((a) => {
    if (!settings?.habilitar) return 'none';
    const lim = getGlobalLimits();
    if (!lim) return 'none';
    const minutos = Number(a.tempoEspera || 0);

    if (a.status === 'aguardando') {
      if (minutos >= (lim.espera_inicial * 2)) return 'late';
      if (minutos >= lim.espera_inicial)   return 'warn';
      return 'ok';
    }
    if (a.status === 'em_atendimento') {
      if (minutos >= (lim.demora_durante * 2)) return 'late';
      if (minutos >= lim.demora_durante)   return 'warn';
      return 'ok';
    }
    return 'ok';
  }, [settings, getGlobalLimits]);

  const rowClass = useCallback((a) => {
    const tone = rowTone(a); // ok | warn | late | none
    return `${styles.row} ${styles['tone_' + tone]}`;
  }, [rowTone]);

  /* Paginação derivada */
  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const start = (pageSafe - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const paged = useMemo(() => filtered.slice(start, end), [filtered, start, end]);

  /* Render ------------------------------------------------- */
  return (
    <div className={styles.container}>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <div className={styles.kpillBlue}>Última atualização: {currentTime.toLocaleTimeString('pt-BR')}</div>
          {erro && <div className={styles.kpillAmber}>{erro}</div>}
        </div>
        <button
          className={styles.refreshBtn}
          onClick={() => fetchAll({ fromButton: true })} // NEW
          disabled={refreshing}
          title="Atualizar agora"
        >
          <RefreshCw size={16} className={refreshing ? styles.spinning : ''} />
          Atualizar
        </button>
      </div>

      <div className={styles.subHeader}>
        <div>
          <p className={styles.subtitle}>Operação em tempo real: quem espera, quem respondeu e quem precisa de ajuda.</p>
        </div>
      </div>

      {/* KPIs */}
      <section className={styles.cardGroup}>
        {loading ? (
          <>
            <KpiSkeleton /><KpiSkeleton /><KpiSkeleton />
            <KpiSkeleton /><KpiSkeleton /><KpiSkeleton />
          </>
        ) : (
          <>
            <KpiCard icon={<Clock />} label="Clientes Aguardando" value={stats.clientesAguardando} tone="amber" />
            <KpiCard icon={<MessageCircle />} label="Em Atendimento" value={stats.emAtendimento} tone="green" />
            <KpiCard icon={<User />} label="Atendentes Online" value={stats.atendentesOnline} tone="blue" />
            <KpiCard icon={<Timer />} label="T. Médio Resposta" value={formatTime(stats.tempoMedioResposta)} tone="purple" />
            <KpiCard icon={<CheckCircle />} label="T. Médio Atendimento" value={formatTime(stats.tempoMedioAtendimento)} tone="indigo" />
            <KpiCard icon={<AlertTriangle />} label="T. Médio Aguardando" value={formatTime(stats.tempoMedioAguardando)} tone="orange" />
          </>
        )}
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
                {cap(f)}
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
                title={nome}
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
                title={cap(f)}
              >
                {cap(f)}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Tabela */}
      <section className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <h2 className={styles.tableTitle}>Atendimentos em Tempo Real <span className={styles.kpill}>{totalItems}</span></h2>
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
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`sk-${i}`} className={styles.skelRow}>
                    <td colSpan={8}><div className={styles.skeletonRow}/></td>
                  </tr>
                ))
              ) : paged.length === 0 ? (
                <tr><td colSpan={8} className={styles.emptyCell}>Sem atendimentos no filtro atual.</td></tr>
              ) : paged.map((a) => (
                <tr key={a.id} className={rowClass(a)}>
                  <td>
                    <div className={styles.clientCell}>
                      <div className={styles.avatar}><User size={14} /></div>
                      <div>
                        <div className={styles.clientName}>{a.cliente}</div>
                        <div className={styles.clientSub}>Ticket: #{a.ticket_number}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className={styles.queuePill}>{a.fila || '—'}</span></td>
                  <td>
                    {(() => {
                      const canalSlug = String(a.canal || 'default').toLowerCase();
                      return (
                        <span
                          className={`${styles.channelPill} ${styles[`ch_${canalSlug}`]}`}
                          title={cap(a.canal || '—')}
                          aria-label={cap(a.canal || '—')}
                        >
                          {channelIcon(a.canal)}
                          <span className={styles.srOnly}>{cap(a.canal || '—')}</span>
                        </span>
                      );
                    })()}
                  </td>
                  <td>{a.agente ? a.agente : <em className={styles.muted}>Não atribuído</em>}</td>
                  <td>
                    <span className={`${styles.status} ${
                      a.status === 'aguardando' ? styles.statusWait :
                      a.status === 'em_atendimento' ? styles.statusLive : styles.statusDone
                    }`}>
                      {a.status === 'aguardando' && <Clock size={12} className={styles.statusIcon} />}
                      {a.status === 'em_atendimento' && <CheckCircle size={12} className={styles.statusIcon} />}
                      {cap(a.status || '—')}
                    </span>
                  </td>
                  <td>
                    <div className={styles.bold}>{formatTime(a.tempoEspera)}</div>
                    <div className={styles.subtle}>
                      Início: {a?.inicioConversa instanceof Date && !isNaN(a.inicioConversa)
                        ? a.inicioConversa.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                        : '--:--'}
                    </div>
                  </td>
                  <td className={styles.actionsCell}>
                    <button
                      className={styles.linkBtn}
                      aria-label="Visualizar conversa"
                      title="Visualizar conversa"
                      onClick={() => setPreview({
                        userId: a.user_id,
                        cliente: a.cliente,
                        canal: a.canal
                      })}
                    >
                      <Eye size={16} />
                    </button>

                    <button
                      className={styles.linkBtnDanger}
                      aria-label="Transferir"
                      title="Transferir"
                      onClick={() => onOpenTransfer(a)}
                    >
                      <ArrowLeftRight size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        <div className={styles.pagination}>
          <button
            className={styles.pageBtn}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={pageSafe <= 1}
            aria-label="Página anterior"
            title="Página anterior"
          >
            ‹ Anterior
          </button>

          <span className={styles.pageInfo}>
            Página {pageSafe} de {totalPages} • {totalItems} registro(s)
          </span>

          <button
            className={styles.pageBtn}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={pageSafe >= totalPages}
            aria-label="Próxima página"
            title="Próxima página"
          >
            Próxima ›
          </button>
        </div>
      </section>

      {/* Modal de Transferência */}
      {transfer && (
        <TransferModal
          userId={transfer.userId}
          currentFila={transfer.currentFila}
          currentAssigned={transfer.currentAssigned}
          userEmail={currentUserEmail}
          userRole={currentUserRole}
          onClose={onCloseTransfer}
          onDone={fetchAll}
        />
      )}

      {/* Drawer do mini-chat */}
      <MiniChatDrawer
        open={!!preview}
        onClose={() => setPreview(null)}
        userId={preview?.userId}
        cliente={preview?.cliente}
        canal={preview?.canal}
        variant="webchat"
      />
    </div>
  );
}

/* Subcomponents ------------------------------------------- */
function KpiCard({ icon, label, value, tone = 'blue' }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <div className={styles.cardTitle}>
          <span className={styles.cardIcon}>{icon}</span>
          <span>{label}</span>
        </div>
      </div>
      <div className={styles.cardBody}>
        <div className={`${styles.kpiValue} ${styles[`tone_${tone}`]}`}>{value}</div>
      </div>
    </div>
  );
}
function KpiSkeleton() {
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <div className={styles.cardTitle}>
          <span className={`${styles.skeleton} ${styles.sq16}`} />
          <span className={`${styles.skeleton} ${styles.sq120}`} />
        </div>
      </div>
      <div className={styles.cardBody}>
        <div className={`${styles.skeleton} ${styles.sq48}`} />
      </div>
    </div>
  );
}
