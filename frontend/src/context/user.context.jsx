import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import axios from '../config/axios';

// Create the UserContext
export const UserContext = createContext();

// Create a provider component
export const UserProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [shouldRedirect, setShouldRedirect] = useState(false);

    // Clear user data from context and localStorage
    const logout = useCallback(async (navigateCallback) => {
        try {
            // Try to call the logout API if it exists
            try {
                await axios.post('/users/logout');
            } catch (error) {
                // Ignore errors from the logout API
                console.log('Logout API not available, continuing with client-side logout');
            }
            
            // Clear all user-related data from localStorage
            localStorage.removeItem('token');
            localStorage.removeItem('userEmail');
            localStorage.removeItem('userName');
            
            // Clear user context
            setUser(null);
            
            // Use the callback if provided
            if (typeof navigateCallback === 'function') {
                navigateCallback('/login');
            } else {
                // Fallback to setting a flag
                setShouldRedirect(true);
            }
        } catch (error) {
            console.error('Error during logout:', error);
            // Still clear user data even if there was an error
            localStorage.removeItem('token');
            localStorage.removeItem('userEmail');
            localStorage.removeItem('userName');
            setUser(null);
            setShouldRedirect(true);
        }
    }, []);

    // Check if user is logged in on initial load
    const checkAuth = useCallback(async () => {
        const token = localStorage.getItem('token');
        
        if (!token) {
            setLoading(false);
            setShouldRedirect(true);
            return;
        }

        // Create a basic user object from the token
        // In a real app, you might want to decode the JWT token to get user info
        const userFromToken = {
            _id: localStorage.getItem('userId'), // Use the stored user ID
            email: localStorage.getItem('userEmail') || 'user@example.com',
            name: localStorage.getItem('userName') || 'User'
        };
        
        // Set the user immediately
        setUser(userFromToken);
        setShouldRedirect(false);
        setLoading(false);
        
        // Optional: Try to fetch user data if the endpoint becomes available
        // This is currently commented out since the endpoint doesn't exist
        /*
        try {
            const res = await axios.get('/users/me');
            if (res.data?.user) {
                // Update user data if available
                setUser(res.data.user);
                // Optionally save to localStorage for persistence
                localStorage.setItem('userEmail', res.data.user.email || '');
                localStorage.setItem('userName', res.data.user.name || '');
            }
        } catch (error) {
            if (error.response?.status !== 404) {
                console.error('Auth check error:', error);
            }
            // Continue with the basic user if there's an error
        }
        */
    }, []);

    // Check authentication status on mount
    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    const value = {
        user,
        setUser,
        logout,
        loading,
        shouldRedirect,
        setShouldRedirect
    };

    return (
        <UserContext.Provider value={value}>
            {!loading && children}
        </UserContext.Provider>
    );
};

// Custom hook to use the user context
export const useUser = () => {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
};
