import React, { useContext, useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { UserContext } from '../context/user.context'

const UserAuth = ({ children }) => {
    const { user, loading } = useContext(UserContext);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        // This effect runs when loading is complete or the user state changes.
        if (!loading && !user) {
            // If loading is done and there's still no user, redirect to login.
            navigate('/login', { state: { from: location.pathname }, replace: true });
        }
    }, [user, loading, navigate, location.pathname]);

    // While the UserProvider is checking for a token and loading the user, show a loading screen.
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900">
                <div className="text-white text-lg">Authenticating...</div>
            </div>
        );
    }

    // If loading is done and we have a user, render the protected component.
    if (user) {
        return <>{children}</>;
    }

    // If there's no user and we're not loading, this will be null while the useEffect redirects.
    return null;
};

export default UserAuth