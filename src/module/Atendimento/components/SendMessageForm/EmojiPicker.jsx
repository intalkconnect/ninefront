// src/components/SendMessageForm/EmojiPicker.jsx

import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';

export default function EmojiPicker({ onSelect }) {
  return (
    <Picker
      data={data}
      onEmojiSelect={(emoji) => onSelect(emoji?.native || '')}
      theme="light"
    />
  );
}
