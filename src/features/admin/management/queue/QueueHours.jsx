import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Plus, Trash2, Save } from 'lucide-react';
import { apiGet, apiPut } from '../../../../shared/apiClient';
import { toast } from 'react-toastify';
import css from './styles/QueueHours.module.css';

const WDAYS = [
  { key: 'mon', label: 'Segunda' },
  { key: 'tue', label: 'Terça' },
  { key: 'wed', label: 'Quarta' },
  { key: 'thu', label: 'Quinta' },
  { key: 'fri', label: 'Sexta' },
  { key: 'sat', label: 'Sábado' },
  { key: 'sun', label: 'Domingo' },
];

function emptyWindows(){ return { mon:[], tue:[], wed:[], thu:[], fri:[], sat:[], sun:[] }; }
function weeklyToWindows(weekly = []) {
  const map = { 1:'mon', 2:'tue', 3:'wed', 4:'thu', 5:'fri', 6:'sat', 7:'sun' };
  const out = emptyWindows();
  for (const d of weekly || []) {
    const k = map[d.weekday];
    if (!k) continue;
    const wins = Array.isArray(d.windows) ? d.windows : [];
    out[k] = wins.map(w => ({ start: w.start, end: w.end }));
  }
  return out;
}
function normalizeIncoming(data = {}) {
  return {
    enabled: Boolean(data?.enabled ?? true),
    timezone: data?.timezone || data?.tz || 'America/Sao_Paulo',
    pre_message: data?.pre_message ?? data?.pre_service_message ?? '',
    off_message: data?.off_message ?? data?.offhours_message ?? '',
    windows: data?.windows || weeklyToWindows(data?.weekly || []),
    holidays: Array.isArray(data?.holidays) ? data.holidays : [],
  };
}
function validateWindows(windows) {
  const toMin = (hhmm) => {
    const m = /^(\d{2}):(\d{2})$/.exec(hhmm || '');
    if (!m) return NaN;
    const hh = Number(m[1]), mm = Number(m[2]);
    return hh * 60 + mm;
  };
  for (const day of Object.keys(windows)) {
    for (const win of windows[day]) {
      const a = toMin(win.start);
      const b = toMin(win.end);
      if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) {
        return `Verifique os horários de ${day.toUpperCase()}: "${win.start} — ${win.end}"`;
      }
    }
  }
  return null;
}

