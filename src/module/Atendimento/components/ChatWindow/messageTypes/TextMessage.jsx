// src/components/ChatWindow/messageTypes/TextMessage.jsx
import React from 'react';
import './TextMessage.css';

export default function TextMessage({ content }) {
  return <p className="text-message">{content}</p>;
}
