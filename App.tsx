


import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Question, Paper, Tab, Language, ToastMessage, Profile } from './types';
import { t } from './utils/localization';
import { TABS } from './constants';
import QuestionBank from './components/QuestionBank';
import PaperGenerator from './components/PaperGenerator';
import ExamArchive from './components/ExamArchive';
import Settings from './components/Settings';
import Modal from './components/Modal';
import QuestionForm from './components/QuestionForm';
import { ToastContainer } from './components/Toast';
import { useAuth } from './hooks/useAuth';
import Auth from './components/Auth';
import ProfileComponent from './components/Profile';
import { supabase } from './services/supabaseClient';
import SchemaSetup from './components/SchemaSetup';
import LoadingSpinner from './components/LoadingSpinner';
import SecretMessageModal from './components/SecretMessageModal';

const API_KEY_STORAGE_KEY = 'bioquest_user_api_key';
const LANGUAGE_STORAGE_KEY = 'bioquest_lang';

const App: React.FC = () => {
  const { session, profile, setProfile, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('bank');
  const [lang, setLang] = useState<Language>('en');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [userApiKey, setUserApiKey] = useState<string>('');
  const [appLoading, setAppLoading] = useState(true);
  const [schemaError, setSchemaError] = useState(false);
  const [isSecretMessageOpen, setSecretMessageOpen] = useState(false);
  const longPressTimer = useRef<number | null>(null);

  const handleHeartPressStart = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
    longPressTimer.current = window.setTimeout(() => {
      setSecretMessageOpen(true);
    }, 11000); // 11 seconds
  };

  const handleHeartPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  useEffect(() => {
    const savedLang = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language;
    if (savedLang) setLang(savedLang);

    const savedApiKey = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (savedApiKey) setUserApiKey(savedApiKey);
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToasts(prev => [...prev, { id: Date.now(), message, type }]);
  }, []);

  const fetchData = useCallback(async () => {
    if (session?.user) {
      setAppLoading(true);
      setSchemaError(false);

      try {
        const [questionsResponse, papersResponse] = await Promise.all([
          supabase.from('questions').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }),
          supabase.from('papers').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false })
        ]);

        const { data: questionsData, error: qError } = questionsResponse;
        const { data: papersData, error: pError } = papersResponse;

        const isSchemaError = (err: any) =>
          err && ((err.message.includes('relation') && err.message.includes('does not exist')) ||
          err.message.includes('Could not find the table'));

        if (isSchemaError(qError) || isSchemaError(pError)) {
            console.error("Schema error detected:", qError || pError);
            setSchemaError(true);
            return;
        }

        if (qError || pError) {
            if(qError) console.error("Error fetching questions:", qError.message);
            if(pError) console.error("Error fetching papers:", pError.message);
            throw qError || pError;
        }

        setQuestions(questionsData || []);
        setPapers(papersData || []);

      } catch (error) {
        console.error("An unexpected error occurred during data fetch:", error);
        showToast('Failed to load data from the database.', 'error');
      } finally {
        setAppLoading(false);
      }
    } else {
        setAppLoading(false);
    }
  }, [session, showToast]);


  useEffect(() => {
    fetchData();
  }, [fetchData]);


  useEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  }, [lang]);

  const dismissToast = (id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const handleAddQuestionClick = () => {
    setEditingQuestion(null);
    setModalOpen(true);
  };

  const handleEditQuestionClick = (question: Question) => {
    setEditingQuestion(question);
    setModalOpen(true);
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!session?.user) return;
    const { error } = await supabase.from('questions').delete().match({ id: id, user_id: session.user.id });
    if (error) {
      showToast('Error deleting question.', 'error');
    } else {
      setQuestions(prev => prev.filter(q => q.id !== id));
      showToast(t('questionDeleted', lang), 'error');
    }
  };

  const handleQuestionSubmit = async (questionData: Question) => {
    if (!session?.user) return;
    
    if (editingQuestion) {
      const questionToUpdate = { ...questionData, user_id: session.user.id };
      const { data, error } = await supabase.from('questions').update(questionToUpdate).match({ id: questionData.id }).select();
      if (error || !data) {
        showToast('Error updating question.', 'error');
      } else {
        setQuestions(prev => prev.map(q => q.id === questionData.id ? data[0] : q));
        showToast(t('questionUpdated', lang));
      }
    } else {
      // For inserts, remove the client-generated 'id' to allow the DB to generate it.
      const { id, ...questionToInsert } = { ...questionData, user_id: session.user.id };
      const { data, error } = await supabase.from('questions').insert(questionToInsert).select();
      if (error || !data) {
        showToast('Error adding question.', 'error');
        console.error("Error adding question:", error)
      } else {
        setQuestions(prev => [data[0], ...prev]);
        showToast(t('questionAdded', lang));
      }
    }
    setModalOpen(false);
  };

  const handleSavePaper = async (paper: Paper) => {
    if(!session?.user) return;
    // Remove the client-generated 'id' to let the DB generate the UUID
    const { id, ...paperToInsert } = {...paper, user_id: session.user.id};
    const {data, error} = await supabase.from('papers').insert(paperToInsert).select();

    if(error || !data){
        showToast("Error saving paper.", 'error');
        console.error("Error saving paper:", error);
        return;
    }
    const savedPaper = data[0]; // This now has the DB-generated UUID

    const questionIdsToUpdate = paper.questions.map(q => q.id);
    const updatedQuestions = questions.map(q => {
      if (questionIdsToUpdate.includes(q.id)) {
        const newUsedIn = [...q.usedIn, { year: paper.year, semester: paper.semester, paperId: savedPaper.id }];
        supabase.from('questions').update({ used_in: newUsedIn }).eq('id', q.id).then();
        return { ...q, usedIn: newUsedIn };
      }
      return q;
    });

    setQuestions(updatedQuestions);
    setPapers(prev => [savedPaper, ...prev]);
    showToast(t('paperGenerated', lang));
  };
  
  const handleDeletePaper = async (id: string) => {
    if(!session?.user) return;
    const paperToDelete = papers.find(p => p.id === id);
    if (!paperToDelete) return;

    const { error } = await supabase.from('papers').delete().match({ id, user_id: session.user.id });
    if(error){
        showToast('Error deleting paper.', 'error');
        return;
    }

    const questionIdsToUpdate = paperToDelete.questions.map(q => q.id);
    const updatedQuestions = questions.map(q => {
        if(questionIdsToUpdate.includes(q.id)){
            const newUsedIn = q.usedIn.filter(use => use.paperId !== id);
            supabase.from('questions').update({ used_in: newUsedIn }).eq('id', q.id).then();
            return { ...q, usedIn: newUsedIn };
        }
        return q;
    });

    setQuestions(updatedQuestions);
    setPapers(prev => prev.filter(p => p.id !== id));
    showToast(t('paperDeleted', lang), 'error');
  };

  const handleUploadPaper = async (paper: Paper, file: File) => {
    if(!session?.user) return;
    const { id, ...paperToInsert } = {...paper, user_id: session.user.id, questions: []};
    const {data, error} = await supabase.from('papers').insert(paperToInsert).select();
    if(error || !data) {
        showToast("Error uploading paper.", 'error');
    } else {
        setPapers(prev => [data[0], ...prev]);
        showToast(t('uploadSuccess', lang));
    }
  };

  const handleExport = () => {
    const data = JSON.stringify({ questions, papers }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bioquest_backup.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast(t('dataExported', lang));
  };
  
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    // This would need to be adapted to bulk-insert into Supabase
    showToast("Import is not supported in cloud mode yet.", 'error');
  };

  const handleClear = async () => {
    if(!session?.user) return;
    await supabase.from('questions').delete().eq('user_id', session.user.id);
    await supabase.from('papers').delete().eq('user_id', session.user.id);
    setQuestions([]);
    setPapers([]);
    showToast(t('dataCleared', lang), 'error');
  };
  
  const handleSaveApiKey = (key: string) => {
    localStorage.setItem(API_KEY_STORAGE_KEY, key);
    setUserApiKey(key);
    showToast(t('apiKeySaved', lang));
  };
  
  const handleRemoveApiKey = () => {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
    setUserApiKey('');
    showToast(t('apiKeyRemoved', lang), 'error');
  };

  const handleProfileUpdate = async (updatedProfile: Profile, avatarFile?: File) => {
    if (!session?.user) {
        throw new Error("User not authenticated for profile update.");
    }

    try {
        let newAvatarUrl = updatedProfile.avatar_url;
        if (avatarFile) {
            const fileExt = avatarFile.name.split('.').pop();
            const filePath = `${session.user.id}/avatar.${fileExt}`;
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, avatarFile, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
            newAvatarUrl = `${urlData.publicUrl}?t=${new Date().getTime()}`; // Add timestamp to break cache
        }
        
        const { id, ...profileUpdates } = updatedProfile;
        const finalProfile = { 
            ...profileUpdates, 
            avatar_url: newAvatarUrl,
            updated_at: new Date().toISOString()
        };
        const { data, error } = await supabase.from('profiles').update(finalProfile).eq('id', session.user.id).select().single();
        
        if(error || !data) {
            throw error || new Error('No data returned from profile update');
        }
        
        setProfile(data);
        showToast('Profile updated!', 'success');

    } catch (error: any) {
        console.error("Error updating profile:", error.message || error);
        showToast('Error updating profile.', 'error');
        throw error; // Re-throw the error to be caught by the calling component
    }
};

  const renderContent = () => {
    switch (activeTab) {
      case 'bank':
        return <QuestionBank questions={questions} onAddQuestion={handleAddQuestionClick} onEditQuestion={handleEditQuestionClick} onDeleteQuestion={handleDeleteQuestion} lang={lang} showToast={showToast} />;
      case 'generator':
        return <PaperGenerator questions={questions} onSavePaper={handleSavePaper} lang={lang} showToast={showToast} userApiKey={userApiKey} />;
      case 'archive':
        return <ExamArchive papers={papers} onDeletePaper={handleDeletePaper} onUploadPaper={handleUploadPaper} lang={lang} />;
      case 'settings':
        return <Settings onExport={handleExport} onImport={handleImport} onClear={handleClear} lang={lang} userApiKey={userApiKey} onSaveApiKey={handleSaveApiKey} onRemoveApiKey={handleRemoveApiKey} profile={profile!} onProfileUpdate={handleProfileUpdate} />;
      default:
        return null;
    }
  };
  
  if (schemaError) {
    return <SchemaSetup onRetry={fetchData} />;
  }
  
  if (loading) {
    return <LoadingSpinner message="Authenticating..." />;
  }

  if (session && appLoading) {
      return <LoadingSpinner message="Loading your BioQuest..." />;
  }
  
  if (!session) {
    return <Auth />;
  }

  if (!profile || !profile.full_name) {
    return <ProfileComponent />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <header className="bg-white/80 backdrop-blur-lg shadow-sm sticky top-0 z-40 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 equipment-title-container">
                <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center mr-3 shadow-md">
                    <span className="text-xl microscope-emoji">{t('appHeaderEmoji', lang)}</span>
                </div>
                <span className="font-serif-display animate-text-color-cycle">{t('appHeaderText', lang)}</span>
              </h1>
              <p className="text-sm text-slate-500">{t('appSubtitle', lang)}</p>
            </div>
            <div className="flex items-center space-x-2">
              <select value={lang} onChange={(e) => setLang(e.target.value as Language)} className="p-2 border border-slate-300 rounded-lg bg-white shadow-sm text-sm">
                <option value="en">English</option>
                <option value="bn">বাংলা</option>
                <option value="hi">हिन्दी</option>
              </select>
              {activeTab === 'bank' && (
                <button
                  onClick={handleAddQuestionClick}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold shadow-sm hover:shadow-md hover:-translate-y-px transition-all hidden sm:block"
                >
                  {t('addQuestion', lang)}
                </button>
              )}
            </div>
          </div>
          <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto -mb-px">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-shrink-0 px-3 sm:px-4 py-3 text-sm font-semibold rounded-t-lg transition-colors ${
                  activeTab === tab.id
                    ? 'border-b-2 border-indigo-600 text-indigo-600'
                    : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-50'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {t(tab.id, lang)}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto w-full">
        {renderContent()}
      </main>
      
      {activeTab === 'bank' && (
        <button
          onClick={handleAddQuestionClick}
          className="fixed bottom-24 right-4 sm:hidden bg-indigo-600 text-white rounded-full p-4 shadow-lg hover:bg-indigo-700 transition-transform hover:scale-105"
          aria-label={t('addQuestion', lang)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}

      <footer className="text-center py-4 text-sm text-slate-500 border-t border-slate-200 bg-white">
        <p>© {new Date().getFullYear()} {t('appTitle', lang)}. All Rights Reserved.</p>
        <p className="mt-1 text-xs text-slate-400">
          Crafted with{' '}
          <span 
            className="animate-beat animate-text-color-cycle cursor-pointer"
            onMouseDown={handleHeartPressStart}
            onMouseUp={handleHeartPressEnd}
            onMouseLeave={handleHeartPressEnd}
            onTouchStart={handleHeartPressStart}
            onTouchEnd={handleHeartPressEnd}
          >
            ❤️
          </span>
          {' '}for Hiyan by <span className="animate-beat animate-text-color-cycle">Vedant</span>
        </p>
      </footer>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        title={editingQuestion ? t('editQuestion', lang) : t('addQuestion', lang)}
      >
        <QuestionForm
          onSubmit={handleQuestionSubmit}
          onCancel={() => setModalOpen(false)}
          initialData={editingQuestion}
          lang={lang}
        />
      </Modal>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <SecretMessageModal isOpen={isSecretMessageOpen} onClose={() => setSecretMessageOpen(false)} />
    </div>
  );
};

export default App;