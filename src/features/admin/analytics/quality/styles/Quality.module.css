/* ====== Container & header ====== */
.container{
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
  min-height: calc(100vh - 56px);
  overflow: hidden;
  flex: 1 1 auto;
  background: #0f1419;
  color: #f1f5f9;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
}

.headerRow{
  display: flex;
  justify-content: flex-end;
  margin-bottom: 20px;
}
.filters{
  display: flex;
  gap: 16px;
  align-items: flex-end;
}
.filterItem{
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: #94a3b8;
  font-weight: 500;
}
.filterItem label{
  display: flex;
  align-items: center;
  gap: 6px;
}
.filterItem input{
  padding: 10px 12px;
  border: 1px solid #334155;
  border-radius: 10px;
  background: #1e293b;
  font-size: 14px;
  transition: all 0.2s ease;
  min-width: 180px;
  color: #f1f5f9;
}
.filterItem input:focus{
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25);
  outline: none;
}

.refreshBtn{
  border: 1px solid #334155;
  background: #1e293b;
  color: #f1f5f9;
  border-radius: 12px;
  padding: 10px 14px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.refreshBtn:hover{
  background: #334155;
}
.refreshBtn:disabled{
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}
.spinning{
  animation: spin 1s linear infinite;
}
@keyframes spin{
  from{ transform: rotate(0); }
  to{ transform: rotate(360deg); }
}

.header{
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 18px;
  position: relative;
}
.header::after{
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -16px;
  height: 2px;
  background: linear-gradient(90deg, #3b82f6 0%, rgba(59, 130, 246, 0.18) 55%, transparent 100%);
}
.subtitle{
  margin: 6px 0 0;
  color: #94a3b8;
  font-size: 15px;
  font-weight: 400;
}

/* ====== Grid ====== */
.gridTwo{
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 24px;
}
@media (max-width: 1024px){
  .gridTwo{
    grid-template-columns: 1fr;
  }
}

/* ====== Cards ====== */
.card{
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 16px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3), 0 1px 3px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  min-height: 120px;
  overflow: visible;
  transition: all 0.3s ease;
  animation: fadeIn 0.3s ease-out;
}
.card:hover{
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.5), 0 4px 10px rgba(0, 0, 0, 0.3);
  transform: translateY(-2px);
  border-color: #3b82f6;
}
.cardHead{
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #334155;
  background: rgba(30, 41, 59, 0.5);
}
.cardTitle{
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  color: #f1f5f9;
  font-size: 15px;
}
.cardIcon{
  display: inline-flex;
  align-items: center;
  color: #94a3b8;
}
.cardRight{
  display: flex;
  align-items: center;
  gap: 10px;
}
.cardBody{
  padding: 20px;
  flex: 1;
}

@keyframes fadeIn{
  from{
    opacity: 0;
    transform: translateY(10px);
  }
  to{
    opacity: 1;
    transform: translateY(0);
  }
}

/* ====== Pills / chips ====== */
.kpill{
  font-size: 11px;
  font-weight: 700;
  color: #94a3b8;
  background: #0f1419;
  border: 1px solid #334155;
  padding: 6px 12px;
  border-radius: 20px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}
.kpillGreen{
  font-size: 12px;
  font-weight: 700;
  color: #10b981;
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.3);
  padding: 6px 12px;
  border-radius: 20px;
  box-shadow: 0 1px 3px rgba(16, 185, 129, 0.2);
}
.kpillAmber{
  font-size: 12px;
  font-weight: 700;
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.15);
  border: 1px solid rgba(251, 191, 36, 0.3);
  padding: 6px 12px;
  border-radius: 20px;
  box-shadow: 0 1px 3px rgba(251, 191, 36, 0.2);
}
.kpillRed{
  font-size: 12px;
  font-weight: 700;
  color: #ef4444;
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  padding: 6px 12px;
  border-radius: 20px;
  box-shadow: 0 1px 3px rgba(239, 68, 68, 0.2);
}

/* ====== Skeleton ====== */
@keyframes shimmer{
  0%{ background-position: -200% 0; }
  100%{ background-position: 200% 0; }
}
.skeleton{
  background: linear-gradient(90deg, #1e293b 0%, #334155 50%, #1e293b 100%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  display: block;
  border-radius: 8px;
}

/* ====== NPS / CSAT breakdown ====== */
.npsBreakdown{
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 8px;
  flex-wrap: wrap;
}

/* CSAT distribution */
.csatDist{
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.csatBar{
  height: 12px;
  border-radius: 20px;
  background: #0f1419;
  display: flex;
  overflow: hidden;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.5);
}
.csatSeg{
  display: block;
  height: 100%;
  transition: width 0.3s ease;
}
.csat1{
  background: #ef4444;
}
.csat2{
  background: #f59e0b;
}
.csat3{
  background: #fbbf24;
}
.csat4{
  background: #22c55e;
}
.csat5{
  background: #10b981;
}
.csatLegend{
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.csatLegendItem{
  font-size: 11px;
  color: #94a3b8;
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}
.dot{
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* ====== Table ====== */
.tableWrap{
  overflow: auto;
  margin-top: 8px;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  background: #0f1419;
}
.table{
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}
.table thead th{
  text-align: left;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #94a3b8;
  padding: 12px 16px;
  background: #1e293b;
  border-bottom: 1px solid #334155;
  font-weight: 700;
}
.table thead th:first-child{
  border-top-left-radius: 12px;
}
.table thead th:last-child{
  border-top-right-radius: 12px;
}
.table tbody td{
  padding: 12px 16px;
  border-bottom: 1px solid #334155;
  font-size: 14px;
  color: #e2e8f0;
  font-weight: 500;
}
.table tbody tr{
  transition: background-color 0.2s ease;
}
.table tbody tr:hover{
  background: rgba(51, 65, 85, 0.3);
}
.table tbody tr:last-child td:first-child{
  border-bottom-left-radius: 12px;
}
.table tbody tr:last-child td:last-child{
  border-bottom-right-radius: 12px;
}

.loading{
  padding: 20px;
  color: #94a3b8;
  text-align: center;
  font-size: 14px;
  font-weight: 500;
}
.empty{
  padding: 20px;
  color: #64748b;
  text-align: center;
  font-size: 14px;
  font-style: italic;
}
.subtleCenter{
  text-align: center;
  color: #64748b;
  font-size: 12px;
  margin-top: 8px;
  font-weight: 500;
}

.alertErr{
  margin-top: 12px;
  padding: 12px 14px;
  border-radius: 10px;
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
  font-weight: 600;
}

/* ====== Responsivo ====== */
@media (max-width: 768px){
  .container{
    padding: 16px;
  }
  .headerRow{
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  .filters{
    flex-direction: column;
    gap: 12px;
  }
  .filterItem input{
    min-width: auto;
  }
  .cardHead{
    padding: 12px 16px;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .cardRight{
    align-self: flex-end;
  }
  .cardBody{
    padding: 16px;
  }
  .table thead th, .table tbody td{
    padding: 8px 12px;
  }
}
