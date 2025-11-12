import { useCallback, useEffect, useState } from 'react';
import dm from '../services/dmService';
import { onDmBadge, offDmBadge, onDmNew, offDmNew } from '../services/user/socketService';

export default function useDMConversations() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await dm.listConversations();
      setConversations(data);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handleRefresh = (payload) => {
      console.log('[DM] conversations refresh on event', payload);
      refresh();
    };
    onDmBadge(handleRefresh);
    onDmNew(handleRefresh);
    return () => {
      offDmBadge(handleRefresh);
      offDmNew(handleRefresh);
    };
  }, [refresh]);

  return {
    conversations,
    loading,
    error,
    refresh,
    accept: async (id) => {
      const updated = await dm.acceptConversation(id);
      setConversations((prev) => prev.map((c) => (c._id === id ? updated : c)));
      return updated;
    },
    decline: async (id) => {
      await dm.declineConversation(id);
      setConversations((prev) => prev.filter((c) => c._id !== id));
    },
    ensureWith: async (peerId) => {
      const conv = await dm.ensureConversationWith(peerId);
      await refresh();
      return conv;
    },
  };
}



