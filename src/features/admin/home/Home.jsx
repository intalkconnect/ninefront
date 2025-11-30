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

  return (
    <div className={styles.home}>
      {/* HERO / BOAS-VINDAS */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <p className={styles.heroTag}>BEM-VINDO DE VOLTA</p>
          <h1 className={styles.heroTitle}>
            Bom dia, {firstName}!{" "}
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
              <h3 className={styles.panelTitle}>Novas funcionalidades</h3>
              <p className={styles.panelSubtitle}>
                Recursos recém-lançados para você aproveitar hoje.
              </p>
            </div>

            <div className={styles.featureList}>
              <div className={styles.featureCard}>
                <span className={`${styles.badge} ${styles.badgeGreen}`}>
                  Disponível agora
                </span>
                <h4 className={styles.featureTitle}>
                  Novo Hub de Workflows Omnichannel
                </h4>
                <p className={styles.featureDesc}>
                  Organize todos os fluxos e canais em um único painel com visão
                  consolidada de jornadas.
                </p>
              </div>

              <div className={styles.featureCard}>
                <span className={styles.badge}>Atualização</span>
                <h4 className={styles.featureTitle}>
                  Monitor de Filas em Tempo Real
                </h4>
                <p className={styles.featureDesc}>
                  Acompanhe capacidade, tempo médio de espera e SLAs em tempo
                  real por fila.
                </p>
              </div>

              <div className={styles.featureCard}>
                <span className={styles.badge}>Novo</span>
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
              <h3 className={styles.panelTitle}>Roadmap</h3>
              <p className={styles.panelSubtitle}>
                Visão do que estamos construindo para os próximos meses.
              </p>
            </div>

            <ul className={styles.roadmapList}>
              <li className={styles.roadmapItem}>
                <div className={styles.roadmapMain}>
                  <h4 className={styles.roadmapTitle}>
                    Relatórios avançados de qualidade
                  </h4>
                  <p className={styles.roadmapText}>
                    Métricas detalhadas de CSAT, tempo médio de resposta e
                    performance por agente.
                  </p>
                </div>
                <span className={styles.roadmapTag}>
                  Em desenvolvimento · Q2
                </span>
              </li>

              <li className={styles.roadmapItem}>
                <div className={styles.roadmapMain}>
                  <h4 className={styles.roadmapTitle}>
                    Assistente de IA para construção de fluxos
                  </h4>
                  <p className={styles.roadmapText}>
                    Sugestões automáticas de nós, mensagens e regras com base no
                    histórico da sua operação.
                  </p>
                </div>
                <span className={styles.roadmapTag}>Em pesquisa · Q3</span>
              </li>

              <li className={styles.roadmapItem}>
                <div className={styles.roadmapMain}>
                  <h4 className={styles.roadmapTitle}>
                    Dashboard customizável
                  </h4>
                  <p className={styles.roadmapText}>
                    Crie visões personalizadas com os indicadores mais
                    importantes para o seu negócio.
                  </p>
                </div>
                <span className={styles.roadmapTag}>Planejado · Q4</span>
              </li>
            </ul>
          </article>
        </div>
      </section>
    </div>
  );
}
