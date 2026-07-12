import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api.js';
import { CognitoUserPool, CognitoUser, AuthenticationDetails, CognitoUserAttribute } from 'amazon-cognito-identity-js';

const AuthContext = createContext(null);

const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;

let userPool = null;
if (userPoolId && clientId) {
  try {
    userPool = new CognitoUserPool({
      UserPoolId: userPoolId,
      ClientId: clientId,
    });
    console.log(`[AuthContext] AWS Cognito initialized. User Pool: ${userPoolId}`);
  } catch (err) {
    console.error("[AuthContext] Failed to initialize Cognito User Pool:", err);
  }
} else {
  console.log("[AuthContext] Cognito environment variables missing. Falling back to local backend authentication API.");
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Attempt to restore session on mount and sync with database
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          setIsAuthenticated(true);

          // Fetch fresh user data from API
          try {
            const response = await api.get('/api/users/me', {
              headers: { Authorization: `Bearer ${storedToken}` }
            });
            if (response.data && response.data.success) {
              setUser(response.data.user);
              localStorage.setItem('user', JSON.stringify(response.data.user));
            }
          } catch (apiErr) {
            console.error('Failed to sync user session with backend:', apiErr);
            // If the token is invalid/expired on the server, sign out
            if (apiErr.response && apiErr.response.status === 401) {
              logout();
            }
          }
        }
      } catch (e) {
        console.error('Failed to parse stored user session:', e);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      } finally {
        setLoading(false);
      }
    };
    restoreSession();
  }, []);

  /**
   * Helper to manually update user details in Context & local storage
   */
  const updateCurrentUserState = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  /**
   * Handle user login.
   * Calls Cognito authenticateUser OR fallback local login POST /api/auth/login
   */
  const login = async (email, password) => {
    if (userPool) {
      return new Promise((resolve) => {
        const authDetails = new AuthenticationDetails({ Username: email, Password: password });
        const cognitoUser = new CognitoUser({ Username: email, Pool: userPool });

        cognitoUser.authenticateUser(authDetails, {
          onSuccess: async (session) => {
            const idToken = session.getIdToken().getJwtToken();

            try {
              // Sync user with local PostgreSQL database
              const response = await api.get('/api/users/me', {
                headers: { Authorization: `Bearer ${idToken}` }
              });

              if (response.data && response.data.success) {
                const dbUser = response.data.user;

                localStorage.setItem('token', idToken);
                localStorage.setItem('user', JSON.stringify(dbUser));

                setToken(idToken);
                setUser(dbUser);
                setIsAuthenticated(true);

                // Redirect to the main application
                window.location.hash = '#app';
                resolve({ success: true });
              } else {
                resolve({ success: false, error: 'Failed to retrieve database user metadata' });
              }
            } catch (err) {
              console.error('[Cognito Auth] Database sync error:', err);
              resolve({ success: false, error: 'Database synchronization failed. Please try again.' });
            }
          },
          onFailure: (err) => {
            console.error('[Cognito Auth] Login failure:', err);
            resolve({ success: false, error: err.message || 'Cognito authentication failed' });
          }
        });
      });
    } else {
      // Local Backend Auth Fallback
      try {
        const response = await api.post('/api/auth/login', { email, password });
        const { token: receivedToken, user: receivedUser } = response.data;

        localStorage.setItem('token', receivedToken);
        localStorage.setItem('user', JSON.stringify(receivedUser));

        setToken(receivedToken);
        setUser(receivedUser);
        setIsAuthenticated(true);

        window.location.hash = '#app';
        return { success: true };
      } catch (error) {
        const errorMsg = error.response?.data?.error || 'Invalid credentials or connection issue';
        return { success: false, error: errorMsg };
      }
    }
  };

  /**
   * Handle login with Google OAuth.
   * Calls POST /api/auth/google
   */
  const loginWithGoogle = async (idToken) => {
    try {
      const response = await api.post('/api/auth/google', { idToken });
      const { token: receivedToken, user: receivedUser } = response.data;

      localStorage.setItem('token', receivedToken);
      localStorage.setItem('user', JSON.stringify(receivedUser));

      setToken(receivedToken);
      setUser(receivedUser);
      setIsAuthenticated(true);

      // Redirect to the main application
      window.location.hash = '#app';
      return { success: true };
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Google sign-in failed';
      return { success: false, error: errorMsg };
    }
  };

  /**
   * Handle user registration.
   * Calls Cognito signUp OR fallback local register POST /api/auth/register
   */
  const register = async (username, email, password) => {
    if (userPool) {
      return new Promise((resolve) => {
        const attributeList = [
          new CognitoUserAttribute({ Name: 'email', Value: email }),
          new CognitoUserAttribute({ Name: 'preferred_username', Value: username })
        ];

        userPool.signUp(email, password, attributeList, null, (err, result) => {
          if (err) {
            console.error('[Cognito Auth] Registration error:', err);
            resolve({ success: false, error: err.message || 'Cognito sign-up failed' });
            return;
          }
          // Cognito registration requires confirmation code sent to email
          resolve({ success: true, needsVerification: true, email });
        });
      });
    } else {
      // Local Backend Auth Fallback
      try {
        const response = await api.post('/api/auth/register', { username, email, password });
        const { token: receivedToken, user: receivedUser } = response.data;

        localStorage.setItem('token', receivedToken);
        localStorage.setItem('user', JSON.stringify(receivedUser));

        setToken(receivedToken);
        setUser(receivedUser);
        setIsAuthenticated(true);

        window.location.hash = '#app';
        return { success: true };
      } catch (error) {
        const errorMsg = error.response?.data?.error || 'Registration failed';
        return { success: false, error: errorMsg };
      }
    }
  };

  /**
   * Verify Cognito account sign-up via confirmation code.
   */
  const confirmSignUp = async (email, code) => {
    if (!userPool) {
      return { success: false, error: 'AWS Cognito is not initialized locally' };
    }
    return new Promise((resolve) => {
      const cognitoUser = new CognitoUser({ Username: email, Pool: userPool });

      cognitoUser.confirmRegistration(code, true, (err, result) => {
        if (err) {
          console.error('[Cognito Auth] Code confirmation failure:', err);
          resolve({ success: false, error: err.message || 'Code confirmation failed' });
        } else {
          console.log('[Cognito Auth] Registration confirmed successfully');
          resolve({ success: true });
        }
      });
    });
  };

  /**
   * Log out user and wipe local credentials.
   */
  const logout = () => {
    if (userPool) {
      const cognitoUser = userPool.getCurrentUser();
      if (cognitoUser) {
        cognitoUser.signOut();
      }
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);

    // Redirect to login page
    window.location.hash = '#login';
  };

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, loading, login, loginWithGoogle, register, confirmSignUp, logout, updateCurrentUserState }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
