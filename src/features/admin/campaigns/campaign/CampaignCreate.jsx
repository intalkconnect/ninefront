// File: CampaignCreate.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import CampaignWizardPage from "./CampaignWizard";
import styles from "./styles/CampaignCreate.module.css";

export default function CampaignCreate() {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <CampaignWizardPage
          onCreated={() =>
            navigate("/campaigns/campaigns", { state: { created: true } })
          }
        />
      </div>
    </div>
  );
}
