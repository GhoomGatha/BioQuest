

import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { Profile } from '../types';

const UserCircleIcon = () => (
  <svg className="h-full w-full text-slate-300" fill="currentColor" viewBox="0 0 24 24">
    <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const ProfileComponent: React.FC = () => {
  const { user, setProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [age, setAge] = useState<number | ''>('');
  const [gender, setGender] = useState('');
  const [address, setAddress] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProfileSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const numericAge = Number(age);
    if (age === '' || isNaN(numericAge)) {
        setError("Please enter a valid age.");
        return;
    }

    setLoading(true);
    setError(null);

    try {
      let avatar_url: string | undefined = undefined;
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const filePath = `${user.id}/avatar.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile, { upsert: true });

        if (uploadError) throw uploadError;
        
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
        avatar_url = urlData.publicUrl;
      }

      const updates = {
        id: user.id,
        full_name: fullName,
        phone_number: phoneNumber,
        age: numericAge,
        gender: gender,
        address: address,
        date_of_birth: dateOfBirth,
        avatar_url: avatar_url,
        updated_at: new Date(),
      };

      const { data, error } = await supabase.from('profiles').update(updates).eq('id', user.id).select().single();
      
      if (error) throw error;
      
      setProfile(data as Profile);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyles = "mt-1 block w-full rounded-lg border-slate-300 bg-slate-50 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 transition";

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg">
        <h1 className="text-3xl font-bold text-center font-serif-display text-slate-800">
          Set Up Your Profile
        </h1>
        <p className="text-center text-slate-500">Please provide a few more details to get started.</p>
        <form onSubmit={handleProfileSetup} className="space-y-4">
          <div className="flex flex-col items-center space-y-2">
            <div className="w-24 h-24 bg-slate-100 rounded-full overflow-hidden flex items-center justify-center">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar preview" className="w-full h-full object-cover" />
              ) : (
                <UserCircleIcon />
              )}
            </div>
            <label htmlFor="avatar-upload" className="cursor-pointer text-sm font-semibold text-indigo-600 hover:text-indigo-800">
              Upload Picture
            </label>
            <input id="avatar-upload" type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600">Full Name</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required className={inputStyles} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600">Phone Number</label>
            <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} required placeholder="+1234567890" className={inputStyles} />
          </div>
           <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600">Age</label>
              <input type="number" value={age} onChange={(e) => setAge(e.target.value === '' ? '' : parseInt(e.target.value))} required className={inputStyles} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600">Date of Birth</label>
              <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} required className={inputStyles} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600">Gender</label>
            <select value={gender} onChange={(e) => setGender(e.target.value)} required className={inputStyles}>
              <option value="" disabled>Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600">Address (Optional)</label>
            <textarea value={address} onChange={(e) => setAddress(e.target.value)} className={inputStyles} />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
          <div>
            <button type="submit" disabled={loading} className="w-full px-4 py-2.5 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 font-semibold disabled:bg-indigo-400 transition-all">
              {loading ? 'Saving...' : 'Save and Continue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileComponent;