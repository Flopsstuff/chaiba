import { Message } from '../../types';

interface MessageBubbleProps {
  message: Message;
  playerLabel: string;
}

export function MessageBubble({ message, playerLabel }: MessageBubbleProps) {
  const senderLabel = message.sender === 'player' ? playerLabel : message.sender === 'system' ? 'SYS' : 'YOU';
  const move = message.toolCalls?.find((tc) => tc.tool === 'make-move');

  return (
    <div className={`panel-message panel-message--${message.sender}`}>
      <span className="panel-message__sender">{senderLabel}</span>
      {move && <span className="panel-message__move">{move.args.move as string}</span>}
      {message.content && <span className="panel-message__text">{message.content}</span>}
    </div>
  );
}
