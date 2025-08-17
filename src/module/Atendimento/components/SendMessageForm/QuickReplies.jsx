import React, { useState, useEffect, forwardRef, useRef } from 'react';
import { apiGet } from '../../../../shared/apiClient';
import './QuickReplies.css';

/**
 * Dropdown de respostas rápidas.
 * - Busca do backend em /quick_replies
 * - Campo de pesquisa por título/conteúdo
 * - Fecha ao clicar fora ou pressionar ESC
 */
const QuickReplies = forwardRef(({ onSelect, onClose }, ref) => {
  const innerRef = useRef(null);
  const containerRef = ref || innerRef; // garante referência sempre presente

  const [quickReplies, setQuickReplies] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  /* carregamento inicial */
  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet('/quickReplies');
        setQuickReplies(data);
      } catch (err) {
        console.error('Erro ao carregar quick replies:', err);
      }
    })();
  }, []);

  /* clique fora / ESC para fechar */
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        onClose?.();
      }
    };
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose, containerRef]);

  const filtered = quickReplies.filter((qr) => {
    const term = searchTerm.toLowerCase();
    return qr.title.toLowerCase().includes(term) || qr.content.toLowerCase().includes(term);
  });

  const choose = (qr) => {
    onSelect(qr);
    onClose?.();
  };

  return (
    <div className="quick-replies-wrapper" ref={containerRef}>
      <input
        type="text"
        className="quick-replies-search"
        placeholder="Buscar resposta rápida..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      <ul className="quick-replies-list">
        {filtered.map((qr) => (
          <li key={qr.id} onClick={() => choose(qr)}>
            <strong>{qr.title}</strong>
            <p>{qr.content}</p>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="no-results">Nenhum resultado encontrado</li>
        )}
      </ul>
    </div>
  );
});

export default QuickReplies;
