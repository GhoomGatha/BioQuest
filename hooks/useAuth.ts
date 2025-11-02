
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
  loading: true, // Default to true to handle initial load
  setProfile: () => {},
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true); // Start as true to handle initial session and profile fetch

  useEffect(() => {
    // onAuthStateChange fires immediately upon subscription with the current session.
    // This single listener robustly handles the initial state check, logins, and logouts.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);

        if (session?.user) {
          // 1. Try to fetch the profile
          let { data: profileData, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          // 2. If no profile exists (PGRST116 error, which means 'No rows found'), create one.
          // This is a critical fix for existing users who may not have a profile row.
          if (error && error.code === 'PGRST116') {
            console.warn(`No profile found for user ${session.user.id}. Creating a new profile entry.`);
            const { data: newProfile, error: insertError } = await supabase
              .from('profiles')
              .insert({
                id: session.user.id,
                // Try to get role from user metadata, which is where it's stored on signup.
                role: session.user.user_metadata?.role || null 
              })
              .select()
              .single();

            if (insertError) {
              console.error("Failed to create profile for existing user:", insertError);
              profileData = null; // Can't proceed, set profile to null
            } else {
              profileData = newProfile; // Successfully created, proceed with this new profile
            }
          } else if (error) {
            // Handle other, unexpected errors during profile fetch
            console.error("Error fetching profile:", error);
            profileData = null;
          }
          
          setProfile(profileData);
        } else {
          // User is logged out, clear the profile.
          setProfile(null);
        }
        
        // The loading is finished after the first auth event is processed.
        setLoading(false);
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, []);


  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    profile,
    loading,
    setProfile,
  }), [session, profile, loading]);
  
  return React.createElement(AuthContext.Provider, { value: value }, children);
};

export const useAuth = () => {
  return useContext(AuthContext);
};