export default function QueueHours() {
  const { name } = useParams(); // usamos 'name' porque seu backend atual é por nome
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [enabled, setEnabled] = useState(true);
  const [tz, setTz] = useState('America/Sao_Paulo');
  const [preMsg, setPreMsg] = useState('');
  const [offMsg, setOffMsg] = useState('');
  const [windows, setWindows] = useState(emptyWindows());
  const [holidays, setHolidays] = useState([]);

  useEffect(() => {
    (async () => {
      setLoading(true); setErr(null);
      try {
        const data = await apiGet(`/queue-hours/${encodeURIComponent(name)}/hours`);
        const norm = normalizeIncoming(data);
        setEnabled(norm.enabled);
        setTz(norm.timezone);
        setPreMsg(norm.pre_message);
        setOffMsg(norm.off_message);
        setWindows({ ...emptyWindows(), ...(norm.windows || {}) });
        setHolidays(norm.holidays);
      } catch (e) {
        console.error(e);
        setErr('Falha ao carregar horários desta fila.');
        toast.error('Falha ao carregar horários desta fila.');
      } finally {
        setLoading(false);
      }
    })();
  }, [name]);

  const addWindow = (dayKey) => {
    setWindows((w) => ({ ...w, [dayKey]: [...(w[dayKey]||[]), { start:'09:00', end:'18:00' }] }));
  };
  const updateWindow = (dayKey, idx, field, value) => {
    setWindows((w) => {
      const arr = [...(w[dayKey]||[])];
      arr[idx] = { ...arr[idx], [field]: value };
      return { ...w, [dayKey]: arr };
    });
  };
  const removeWindow = (dayKey, idx) => {
    setWindows((w) => {
      const arr = [...(w[dayKey]||[])];
      arr.splice(idx,1);
      return { ...w, [dayKey]: arr };
    });
  };

  const addHoliday = () => setHolidays((h)=>[...h, { date:'', name:'' }]);
  const updateHoliday = (i, field, value) => {
    setHolidays((h)=>{ const arr=[...h]; arr[i]={...arr[i], [field]:value}; return arr; });
  };
  const removeHoliday = (i) => setHolidays((h)=>h.filter((_,idx)=>idx!==i));

  const saving = useMemo(() => loading, [loading]);

  const save = async () => {
    setLoading(true); setErr(null);
    try {
      const vErr = validateWindows(windows);
      if (vErr) {
        setErr(vErr);
        setLoading(false);
        toast.warn(vErr);
        return;
      }
      await apiPut(`/queue-hours/${encodeURIComponent(name)}/hours`, {
        enabled,
        timezone: tz,
        pre_message: preMsg,
        off_message: offMsg,
        windows,
        holidays,
      });
      toast.success('Configurações salvas.');
      navigate('/management/queues');
    } catch (e) {
      console.error(e);
      setErr('Erro ao salvar configurações.');
      toast.error('Erro ao salvar configurações.');
      setLoading(false);
    }
  };

  return (
    <div className={css.page}>
      {/* Breadcrumbs */}
      <nav className={css.breadcrumbs} aria-label="Breadcrumb">
        <ol className={css.bcList}>
          <li><Link to="/" className={css.bcLink}>Dashboard</Link></li>
          <li className={css.bcSep}>/</li>
          <li><Link to="/management/queues" className={css.bcLink}>Filas</Link></li>
          <li className={css.bcSep}>/</li>
          <li><span className={css.bcCurrent}>Horários — {name}</span></li>
        </ol>
      </nav>

      <header className={css.pageHeader}>
        <div className={css.pageTitleWrap}>
          <h1 className={css.pageTitle}>Horários & Feriados</h1>
          <p className={css.pageSubtitle}>Configure janelas de atendimento e mensagens automáticas.</p>
        </div>
      </header>

      {err && <div className={css.alertErr}>{err}</div>}

      {/* Seção regras/timezone */}
      <section className={css.card}>
        <div className={css.cardHead}>
          <h2 className={css.cardTitle}>Regras</h2>
          <p className={css.cardDesc}>Ativação e fuso.</p>
        </div>
        <div className={css.cardBody}>
          <div className={css.inlineRow}>
            <div className={css.inlineItem}>
              <span className={css.inlineLabel}>Ativar regras</span>
              <label className={css.switch}>
                <input type="checkbox" checked={enabled} onChange={(e)=>setEnabled(e.target.checked)} />
                <span className={css.slider}/>
              </label>
            </div>
            <div className={css.inlineItem}>
              <span className={css.inlineLabel}>Timezone</span>
              <span className={css.tzTag}>{tz}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Mensagens */}
      <section className={css.card}>
        <div className={css.cardHead}>
          <h2 className={css.cardTitle}>Mensagens</h2>
          <p className={css.cardDesc}>Enviadas antes do atendimento e fora do expediente.</p>
        </div>
        <div className={css.cardBody}>
          <div className={css.fieldRow}>
            <label>Mensagem antes do atendimento</label>
            <textarea
              className={css.textarea}
              rows={2}
              value={preMsg}
              onChange={(e)=>setPreMsg(e.target.value)}
              placeholder="Ex.: Um momento, vou te conectar a um atendente…"
            />
          </div>
          <div className={css.fieldRow}>
            <label>Mensagem fora do expediente</label>
            <textarea
              className={css.textarea}
              rows={2}
              value={offMsg}
              onChange={(e)=>setOffMsg(e.target.value)}
              placeholder="Ex.: Estamos fora do horário de atendimento. Voltamos às 09:00."
            />
          </div>
        </div>
      </section>

      {/* Janelas */}
      <section className={css.card}>
        <div className={css.cardHead}>
          <h2 className={css.cardTitle}>Janelas por dia</h2>
          <p className={css.cardDesc}>Defina intervalos de atendimento (HH:MM).</p>
        </div>
        <div className={css.cardBody}>
          <div className={css.dayTable}>
            {WDAYS.map(({key,label}) => (
              <div key={key} className={css.dayRow}>
                <div className={css.dayLabel}>{label}</div>
                <div className={css.dayWindows}>
                  {(windows[key] || []).length === 0 && (
                    <div className={css.emptyRow}>Sem janelas.</div>
                  )}
                  {(windows[key] || []).map((w, idx) => (
                    <div key={idx} className={css.win}>
                      <input
                        type="time"
                        value={w.start || ''}
                        onChange={(e)=>updateWindow(key, idx, 'start', e.target.value)}
                        className={css.time}
                      />
                      <span className={css.dash}>—</span>
                      <input
                        type="time"
                        value={w.end || ''}
                        onChange={(e)=>updateWindow(key, idx, 'end', e.target.value)}
                        className={css.time}
                      />
                      <button
                        className={`${css.iconBtn} ${css.danger}`}
                        onClick={()=>removeWindow(key, idx)}
                        title="Remover janela"
                      >
                        <Trash2 size={16}/>
                      </button>
                    </div>
                  ))}
                  <button
                    className={`${css.iconBtn} ${css.add}`}
                    onClick={()=>addWindow(key)}
                    title="Adicionar janela"
                  >
                    <Plus size={16}/>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feriados */}
      <section className={css.card}>
        <div className={css.cardHead}>
          <h2 className={css.cardTitle}>Feriados</h2>
          <p className={css.cardDesc}>Datas em que a fila não atende.</p>
        </div>
        <div className={css.cardBody}>
          {holidays.length === 0 && <div className={css.emptyRow}>Nenhum feriado.</div>}
          {holidays.map((h, i) => (
            <div key={i} className={css.holidayRow}>
              <input
                type="date"
                value={h.date || ''}
                onChange={(e)=>updateHoliday(i, 'date', e.target.value)}
                className={css.input}
                style={{maxWidth: 180}}
              />
              <input
                type="text"
                value={h.name || ''}
                onChange={(e)=>updateHoliday(i, 'name', e.target.value)}
                placeholder="Descrição (opcional)"
                className={css.input}
                style={{flex:1, maxWidth: 520}}
              />
              <button
                className={`${css.iconBtn} ${css.danger}`}
                onClick={()=>removeHoliday(i)}
                title="Remover"
              >
                <Trash2 size={16}/>
              </button>
            </div>
          ))}
              <button
                type="button"
                className={css.btnSecondary}
                onClick={addHoliday}
              >
                <Plus size={16} aria-hidden="true" />
                Adicionar feriado
              </button>
        </div>
      </section>

      {/* Rodapé fixo */}
      <div className={css.stickyFooter}>
        <div className={css.stickyInner}>
          <button className={css.btnGhost} onClick={() => navigate('/management/queues')}>Cancelar</button>
          <button className={css.btnPrimary} onClick={save} disabled={saving}>
            <Save size={16}/> Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
