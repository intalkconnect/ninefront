// DetailsPanel.jsx
import React, { useState, useEffect } from 'react';
import {
  Mail,
  Phone,
  IdCard,
  MapPin
} from 'lucide-react';
import './DetailsPanel.css';

export default function DetailsPanel({ userIdSelecionado, conversaSelecionada }) {
  const [activeTab, setActiveTab] = useState('informacoes');
  const [comentario, setComentario] = useState('');

  useEffect(() => {
    setActiveTab('informacoes');
    setComentario('');
  }, [userIdSelecionado]);

  if (!userIdSelecionado || !conversaSelecionada) {
    return (
      <div className="details-panel-empty">
        <p>Selecione um contato</p>
      </div>
    );
  }

  const nome = conversaSelecionada.name || 'Usuário';
  const inicial = nome.charAt(0).toUpperCase();

  const renderInformacoes = () => (
    <div className="info-section">
      <div className="avatar-circle">{inicial}</div>
      <h2 className="contact-name">{nome}</h2>

      <div className="info-item">
        <Mail className="icon" size={16} />
        <span>{conversaSelecionada.email || 'Não informado'}</span>
      </div>

      <div className="info-item">
        <Phone className="icon" size={16} />
        <span>{conversaSelecionada.phone || 'Não informado'}</span>
      </div>

      {conversaSelecionada.documento && (
        <div className="info-item">
          <IdCard className="icon" size={16} />
          <span>{conversaSelecionada.documento}</span>
        </div>
      )}

      {conversaSelecionada.localizacao && (
        <div className="info-item">
          <MapPin className="icon" size={16} />
          <span>{conversaSelecionada.localizacao}</span>
        </div>
      )}

      <div className="comentario-area">
        <textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Escreva um comentário sobre este contato..."
        />
        <button
          onClick={() => {
            if (comentario.trim()) {
              alert('Comentário enviado: ' + comentario);
              setComentario('');
            }
          }}
        >
          Enviar comentário
        </button>
      </div>
    </div>
  );

  const renderHistorico = () => {
    const history = conversaSelecionada.ticket_history || [];
    if (history.length === 0) return <p className="empty">Nenhum histórico encontrado.</p>;

    return (
      <ul className="history-list">
        {history.map((ticket, idx) => (
          <li key={ticket.id || idx} className="ticket-card">
            <h4>{ticket.titulo}</h4>
            <p><strong>Status:</strong> {ticket.status}</p>
            <p><strong>Data:</strong> {new Date(ticket.data).toLocaleDateString()}</p>
            {ticket.descricao && <p><strong>Descrição:</strong> {ticket.descricao}</p>}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="details-panel-container">
      <div className="tabs">
        <button className={activeTab === 'informacoes' ? 'active' : ''} onClick={() => setActiveTab('informacoes')}>Informações</button>
        <button className={activeTab === 'historico' ? 'active' : ''} onClick={() => setActiveTab('historico')}>Histórico</button>
      </div>
      <div className="tab-content">
        {activeTab === 'informacoes' ? renderInformacoes() : renderHistorico()}
      </div>
    </div>
  );
}
