import React from "react";
import { Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom"; 
import styles from "./styles/Home.module.css";

export default function Home({ user }) {
  const navigate = useNavigate();

  const firstName =
    user?.name?.split(" ")[0] ||
    user?.nome?.split(" ")[0] ||
    (user?.email ? user.email.split("@")[0] : "NineChatter");

  // Função para obter saudação baseada no horário GMT-3
  const getGreeting = () => {
    const now = new Date();
    // Converter para GMT-3 (Brasília)
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const brasiliaTime = new Date(utc + (3600000 * -3));
    const hours = brasiliaTime.getHours();

    if (hours >= 0 && hours < 12) {
      return "Bom dia";
    } else if (hours >= 12 && hours < 18) {
      return "Boa tarde";
    } else {
      return "Boa noite";
    }
  };

  return (
    <div className={styles.home}>
      {/* HERO / BOAS-VINDAS */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <p className={styles.heroTag}>BEM-VINDO DE VOLTA</p>
          <h1 className={styles.heroTitle}>
            {getGreeting()}, {firstName}!{" "}
            <span role="img" aria-label="Mão acenando">
              👋
            </span>
          </h1>
          <p className={styles.heroSubtitle}>
            Continue sua jornada de crescimento. Explore novas soluções e
            desenvolva seu negócio com o NineChat.
          </p>

          <div className={styles.heroActions}>
            <button
              type="button"
              className={styles.heroPrimary}
              onClick={() => (window.location.href = "/workflows/hub")}
            >
              <Sparkles size={16} />
              <span>Explorar soluções</span>
            </button>
            <span className={styles.heroHint}>
              Dica: comece pelo Hub de Workflows para centralizar seus canais.
            </span>
          </div>
        </div>
      </section>

      {/* ATUALIZAÇÕES / ROADMAP */}
      <section className={styles.updates}>
        <header className={styles.updatesHeader}>
          <div>
            <h2 className={styles.updatesTitle}>Atualizações da plataforma</h2>
            <p className={styles.updatesSubtitle}>
              Fique por dentro das últimas funcionalidades e do que vem por aí.
            </p>
          </div>
        </header>

        <div className={styles.updatesGrid}>
          {/* NOVAS FUNCIONALIDADES */}
          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <div className={styles.panelIcon}>✨</div>
              <div>
                <h3 className={styles.panelTitle}>Novas funcionalidades</h3>
                <p className={styles.panelSubtitle}>
                  Recursos recém-lançados para você aproveitar hoje.
                </p>
              </div>
            </div>

            <div className={styles.featureList}>
              <div className={styles.featureCard}>
                <div className={styles.featureHeader}>
                  <div className={styles.featureIcon}>🚀</div>
                  <span className={`${styles.badge} ${styles.badgeGreen}`}>
                    Disponível agora
                  </span>
                </div>
                <h4 className={styles.featureTitle}>
                  Novo Hub de Workflows Omnichannel
                </h4>
                <p className={styles.featureDesc}>
                  Organize todos os fluxos e canais em um único painel com visão
                  consolidada de jornadas.
                </p>
              </div>

              <div className={styles.featureCard}>
                <div className={styles.featureHeader}>
                  <div className={styles.featureIcon}>⚡</div>
                  <span className={`${styles.badge} ${styles.badgeBlue}`}>Atualização</span>
                </div>
                <h4 className={styles.featureTitle}>
                  Monitor de Filas em Tempo Real
                </h4>
                <p className={styles.featureDesc}>
                  Acompanhe capacidade, tempo médio de espera e SLAs em tempo
                  real por fila.
                </p>
              </div>

              <div className={styles.featureCard}>
                <div className={styles.featureHeader}>
                  <div className={styles.featureIcon}>📊</div>
                  <span className={`${styles.badge} ${styles.badgePurple}`}>Novo</span>
                </div>
                <h4 className={styles.featureTitle}>
                  Templates aprimorados para campanhas
                </h4>
                <p className={styles.featureDesc}>
                  Modelos prontos para disparos recorrentes com variáveis
                  dinâmicas e segmentação.
                </p>
              </div>
            </div>
          </article>

          {/* ROADMAP */}
          <article className={`${styles.panel} ${styles.panelRight}`}>
            <div className={styles.panelHeader}>
              <div className={styles.panelIcon}>🗓️</div>
              <div>
                <h3 className={styles.panelTitle}>Roadmap</h3>
                <p className={styles.panelSubtitle}>
                  Visão do que estamos construindo para os próximos meses.
                </p>
              </div>
            </div>

            <ul className={styles.roadmapList}>
              <li className={styles.roadmapItem}>
                <div className={styles.roadmapDot}></div>
                <div className={styles.roadmapContent}>
                  <div className={styles.roadmapMain}>
                    <h4 className={styles.roadmapTitle}>
                      Relatórios avançados de qualidade
                    </h4>
                    <p className={styles.roadmapText}>
                      Métricas detalhadas de CSAT, tempo médio de resposta e
                      performance por agente.
                    </p>
                  </div>
                  <span className={`${styles.roadmapTag} ${styles.roadmapTagDev}`}>
                    Em desenvolvimento · Q2
                  </span>
                </div>
              </li>

              <li className={styles.roadmapItem}>
                <div className={styles.roadmapDot}></div>
                <div className={styles.roadmapContent}>
                  <div className={styles.roadmapMain}>
                    <h4 className={styles.roadmapTitle}>
                      Assistente de IA para construção de fluxos
                    </h4>
                    <p className={styles.roadmapText}>
                      Sugestões automáticas de nós, mensagens e regras com base no
                      histórico da sua operação.
                    </p>
                  </div>
                  <span className={`${styles.roadmapTag} ${styles.roadmapTagResearch}`}>
                    Em pesquisa · Q3
                  </span>
                </div>
              </li>

              <li className={styles.roadmapItem}>
                <div className={styles.roadmapDot}></div>
                <div className={styles.roadmapContent}>
                  <div className={styles.roadmapMain}>
                    <h4 className={styles.roadmapTitle}>
                      Dashboard customizável
                    </h4>
                    <p className={styles.roadmapText}>
                      Crie visões personalizadas com os indicadores mais
                      importantes para o seu negócio.
                    </p>
                  </div>
                  <span className={`${styles.roadmapTag} ${styles.roadmapTagPlanned}`}>
                    Planejado · Q4
                  </span>
                </div>
              </li>
            </ul>
          </article>
        </div>
      </section>
    </div>
  );
}
