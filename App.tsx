// Fix: Removed 'aistudio' from the React import statement as it was causing a syntax error.
import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { ToastMessage } from './types';
import { ToastContainer } from './components/Toast';
import { useAuth } from './hooks/useAuth';
import Auth from './components/Auth';
import ProfileComponent from './components/Profile';
import SchemaSetup from './components/SchemaSetup';
import LoadingSpinner from './components/LoadingSpinner';
import TeacherApp from './components/TeacherApp';
import StudentApp from './components/StudentApp';
import RoleSelector from './components/RoleSelector';
import { supabase } from './services/supabaseClient';

const App: React.FC = () => {
  const { session, profile, loading } = useAuth();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [schemaError, setSchemaError] = useState<string | false>(false);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToasts(prev => [...prev, { id: Date.now(), message, type }]);
  }, []);

  const checkSchema = useCallback(async () => {
    if (session?.user) {
        const tablesToCheck = ['profiles', 'questions', 'papers', 'student_test_attempts', 'chapters'];
        for (const table of tablesToCheck) {
             const { error } = await supabase
                .from(table)
                .select('id')
                .limit(1);
            
            // Supabase returns PGRST116 if the table is empty, which is not an error for us.
            // We only care if the 'relation ... does not exist' error occurs.
            if (error && error.code !== 'PGRST116' && error.message.includes('does not exist')) {
                console.error(`Schema error detected in table '${table}':`, error.message);
                setSchemaError(`Required table '${table}' is missing. Please run the setup script.`);
                return false;
            }
        }
        setSchemaError(false);
        return true;
    }
    return true; // No user, no schema to check
  }, [session]);

  useEffect(() => {
    checkSchema();
  }, [checkSchema]);


  const dismissToast = (id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };
  
  if (schemaError) {
    return <SchemaSetup onRetry={checkSchema} errorMessage={schemaError} />;
  }

  // Show loading spinner while the session/profile is being fetched.
  // This also handles the case where we have a session but haven't fetched the profile yet,
  // preventing a flash of the profile setup screen for existing users.
  if (loading || (session && !profile)) {
    return <LoadingSpinner message="Authenticating..." />;
  }

  // If loading is done and there's no session, show the login page.
  if (!session) {
    return <Auth />;
  }

  // At this point, a session exists, and the profile has been fetched.
  // If the profile is incomplete (missing full_name), show the setup page.
  if (!profile.full_name) {
    return <ProfileComponent />;
  }
  
  // If the profile is complete but the role is not set, show the role selector.
  if (!profile.role) {
    return <RoleSelector />;
  }

  // If everything is ready, render the appropriate app based on role.
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <Suspense fallback={<LoadingSpinner message="Loading..." />}>
        {profile.role === 'teacher' && <TeacherApp showToast={showToast} />}
        {profile.role === 'student' && <StudentApp showToast={showToast} />}
      </Suspense>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

export default App;