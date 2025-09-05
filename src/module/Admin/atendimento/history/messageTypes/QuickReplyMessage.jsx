import React from 'react';
import './styles/QuickReplyMessage.css'; // Crie um CSS simples ou use o do ListMessage

export default function QuickReplyMessage({ data, small }) {
  if (small) {
    return (
      <div className="quickreply-preview">
        ⚡ {data?.body?.text || '[Quick Reply]'}
      </div>
    );
  }

  return (
    <div className="quickreply-container">
      {data.body?.text && <p className="quickreply-body">{data.body.text}</p>}

      <div className="quickreply-buttons">
        {data.action?.buttons?.map((btn, index) => (
          <div key={index} className="quickreply-button">
            {btn.reply?.title}
          </div>
        ))}
      </div>

      {data.footer?.text && <div className="quickreply-footer">{data.footer.text}</div>}
    </div>
  );
}
