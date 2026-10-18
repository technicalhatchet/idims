-- Restore clients.user_id and all repointed customer rows after phase 2e backfill.

UPDATE notifications n
SET user_id = b.old_user_id
FROM backups.notifications_user_id_placeholder_repoint_2026_10_18 b
WHERE n.id = b.row_id;

UPDATE push_subscriptions ps
SET user_id = b.old_user_id
FROM backups.push_subscriptions_user_id_placeholder_repoint_2026_10_18 b
WHERE ps.id = b.row_id;

UPDATE offline_sync_queue osq
SET user_id = b.old_user_id
FROM backups.offline_sync_queue_user_id_placeholder_repoint_2026_10_18 b
WHERE osq.id = b.row_id;

UPDATE documents d
SET user_id = b.old_user_id
FROM backups.documents_user_id_placeholder_repoint_2026_10_18 b
WHERE d.id = b.row_id;

UPDATE chat_sessions cs
SET user_id = b.old_user_id
FROM backups.chat_sessions_user_id_placeholder_repoint_2026_10_18 b
WHERE cs.id = b.row_id;

UPDATE chat_messages cm
SET sender_id = b.old_user_id
FROM backups.chat_messages_sender_id_placeholder_repoint_2026_10_18 b
WHERE cm.id = b.row_id;

UPDATE clients c
SET user_id = b.user_id
FROM backups.clients_user_id_2026_10_18 b
WHERE c.id = b.id;

UPDATE clients c
SET user_id = b.old_user_id
FROM backups.clients_user_id_placeholder_repoint_2026_10_18 b
WHERE c.id = b.client_id;

SELECT COUNT(*) AS rows_in_clients_user_id_backup
FROM backups.clients_user_id_2026_10_18;
