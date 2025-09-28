import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CampaignWizardPage from './CampaignWizardPage';
import styles from './styles/CampaignCreatePage.module.css';

export default function CampaignCreatePage() {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      {/* Breadcrumbs */}
      <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
        <ol className={styles.bcList}>
          <li><Link to="/management/campaigns" className={styles.bcLink}>Campanhas</Link></li>
          <li className={styles.bcSep}>/</li>
          <li><span className={styles.bcCurrent}>Nova campanha</span></li>
        </ol>
      </nav>

      {/* Cabeçalho */}
      <div className={styles.header}>
        <h1 className={styles.title}>Nova campanha</h1>
        <p className={styles.subtitle}>
          Configure o template, a janela de envio, o comportamento de resposta, agendamento e público.
        </p>
      </div>

      {/* Wizard */}
      <CampaignWizardPage
        onCreated={() => navigate('/management/campaigns', { state: { created: true } })}
      />
    </div>
  );
}
