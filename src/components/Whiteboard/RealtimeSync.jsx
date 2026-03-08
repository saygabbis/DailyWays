import React, { useEffect, useRef } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useWhiteboardStore } from '../../stores/whiteboardStore';
import { fetchNodes, fetchConnectors, fetchComments } from '../../services/whiteboardService';

export default function RealtimeSync({ spaceId }) {
    const channelRef = useRef(null);
    const { mergeNodesFromServer, mergeConnectorsFromServer, mergeCommentsFromServer } = useWhiteboardStore();

    useEffect(() => {
        if (!spaceId) return;
        let debounceTimer = null;
        const handleChange = () => {
            if (Date.now() < useWhiteboardStore.getState().suppressRealtimeUntil) return;
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(async () => {
                const [nodesRes, connRes, commentsRes] = await Promise.all([
                    fetchNodes(spaceId),
                    fetchConnectors(spaceId),
                    fetchComments(spaceId),
                ]);
                if (nodesRes.data) mergeNodesFromServer(nodesRes.data);
                if (connRes.data) mergeConnectorsFromServer(connRes.data);
                if (commentsRes.data) mergeCommentsFromServer(commentsRes.data);
            }, 800);
        };

        const channel = supabase
            .channel('whiteboard-' + spaceId)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'space_nodes', filter: 'space_id=eq.' + spaceId },
                handleChange
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'space_connectors', filter: 'space_id=eq.' + spaceId },
                handleChange
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'space_comments', filter: 'space_id=eq.' + spaceId },
                handleChange
            )
            .subscribe();

        channelRef.current = channel;
        return () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [spaceId, mergeNodesFromServer, mergeConnectorsFromServer, mergeCommentsFromServer]);

    return null;
}
