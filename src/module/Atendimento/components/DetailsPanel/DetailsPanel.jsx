import React, { useState, useEffect } from 'react';
import { Mail, Phone, IdCard, MapPin, IdCardLanyard } from 'lucide-react';
import './DetailsPanel.css';
import { stringToColor } from '../../utils/color';

export default function DetailsPanel({ userIdSelecionado, conversaSelecionada }) {
  const [activeTab, setActiveTab] = useState('informacoes');

  useEffect(() => {
    setActiveTab('informacoes');
  }, [userIdSelecionado]);

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

  const renderInformacoes = () => (
    <div className="cards-container">
      <div className="card info-card">
        <h4 className="card-title">Informações de Contato</h4>
        <div className="circle-initial-box">
          <div
            className="circle-initial"
            style={{ backgroundColor: stringToColor(nome) }}
          >
            {inicial}
          </div>
        </div>
        <h4 className="name-label">{nome}</h4>

        <div className="info-row">
          <Mail size={16} className="info-icon" />
          <span className="info-value">{conversaSelecionada.email || 'Não informado'}</span>
        </div>

        <div className="info-row">
          <Phone size={16} className="info-icon" />
          <span className="info-value">{conversaSelecionada.phone || 'Não informado'}</span>
        </div>

        <div className="info-row">
          <IdCard size={16} className="info-icon" />
          <span className="info-value">{documento || 'Não informado'}</span>
        </div>

        <div className="info-row">
          <IdCardLanyard size={16} className="info-icon" />
          <span className="info-value">{conversaSelecionada.user_id || 'Não informado'}</span>
        </div>

      </div>
    </div>
  );

  const renderHistorico = () => (
    <div className="historico-content">
      <p className="loading">Histórico ainda não disponível.</p>
    </div>
  );

  return (
    <div className="details-panel-container">
      <h3 className="panel-title">Dados do Contato</h3>

      <div className="tabs-container">
        <button
          className={`tab-button ${activeTab === 'informacoes' ? 'active' : ''}`}
          onClick={() => setActiveTab('informacoes')}
        >
          Informações
        </button>
        <button
          className={`tab-button ${activeTab === 'historico' ? 'active' : ''}`}
          onClick={() => setActiveTab('historico')}
        >
          Histórico
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'informacoes' && renderInformacoes()}
        {activeTab === 'historico' && renderHistorico()}
      </div>
    </div>
  );
}
