import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CampaignWizardPage from './CampaignWizard';
import styles from './styles/CampaignCreate.module.css';

export default function CampaignCreate() {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      {/* Wizard */}
      <CampaignWizardPage
        onCreated={() => navigate('/management/campaigns', { state: { created: true } })}
      />
    </div>
  );
}
