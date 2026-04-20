// contexts/NotificationContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useUser } from '@auth0/nextjs-auth0';
import { useNotificationsApi } from '../utils/notificationsApi';

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
    const { user, isLoading } = useUser();
    const { getNotifications, markNotificationAsRead } = useNotificationsApi();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchNotifications = async () => {
            // Don't fetch if we don't have a user yet
            if (!user || isLoading) return;
            
            try {
                setLoading(true);
                const data = await getNotifications();
                setNotifications(data);
            } catch (err) {
                setError(err.message);
                console.error('Error fetching notifications:', err);
            } finally {
                setLoading(false);
            }
        };
    
        fetchNotifications();
    }, [user, isLoading, getNotifications]);

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
            loading: loading || isLoading,
            error,
            markAsRead
        }}>
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotifications() {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
}

export default NotificationContext;