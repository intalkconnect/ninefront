import React, { useEffect, useState, useRef } from 'react';
import OmnichannelDashboard from './OmnichannelDashboard';
import { apiGet } from '../../../shared/apiClient';

export default function TempoReal() {
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const timerRef = useRef(null);

  async function carregar(signal) {
    try {
      setErro(null);
      const res = await apiGet('/analytics/realtime', { signal });
      setDados(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      if (e.name === 'AbortError') return;
      console.error('[TempoReal] erro', e);
      setErro('Falha ao buscar dados');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    carregar(controller.signal);

    timerRef.current = setInterval(() => {
      const c = new AbortController();
      carregar(c.signal);
    }, 10000);

    return () => {
      controller.abort();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  if (loading) return <div className="p-6">Carregando dados...</div>;
  if (erro) return <div className="p-6 text-red-600">{erro}</div>;

  return <OmnichannelDashboard atendimentos={dados} />;
}
