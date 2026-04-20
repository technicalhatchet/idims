import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNotificationsApi } from '../utils/notificationsApi';

export const NotificationContext = createContext();

export function NotificationProvider({ children }) {
    const { getNotifications, markNotificationAsRead } = useNotificationsApi();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let mounted = true;

        const fetchNotifications = async () => {
            try {
                setLoading(true);
                const data = await getNotifications();
                if (mounted) {
                    setNotifications(data);
                }
            } catch (err) {
                if (mounted) {
                    setError(err.message);
                    console.error('Error fetching notifications:', err);
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        fetchNotifications();

        return () => {
            mounted = false;
        };
    }, []); // Remove getNotifications from dependencies

    const markAsRead = async (notificationId) => {
        try {
            await markNotificationAsRead(notificationId);
            setNotifications(prev => 
                prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
            );
        } catch (err) {
            console.error('Error marking notification as read:', err);
            throw err;
        }
    };

    return (
        <NotificationContext.Provider value={{
            notifications,
            loading,
            error,
            markAsRead
        }}>
            {children}
        </NotificationContext.Provider>
    );
}

export const useNotifications = () => useContext(NotificationContext); 