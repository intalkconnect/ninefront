import React from 'react';
import { Mail, Phone, IdCard, IdCardLanyard } from 'lucide-react';
import './DetailsPanel.css';
import { stringToColor } from '../../utils/color';

export default function DetailsPanel({ userIdSelecionado, conversaSelecionada }) {
  if (!userIdSelecionado) {
    return (
      <div className="details-panel-container">
        <p className="loading">Nenhum cliente selecionado</p>
      </div>
    );
  }

  if (!conversaSelecionada) {
    return (
      <div className="details-panel-container">
        <p className="loading">Sem dados de conversa</p>
      </div>
    );
  }

  const nome = conversaSelecionada.name || 'Não identificado';
  const inicial = nome.charAt(0).toUpperCase();
  const documento = conversaSelecionada.documento;
  const isLoading = !documento && !conversaSelecionada.email;

  // Mock: substitua pelos campos reais conforme seu back-end
  const lifetimeValue = conversaSelecionada.lifetimeValue || 'R$0';
  const totalOrderCount = conversaSelecionada.totalOrderCount || 0;
  const customerSince = conversaSelecionada.customerSince || '—';
  const customerStatus = conversaSelecionada.customerStatus || '—';
  const ticketHistory = conversaSelecionada.ticket_history || [];

  return (
    <div className="details-panel-container">
      {/* Contact Info */}
      <div className="card contato-card">
        <div className="circle-initial-box">
          <div
            className="circle-initial"
            style={{ backgroundColor: stringToColor(nome) }}
          >
            {inicial}
          </div>
        </div>
        <div className="contact-info">
          <h4 className="name-label">{nome}</h4>
          <div className="info-row">
            <Mail size={16} className="info-icon" />
            <span className="info-value">
              {isLoading ? <span className="skeleton skeleton-text" /> : (conversaSelecionada.email || 'Não informado')}
            </span>
          </div>
          <div className="info-row">
            <Phone size={16} className="info-icon" />
            <span className="info-value">
              {isLoading ? <span className="skeleton skeleton-text" /> : (conversaSelecionada.phone || 'Não informado')}
            </span>
          </div>
          <div className="info-row">
            <IdCard size={16} className="info-icon" />
            <span className="info-value">
              {isLoading ? <span className="skeleton skeleton-text" /> : (documento || 'Não informado')}
            </span>
          </div>
          <div className="info-row">
            <IdCardLanyard size={16} className="info-icon" />
            <span className="info-value">
              {isLoading ? <span className="skeleton skeleton-text" /> : conversaSelecionada.user_id}
            </span>
          </div>
        </div>
      </div>

      {/* Order Details */}
      <div className="card order-details-card">
        <h4 className="section-title">Order Details</h4>
        <div className="order-row">
          <div><strong>Lifetime value:</strong> {lifetimeValue}</div>
          <div><strong>Total order count:</strong> {totalOrderCount}</div>
        </div>
        <div className="order-row">
          <div><strong>Customer since:</strong> {customerSince}</div>
          <div><strong>Status:</strong> {customerStatus}</div>
        </div>
      </div>

      {/* Histórico */}
      <div className="card historico-card">
        <h4 className="section-title">Últimos pedidos</h4>
        {ticketHistory.length === 0 ? (
          <p className="loading">Nenhum histórico encontrado.</p>
        ) : (
          <ul className="historico-list">
            {ticketHistory.map((ticket, idx) => (
              <li key={ticket.id ?? idx} className="historico-item">
                <div className="ticket-info">
                  <div>
                    <strong>Pedido:</strong> {ticket.titulo}
                  </div>
                  <div>
                    <strong>Status:</strong> {ticket.status}
                  </div>
                  <div>
                    <strong>Data:</strong> {new Date(ticket.data).toLocaleDateString()}
                  </div>
                  {ticket.descricao && (
                    <div>
                      <strong>Descrição:</strong> {ticket.descricao}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
