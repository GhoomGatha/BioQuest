

import React, { useState, useEffect, useRef } from 'react';
import { t } from '../utils/localization';
import { Language, Profile } from '../types';
import { supabase } from '../services/supabaseClient';
import CameraModal from './CameraModal';

interface SettingsProps {
    onExport: () => void;
    onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onClear: () => void;
    lang: Language;
    userApiKey: string;
    onSaveApiKey: (key: string) => void;
    onRemoveApiKey: () => void;
    profile: Profile;
    onProfileUpdate: (profile: Profile, avatarFile?: File) => Promise<void>;
}

const UserCircleIcon = () => (
  <svg className="h-full w-full text-slate-300" fill="currentColor" viewBox="0 0 24 24">
    <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);


const Settings: React.FC<SettingsProps> = ({ onExport, onImport, onClear, lang, userApiKey, onSaveApiKey, onRemoveApiKey, profile, onProfileUpdate }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState(profile);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isCameraModalOpen, setCameraModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const inputStyles = "w-full p-2 border rounded-lg border-slate-300 bg-slate-50 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 transition";

  useEffect(() => {
    setApiKeyInput(userApiKey);
  }, [userApiKey]);
  
  useEffect(() => {
    setProfileData(profile);
    if (!isEditingProfile) {
        setAvatarFile(null);
        setAvatarPreview(null);
    }
  }, [profile, isEditingProfile]);

  const handleImportClick = () => {
    importFileInputRef.current?.click();
  };

  const handleClearClick = () => {
    if (window.confirm(t('clearWarning', lang))) {
      onClear();
    }
  };

  const handleSaveKey = () => {
    onSaveApiKey(apiKeyInput);
  };
  
  const handleRemoveKey = () => {
    onRemoveApiKey();
  };

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'age') {
        const parsedAge = parseInt(value, 10);
        // If the input is cleared or invalid, default to 0 to avoid sending NaN
        setProfileData(prev => ({ ...prev, age: isNaN(parsedAge) ? 0 : parsedAge }));
    } else {
        setProfileData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          setAvatarFile(file);
          const reader = new FileReader();
          reader.onloadend = () => setAvatarPreview(reader.result as string);
          reader.readAsDataURL(file);
      }
  };

  const handlePhotoTaken = (file: File) => {
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
    setCameraModalOpen(false);
  }

  const handleProfileSave = async () => {
    setIsSaving(true);
    try {
        await onProfileUpdate(profileData, avatarFile || undefined);
        setIsEditingProfile(false);
    } catch (error: any) {
        console.error("Failed to save profile:", error.message || error);
    } finally {
        setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  }

  const buttonBaseStyles = "mt-2 sm:mt-0 w-full sm:w-auto px-4 py-2 font-semibold text-white rounded-lg shadow-sm hover:shadow-md hover:-translate-y-px transition-all";

  const currentAvatar = avatarPreview || profile.avatar_url;

  return (
    <>
    <div className="p-2 sm:p-4 md:p-6 space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold font-serif-display text-slate-800">User Profile</h2>
            {!isEditingProfile && <button onClick={() => setIsEditingProfile(true)} className="font-semibold text-indigo-600 hover:text-indigo-800">Edit</button>}
        </div>
        {!isEditingProfile ? (
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                <div className="w-24 h-24 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
                    {currentAvatar ? <img src={currentAvatar} alt="Profile" className="w-full h-full object-cover" /> : <UserCircleIcon />}
                </div>
                <div className="space-y-2 text-slate-600 text-center sm:text-left">
                    <p><strong>Full Name:</strong> {profile.full_name}</p>
                    <p><strong>Phone Number:</strong> {profile.phone_number}</p>
                    <p><strong>Age:</strong> {profile.age}</p>
                    <p><strong>Gender:</strong> {profile.gender}</p>
                    <p><strong>Date of Birth:</strong> {profile.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString() : 'N/A'}</p>
                    <p><strong>Address:</strong> {profile.address || 'N/A'}</p>
                </div>
            </div>
        ) : (
            <div className="space-y-4">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-24 h-24 bg-slate-100 rounded-full overflow-hidden">
                        {(avatarPreview || profileData.avatar_url) ? <img src={avatarPreview || profileData.avatar_url} alt="Profile" className="w-full h-full object-cover" /> : <UserCircleIcon />}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => fileInputRef.current?.click()} className="text-sm font-semibold text-indigo-600 hover:underline">Upload Picture</button>
                        <input type="file" ref={fileInputRef} onChange={handleAvatarFileChange} className="hidden" accept="image/*" />
                        <button onClick={() => setCameraModalOpen(true)} className="text-sm font-semibold text-indigo-600 hover:underline">Take Photo</button>
                    </div>
                </div>
                <input type="text" name="full_name" value={profileData.full_name} onChange={handleProfileChange} className={inputStyles} placeholder="Full Name"/>
                <input type="text" name="phone_number" value={profileData.phone_number} onChange={handleProfileChange} className={inputStyles} placeholder="Phone Number"/>
                <input type="number" name="age" value={profileData.age} onChange={handleProfileChange} className={inputStyles} placeholder="Age"/>
                <input type="date" name="date_of_birth" value={profileData.date_of_birth || ''} onChange={handleProfileChange} className={inputStyles} placeholder="Date of Birth" />
                <select name="gender" value={profileData.gender || ''} onChange={handleProfileChange} className={inputStyles}>
                    <option value="" disabled>Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                </select>
                <textarea name="address" value={profileData.address || ''} onChange={handleProfileChange} className={inputStyles} placeholder="Address"></textarea>
                <div className="flex justify-end space-x-2">
                    <button onClick={() => setIsEditingProfile(false)} className="px-4 py-2 bg-slate-200 rounded">Cancel</button>
                    <button onClick={handleProfileSave} className="px-4 py-2 bg-indigo-600 text-white rounded disabled:bg-indigo-400" disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold font-serif-display text-slate-800 mb-4">{t('apiKeyManagement', lang)}</h2>
        <div className="space-y-4 p-4 rounded-lg bg-slate-50">
          <p className="text-slate-600 text-sm">
            {t('apiKeyInstruction', lang)}&nbsp;
            <a href="https://ai.google.dev/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-medium hover:underline">
                {t('getYourKey', lang)}
            </a>
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input 
              type="password"
              placeholder={t('enterApiKey', lang)}
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              className="flex-grow p-2 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition"
            />
            {userApiKey ? (
              <button
                onClick={handleRemoveKey}
                className={`${buttonBaseStyles} bg-red-600 hover:bg-red-700`}
              >
                {t('removeKey', lang)}
              </button>
            ) : (
              <button
                onClick={handleSaveKey}
                className={`${buttonBaseStyles} bg-indigo-600 hover:bg-indigo-700`}
                disabled={!apiKeyInput}
              >
                {t('saveKey', lang)}
              </button>
            )}
          </div>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold font-serif-display text-slate-800 mb-4">{t('dataManagement', lang)}</h2>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg bg-slate-50">
            <p className="text-slate-700 font-medium">{t('exportData', lang)}</p>
            <button
              onClick={onExport}
              className={`${buttonBaseStyles} bg-blue-600 hover:bg-blue-700`}
            >
              {t('export', lang)}
            </button>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg bg-slate-50">
            <div>
                <p className="text-slate-700 font-medium">{t('importData', lang)}</p>
                <p className="text-sm text-slate-500">{t('importWarning', lang)}</p>
            </div>
            <button
              onClick={handleImportClick}
              className={`${buttonBaseStyles} bg-green-600 hover:bg-green-700`}
            >
              {t('import', lang)}
            </button>
            <input
              type="file"
              ref={importFileInputRef}
              onChange={onImport}
              className="hidden"
              accept=".json"
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg bg-slate-50">
            <p className="text-slate-700 font-medium">{t('clearData', lang)}</p>
            <button
              onClick={handleClearClick}
              className={`${buttonBaseStyles} bg-red-600 hover:bg-red-700`}
            >
              {t('delete', lang)}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold font-serif-display text-slate-800 mb-4">{t('supportTitle', lang)}</h2>
        <div className="p-3 rounded-lg bg-slate-50">
          <p className="text-slate-700">
            {t('supportText', lang)}{' '}
            <a href="mailto:seamateofficial@gmail.com" className="font-semibold text-indigo-600 hover:underline">
              seamateofficial@gmail.com
            </a>
          </p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold font-serif-display text-slate-800 mb-4">{t('appInfo', lang)}</h2>
        <div className="space-y-2 text-slate-600 text-center">
          <p className="font-semibold text-lg">{t('appTitle', lang)}</p>
          <p className="italic">“{t('appSubtitle', lang)}”</p>
          <p className="text-sm pt-2">{t('version', lang)}</p>
          <p className="text-sm">{t('credits', lang)}</p>
          <p className="text-xs text-slate-500 mt-2">{t('designedFor', lang)}</p>
        </div>
      </div>

       <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <button onClick={handleLogout} className={`${buttonBaseStyles} w-full bg-slate-700 hover:bg-slate-800`}>Logout</button>
       </div>
    </div>
    <CameraModal isOpen={isCameraModalOpen} onClose={() => setCameraModalOpen(false)} onCapture={handlePhotoTaken} />
    </>
  );
};

export default Settings;