

import React, { useState, useEffect, createContext, useContext, ReactNode, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { Session, User } from '@supabase/supabase-js';
import { Profile } from '../types';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  setProfile: React.Dispatch<React.SetStateAction<Profile | null>>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  setProfile: () => {},
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSessionAndProfile = async () => {
      setLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);

      if (session?.user) {
        try {
          const { data: profileData, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          if (error) {
            console.error("Error fetching initial profile:", error);
            setProfile(null);
          } else {
            setProfile(profileData);
          }
        } catch (e) {
            console.error("An error occurred fetching the profile:", e);
            setProfile(null);
        }
      }
      setLoading(false);
    };

    fetchSessionAndProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        if (newSession?.user) {
           const { data: profileData, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', newSession.user.id)
              .single();
            if (error) {
              console.error("Error fetching profile on auth change:", error);
              setProfile(null);
            } else {
              setProfile(profileData);
            }
        } else {
          setProfile(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    profile,
    loading,
    setProfile,
  }), [session, profile, loading]);

  return React.createElement(AuthContext.Provider, { value }, children);
};

export const useAuth = () => {
  return useContext(AuthContext);
};