import React, { useEffect, useState } from 'react';
import { X, Save, Plus, Trash2, TestTube2 } from 'lucide-react';
import { apiGet, apiPost } from '../../../shared/apiClient';
import styles from './styles/Filas.module.css';

const WEEK = [
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
  { value: 7, label: 'Domingo' },
];

function sortWeekly(arr) {
  return [...arr].sort((a, b) => a.weekday - b.weekday);
}

export default function QueueHoursModal({ queueName, onClose, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState(null);
  const [okMsg, setOkMsg]     = useState(null);

  // estado do formulário
  const [enabled, setEnabled] = useState(true);
  const [tz, setTz] = useState('America/Sao_Paulo');
  const [preMsg, setPreMsg] = useState('');
  const [offMsg, setOffMsg] = useState('');
  const [weekly, setWeekly] = useState([]); // [{weekday, windows:[{start,end}]}]
  const [holidays, setHolidays] = useState([]); // [{date,name}]

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet(`/queues/${encodeURIComponent(queueName)}/hours`);
      setEnabled(!!data.enabled);
      setTz(data.tz || 'America/Sao_Paulo');
      setPreMsg(data.pre_service_message || '');
      setOffMsg(data.offhours_message || '');
      setWeekly(sortWeekly(Array.isArray(data.weekly) ? data.weekly : []));
      setHolidays(Array.isArray(data.holidays) ? data.holidays : []);
    } catch (e) {
      console.error(e);
      setError('Falha ao carregar horários desta fila.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [queueName]);

  const addWindow = (weekday) => {
    setWeekly((prev) => {
      const idx = prev.findIndex(d => d.weekday === weekday);
      if (idx === -1) return sortWeekly([...prev, { weekday, windows: [{ start: '09:00', end: '18:00' }] }]);
      const copy = [...prev];
      copy[idx] = { ...copy[idx], windows: [...copy[idx].windows, { start: '09:00', end: '18:00' }] };
      return sortWeekly(copy);
    });
  };

  const removeWindow = (weekday, winIdx) => {
    setWeekly((prev) => {
      const idx = prev.findIndex(d => d.weekday === weekday);
      if (idx === -1) return prev;
      const wins = [...prev[idx].windows];
      wins.splice(winIdx, 1);
      const copy = [...prev];
      copy[idx] = { ...copy[idx], windows: wins };
      return sortWeekly(copy);
    });
  };

  const changeWindow = (weekday, winIdx, field, value) => {
    setWeekly((prev) => {
      const idx = prev.findIndex(d => d.weekday === weekday);
      if (idx === -1) return prev;
      const wins = [...prev[idx].windows];
      wins[winIdx] = { ...wins[winIdx], [field]: value };
      const copy = [...prev];
      copy[idx] = { ...prev[idx], windows: wins };
      return sortWeekly(copy);
    });
  };

  const addHoliday = () => {
    setHolidays(h => [...h, { date: '', name: '' }]);
  };
  const changeHoliday = (i, field, value) => {
    setHolidays((prev) => {
      const c = [...prev];
      c[i] = { ...c[i], [field]: value };
      return c;
    });
  };
  const removeHoliday = (i) => {
    setHolidays((prev) => {
      const c = [...prev];
      c.splice(i, 1);
      return c;
    });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await apiPost(`/queues/${encodeURIComponent(queueName)}/hours`, {
        tz,
        enabled,
        pre_service_message: preMsg,
        offhours_message: offMsg,
        weekly,
        holidays,
      });
      setOkMsg('Salvo com sucesso.');
      setTimeout(() => setOkMsg(null), 1500);
      onSaved?.();
    } catch (e) {
      console.error(e);
      setError('Falha ao salvar horários.');
    } finally {
      setSaving(false);
    }
  };

  const testNow = async () => {
    setError(null);
    try {
      const res = await apiPost(`/queues/${encodeURIComponent(queueName)}/hours/test`, {});
      const label =
        res.reason === 'holiday'
          ? 'Feriado'
          : res.reason === 'open'
          ? 'Aberto'
          : 'Fechado';
      const nextLabel = res.next_open_local ? ` • Próxima abertura: ${res.next_open_local} (${res.local_tz})` : '';
      setOkMsg(`${label}${nextLabel}`);
      setTimeout(() => setOkMsg(null), 2400);
    } catch (e) {
      console.error(e);
      setError('Não foi possível testar agora.');
    }
  };

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modalCardLarge}>
        <div className={styles.modalHead}>
          <h3 className={styles.modalTitle}>Configurar horário — <strong>{queueName}</strong></h3>
          <button className={styles.iconBtn} onClick={onClose} title="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className={styles.modalBody}>
          {loading ? (
            <div className={styles.loading}>Carregando…</div>
          ) : (
            <>
              {error && <div className={styles.alertErr}>{error}</div>}
              {okMsg && <div className={styles.alertOk}>{okMsg}</div>}

              <div className={styles.formRow}>
                <label className={styles.inlineLabel}>Ativar regras</label>
                <select
                  className={styles.input}
                  value={enabled ? 'true' : 'false'}
                  onChange={(e) => setEnabled(e.target.value === 'true')}
                >
                  <option value="true">Ativado</option>
                  <option value="false">Desativado</option>
                </select>
              </div>

              <div className={styles.formRow}>
                <label className={styles.inlineLabel}>Timezone</label>
                <input
                  className={styles.input}
                  placeholder="Ex.: America/Sao_Paulo"
                  value={tz}
                  onChange={(e) => setTz(e.target.value)}
                />
              </div>

              <div className={styles.formRow}>
                <label className={styles.inlineLabel}>Mensagem antes do atendimento</label>
                <textarea
                  className={styles.textarea}
                  rows={2}
                  placeholder="Ex.: Um momento, vou te conectar a um atendente…"
                  value={preMsg}
                  onChange={(e) => setPreMsg(e.target.value)}
                />
              </div>

              <div className={styles.formRow}>
                <label className={styles.inlineLabel}>Mensagem fora do expediente</label>
                <textarea
                  className={styles.textarea}
                  rows={2}
                  placeholder="Ex.: Estamos fora do horário de atendimento. Voltamos às 09:00."
                  value={offMsg}
                  onChange={(e) => setOffMsg(e.target.value)}
                />
              </div>

              <hr className={styles.sep} />

              <h4 className={styles.sectionTitle}>Janelas por dia</h4>
              <div className={styles.weekGrid}>
                {WEEK.map(d => {
                  const day = weekly.find(w => w.weekday === d.value) || { weekday: d.value, windows: [] };
                  return (
                    <div key={d.value} className={styles.dayCard}>
                      <div className={styles.dayHead}>
                        <strong>{d.label}</strong>
                        <button className={styles.btnTiny} onClick={() => addWindow(d.value)}>
                          <Plus size={14}/> Adicionar janela
                        </button>
                      </div>
                      {day.windows.length === 0 ? (
                        <div className={styles.emptySmall}>Sem janelas.</div>
                      ) : (
                        day.windows.map((w, i) => (
                          <div key={i} className={styles.windowRow}>
                            <input
                              type="time"
                              value={w.start}
                              className={styles.inputTime}
                              onChange={(e) => changeWindow(d.value, i, 'start', e.target.value)}
                            />
                            <span className={styles.to}>até</span>
                            <input
                              type="time"
                              value={w.end}
                              className={styles.inputTime}
                              onChange={(e) => changeWindow(d.value, i, 'end', e.target.value)}
                            />
                            <button className={styles.iconBtn} onClick={() => removeWindow(d.value, i)} title="Remover">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  );
                })}
              </div>

              <hr className={styles.sep} />

              <h4 className={styles.sectionTitle}>Feriados</h4>
              {holidays.length === 0 && <div className={styles.emptySmall}>Nenhum feriado.</div>}
              {holidays.map((h, i) => (
                <div key={i} className={styles.holidayRow}>
                  <input
                    type="date"
                    className={styles.input}
                    value={h.date || ''}
                    onChange={(e) => changeHoliday(i, 'date', e.target.value)}
                  />
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="Nome (opcional)"
                    value={h.name || ''}
                    onChange={(e) => changeHoliday(i, 'name', e.target.value)}
                  />
                  <button className={styles.iconBtn} onClick={() => removeHoliday(i)} title="Remover feriado">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <button className={styles.btnTiny} onClick={addHoliday}>
                <Plus size={14}/> Adicionar feriado
              </button>
            </>
          )}
        </div>

        <div className={styles.modalFoot}>
          <button className={styles.btnGhost} onClick={testNow} title="Testar status agora">
            <TestTube2 size={16}/> Testar agora
          </button>
          <div style={{flex:1}} />
          <button className={styles.btnGhost} onClick={onClose}>Cancelar</button>
          <button className={styles.btnPrimary} onClick={save} disabled={saving}>
            <Save size={16}/> {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
