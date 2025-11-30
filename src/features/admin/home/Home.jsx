// File: DashboardHome.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import styles from "./styles/Home.module.css";

export default function Home({ user }) {
  const navigate = useNavigate();

  const firstName =
    user?.name?.split(" ")[0] ||
    user?.nome?.split(" ")[0] ||
    (user?.email ? user.email.split("@")[0] : "NineChatter");

  const novidades = [
    {
      id: 1,
      titulo: "Novo Hub de Workflows Omnichannel",
      descricao:
        "Organize todos os fluxos e canais em um único painel com visão consolidada de jornadas.",
      tag: "Disponível agora",
    },
    {
      id: 2,
      titulo: "Monitor de Filas em Tempo Real",
      descricao:
        "Acompanhe capacidade, tempo médio de espera e SLAs em tempo real por fila.",
      tag: "Atualização",
    },
    {
      id: 3,
      titulo: "Templates aprimorados para campanhas",
      descricao:
        "Modelos prontos para disparos recorrentes com variáveis dinâmicas e segmentação.",
      tag: "Novo",
    },
  ];

  const roadmap = [
    {
      id: 1,
      titulo: "Relatórios avançados de qualidade",
      status: "Em desenvolvimento",
      prazo: "Q2",
      descricao:
        "Métricas detalhadas de CSAT, tempo médio de resposta e performance por agente.",
    },
    {
      id: 2,
      titulo: "Assistente de IA para construção de fluxos",
      status: "Em pesquisa",
      prazo: "Q3",
      descricao:
        "Sugestões automáticas de nós, mensagens e regras com base no seu histórico.",
    },
    {
      id: 3,
      titulo: "Dashboard customizável",
      status: "Planejado",
      prazo: "Q4",
      descricao:
        "Crie visões personalizadas com os indicadores mais importantes para o seu negócio.",
    },
  ];

  return (
    <div className={styles.home}>
      {/* HERO / BOAS-VINDAS */}
      <section className={styles.welcomeHero}>
        <div className={styles.welcomeContent}>
          <span className={styles.welcomeTag}>Bem-vindo de volta</span>
          <h1 className={styles.welcomeTitle}>
            Bom dia, {firstName}!{" "}
            <span className={styles.welcomeEmoji}>👋</span>
          </h1>
          <p className={styles.welcomeSubtitle}>
            Continue sua jornada de crescimento. Explore novas soluções e
            desenvolva seu negócio com o NineChat.
          </p>

          <div className={styles.welcomeActions}>
            <button
              type="button"
              className={styles.welcomeCta}
              onClick={() => navigate("/workflows/hub")}
            >
              Explorar soluções
            </button>
            <p className={styles.welcomeNote}>
              Dica: comece pelo Hub de Workflows para centralizar seus canais.
            </p>
          </div>
        </div>
      </section>

      {/* NOVIDADES + ROADMAP */}
      <section className={styles.newsSection}>
        <header className={styles.newsHeader}>
          <div>
            <h2 className={styles.newsTitle}>Atualizações da plataforma</h2>
            <p className={styles.newsSubtitle}>
              Fique por dentro das últimas funcionalidades e do que vem por aí.
            </p>
          </div>
        </header>

        <div className={styles.newsGrid}>
          {/* Coluna de novidades */}
          <article className={styles.newsCard}>
            <h3 className={styles.newsCardTitle}>Novas funcionalidades</h3>
            <p className={styles.newsCardIntro}>
              Recursos recém-lançados para você aproveitar hoje.
            </p>

            <ul className={styles.newsList}>
              {novidades.map((item) => (
                <li key={item.id} className={styles.newsItem}>
                  <div className={styles.newsItemHeader}>
                    <span className={styles.newsItemTag}>{item.tag}</span>
                    <span className={styles.newsItemDot} />
                  </div>
                  <div className={styles.newsItemBody}>
                    <div className={styles.newsItemTitle}>{item.titulo}</div>
                    <div className={styles.newsItemDescription}>
                      {item.descricao}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </article>

          {/* Coluna de roadmap */}
          <article className={styles.newsCard}>
            <h3 className={styles.newsCardTitle}>Roadmap</h3>
            <p className={styles.newsCardIntro}>
              Visão do que estamos construindo para os próximos meses.
            </p>

            <ul className={styles.roadmapList}>
              {roadmap.map((item) => (
                <li key={item.id} className={styles.roadmapItem}>
                  <div className={styles.roadmapTimelineBullet} />
                  <div className={styles.roadmapItemContent}>
                    <div className={styles.roadmapItemHeader}>
                      <span className={styles.roadmapItemTitle}>
                        {item.titulo}
                      </span>
                      <span className={styles.roadmapItemBadge}>
                        {item.status} · {item.prazo}
                      </span>
                    </div>
                    <p className={styles.roadmapItemDescription}>
                      {item.descricao}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>
    </div>
  );
}
