import React, { useEffect, useRef, useState } from 'react';
import { apiGet } from '../../../shared/apiClient';
import OmnichannelDashboard from './OmnichannelDashboard';

export default function TempoReal() {
  const [data, setData] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const timerRef = useRef(null);

  async function carregar(signal) {
    try {
      setErro(null);

      // A API pode retornar diretamente um array ou um objeto { data: [...] }
      const res = await apiGet('/analytics/realtime');
      const arr = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];

      // normalização: tempoEspera (segundos -> minutos) e inicioConversa -> Date
      const normalizado = arr.map((item) => ({
        ...item,
        tempoEspera: Math.floor(Number(item?.tempoEspera || 0) / 60),
        inicioConversa: item?.inicioConversa ? new Date(item.inicioConversa) : null,
      }));

      setData(normalizado);
      setLastUpdated(new Date());
    } catch (e) {
      if (e?.name === 'AbortError') return;
      console.error('[TempoReal] falha ao buscar /analytics/realtime:', e);
      setErro('Não foi possível carregar os dados agora.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const ctrl = new AbortController();
    carregar(ctrl.signal);

    // refresh automático a cada 10s
    timerRef.current = setInterval(() => {
      const c = new AbortController();
      carregar(c.signal);
    }, 10000);

    return () => {
      ctrl.abort();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

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
            onClick={() => {
              setLoading(true);
              const c = new AbortController();
              carregar(c.signal);
            }}
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return <OmnichannelDashboard data={data} lastUpdated={lastUpdated} />;
}
