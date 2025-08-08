// components/ChannelIcon.jsx
import React from 'react';

const ChannelIcon = ({ channel, size = 16 }) => {
  const getIcon = () => {
    switch (channel) {
      case 'whatsapp':
        return <img src="/icons/whatsapp.png" alt="WhatsApp" style={{ width: size, height: size }} />;
      case 'telegram':
        return <img src="/icons/telegram.png" alt="Telegram" style={{ width: size, height: size }} />;
      case 'webchat':
        return <img src="/icons/webchat.png" alt="Webchat" style={{ width: size, height: size }} />;
      default:
        return <div style={{ width: size, height: size }} />;
    }
  };

  return getIcon();
};

export default ChannelIcon;
