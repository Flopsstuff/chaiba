import { Message } from '../../types';

interface MessageBubbleProps {
  message: Message;
  currentAgentId?: string;
}

export function MessageBubble({ message, currentAgentId }: MessageBubbleProps) {
  let senderLabel: string;
  let senderClass: string;

  if (message.sender === 'agent') {
    if (message.agentId === currentAgentId) {
      senderLabel = message.agentName || 'Agent';
      senderClass = 'agent';
    } else {
      senderLabel = 'OPP';
      senderClass = 'opponent';
    }
  } else if (message.sender === 'moderator') {
    senderLabel = 'MOD';
    senderClass = 'moderator';
  } else {
    senderLabel = 'SYS';
    senderClass = 'system';
  }

  const move = message.toolCalls?.find((tc) => tc.tool === 'make-move');

  return (
    <div className={`panel-message panel-message--${senderClass}`}>
      <span className="panel-message__sender">{senderLabel}</span>
      {move && <span className="panel-message__move">{move.args.move as string}</span>}
      {message.content && <span className="panel-message__text">{message.content}</span>}
    </div>
  );
}
