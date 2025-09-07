import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiGet } from '../../../shared/apiClient';
import {
  Clock, User, MessageCircle, AlertTriangle, CheckCircle, Timer,
  Headset, RefreshCw, Eye, ArrowLeftRight
} from 'lucide-react';
import MiniChatDrawer from './MiniChatDrawer';
import styles from './styles/ClientsMonitor.module.css';

/* Utils ---------------------------------------------------- */
const slugify = (str = '') =>
  String(str)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim()
    .replace(/\s+/g, '_').replace(/[^\w_]/g, '');

const canais = ['Whatsapp', 'Telegram', 'Webchat', 'Instagram', 'Facebook'];

/* Tiny helpers */
const cap = (s='') => s.replace('_', ' ')
  .replace(/^\w/u, c => c.toUpperCase());

const formatTime = (m = 0) => {
  const mins = Math.max(0, Math.floor(m));
  const h = Math.floor(mins / 60);
  const r = mins % 60;
  return h > 0 ? `${h}h ${r}m` : `${r}m`;
};

/* Component ------------------------------------------------ */
export default function ClientsMonitor() {
  // Settings carregados da API (com defaults)
  const [settings, setSettings] = useState<{
    habilitar: boolean;
    overrides: Record<string, { espera_inicial: number; demora_durante: number }>;
  }>({
    habilitar: true,
    overrides: {
      alta:  { espera_inicial: 5,  demora_durante: 10 },
      media: { espera_inicial: 15, demora_durante: 20 },
    }
  });

  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedFilter, setSelectedFilter] = useState('todos');
  const [atendimentos, setAtendimentos] = useState<any[]>([]);
  const [filas, setFilas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [preview, setPreview] = useState<any>(null);

  const fetchAll = useCallback(async () => {
    setRefreshing(true);
    try {
      const [rt, fs, st] = await Promise.all([
        apiGet('/analytics/realtime'),
        apiGet('/filas'),
        apiGet('/settings'),
      ]);

      // realtime
      const rtArray = Array.isArray(rt) ? rt : (Array.isArray(rt?.data) ? rt.data : []);
      const formatados = rtArray.map((item: any) => {
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
        .map((f: any) => {
          if (typeof f === 'string') return { nome: f, slug: slugify(f) };
          const nome = f?.nome || f?.name || f?.titulo || '';
          return nome ? { nome, slug: slugify(nome) } : null;
        })
        .filter(Boolean) as any[];

      // settings
      const stArr = Array.isArray(st) ? st : (Array.isArray(st?.data) ? st.data : []);
      const kv: Record<string, string> = Object.fromEntries(
        (stArr || []).map((s: any) => [String(s.key), String(s.value ?? '')])
      );

      let overrides = settings.overrides;
      try {
        if (kv.overrides_por_prioridade_json) {
          overrides = JSON.parse(kv.overrides_por_prioridade_json);
        }
      } catch {
        // mantém defaults em caso de JSON inválido
      }
      const habilitar = kv.habilitar_alertas_atendimento
        ? kv.habilitar_alertas_atendimento === 'true'
        : settings.habilitar;

      setSettings({ habilitar, overrides });
      setAtendimentos(formatados);
      setFilas(filasNorm);
      setErro(null);
      setCurrentTime(new Date());
    } catch (e) {
      console.error('Erro ao buscar dados:', e);
      setErro('Falha ao atualizar. Tentaremos novamente em 10s.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [settings.habilitar, settings.overrides]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!mounted) return;
      await fetchAll();
    };
    run();
    const interval = setInterval(run, 10000);
    return () => { mounted = false; clearInterval(interval); };
  }, [fetchAll]);

  /* Filtros ------------------------------------------------ */
  const filasParaFiltro = filas.length
    ? filas
    : Array.from(new Set(atendimentos.map((a) => a.fila).filter(Boolean)))
        .map((nome) => ({ nome, slug: slugify(String(nome)) }));

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

  /* ---------- ALERTING POR COR (inline) ---------- */
  // pega limites por prioridade com fallback
/* ---------- ALERTING POR COR (via classe CSS) ---------- */

// pega os limites "globais": usa 'media' (fallback para 'alta')
const getGlobalLimits = useCallback(() => {
  const ov = settings.overrides || {};
  if (ov.media) return ov.media;
  if (ov.alta)  return ov.alta;
  // fallback duro se não houver json válido
  return { espera_inicial: 15, demora_durante: 20 };
}, [settings.overrides]);

// decide o tom da linha usando os limites globais
const rowTone = useCallback((a) => {
  if (!settings.habilitar) return 'none';
  const lim = getGlobalLimits();
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
}, [settings.habilitar, getGlobalLimits]);

// monta a classe da <tr>
const rowClass = useCallback((a) => {
  const tone = rowTone(a); // ok | warn | late | none
  return `${styles.row} ${styles['tone_' + tone]}`;
}, [rowTone]);

// contador para o chip de alerta no header
const alertCount = useMemo(
  () => atendimentos.filter(a => ['warn','late'].includes(rowTone(a))).length,
  [atendimentos, rowTone]
);


  /* Render ------------------------------------------------- */
  return (
    <div className={styles.container}>

      {/* Header com último update e refresh */}
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <div className={styles.kpillBlue}>Última atualização: {currentTime.toLocaleTimeString('pt-BR')}</div>
          {alertCount > 0 && (
            <div className={styles.kpillAmber}>
              <AlertTriangle size={14}/> {alertCount} alerta(s)
            </div>
          )}
        </div>
        <button
          className={styles.refreshBtn}
          onClick={fetchAll}
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
          <h2 className={styles.tableTitle}>Atendimentos em Tempo Real <span className={styles.kpill}>{filtered.length}</span></h2>
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
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className={styles.emptyCell}>Sem atendimentos no filtro atual.</td></tr>
              ) : filtered.map((a) => (
                <tr key={a.id} style={rowClass(a)}>
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
                    <span className={`${styles.channelPill} ${styles[`ch_${a.canal || 'default'}`]}`}>
                      {cap(a.canal || '—')}
                    </span>
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
                      Início: {a?.inicioConversa instanceof Date && !isNaN(a.inicioConversa as any)
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
                    >
                      <ArrowLeftRight size={16} />
                    </button>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* (Removido) Alertas rápidos em texto */}
      {/* Pintura por cor substitui este bloco */}

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
function KpiCard({ icon, label, value, tone = 'blue' }: any) {
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
