import { useCallback, useEffect, useRef } from 'react';
import { socket } from '../lib/socket';

/**
 * handlers: {
 *   onMessage(message), onMessageDeleted({groupId, messageId}),
 *   onGroupChanged(), onTyping({groupId, userId, name}), onReconnect()
 * }
 */
export function useChatSocket(handlers) {
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }

    let hasConnectedBefore = false;
    const handleConnect = () => {
      if (hasConnectedBefore) {
        handlersRef.current.onReconnect?.();
      }
      hasConnectedBefore = true;
    };

    const handleMessage = (m) => handlersRef.current.onMessage?.(m);
    const handleMessageDeleted = (p) => handlersRef.current.onMessageDeleted?.(p);
    const handleGroupChanged = () => handlersRef.current.onGroupChanged?.();
    const handleTyping = (p) => handlersRef.current.onTyping?.(p);

    socket.on('connect', handleConnect);
    socket.on('message:new', handleMessage);
    socket.on('message:deleted', handleMessageDeleted);
    socket.on('group:changed', handleGroupChanged);
    socket.on('typing', handleTyping);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('message:new', handleMessage);
      socket.off('message:deleted', handleMessageDeleted);
      socket.off('group:changed', handleGroupChanged);
      socket.off('typing', handleTyping);
    };
  }, []);

  const emitTyping = useCallback((groupId) => {
    socket.emit('typing', { groupId });
  }, []);

  return { emitTyping };
}

export default useChatSocket;