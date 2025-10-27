import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import Modal from './Modal';

const GoogleIcon = () => (
    <svg className="w-5 h-5 mr-3" viewBox="0 0 48 48">
        <path fill="#4285F4" d="M24 9.5c3.13 0 5.9 1.12 7.96 3.04l6.09-6.09C34.03 2.58 29.38 0 24 0 14.52 0 6.44 5.39 2.73 12.9l7.32 5.68C11.53 13.59 17.22 9.5 24 9.5z"></path>
        <path fill="#34A853" d="M46.24 25.13c0-1.63-.15-3.2-.42-4.69H24v8.88h12.44c-.54 2.87-2.19 5.27-4.6 6.95l7.14 5.53C42.85 38.6 46.24 32.44 46.24 25.13z"></path>
        <path fill="#FBBC05" d="M10.05 28.58C9.55 27.06 9.27 25.46 9.27 23.8s.28-3.26.78-4.78l-7.32-5.68C1.13 16.37 0 19.96 0 23.8c0 3.84 1.13 7.43 2.95 10.28l7.1-5.5z"></path>
        <path fill="#EA4335" d="M24 48c5.38 0 10.03-1.82 13.38-4.86l-7.14-5.53c-1.78 1.19-4.08 1.9-6.24 1.9-6.79 0-12.48-4.09-14.47-9.72l-7.32 5.68C6.44 42.61 14.52 48 24 48z"></path>
        <path fill="none" d="M0 0h48v48H0z"></path>
    </svg>
);

const REMEMBER_EMAIL_KEY = 'bioquest_remember_email';
const REMEMBER_PASSWORD_KEY = 'bioquest_remember_password';

const Auth: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  
  // Email state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedEmail = localStorage.getItem(REMEMBER_EMAIL_KEY);
    const savedPassword = localStorage.getItem(REMEMBER_PASSWORD_KEY);
    if (savedEmail && savedPassword) {
        setEmail(savedEmail);
        setPassword(savedPassword);
        setRememberMe(true);
    }
  }, []);
  
  useEffect(() => {
    // Reset forms when switching between sign-in/sign-up
    setError(null);
    setAgreedToTerms(false);
    if (!rememberMe) {
      setPassword('');
    }
  }, [isSignUp, rememberMe]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        if (!agreedToTerms) {
            throw new Error("You must agree to the Terms and Conditions to sign up.");
        }
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Check your email for the confirmation link!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        if (rememberMe) {
            localStorage.setItem(REMEMBER_EMAIL_KEY, email);
            localStorage.setItem(REMEMBER_PASSWORD_KEY, password);
        } else {
            localStorage.removeItem(REMEMBER_EMAIL_KEY);
            localStorage.removeItem(REMEMBER_PASSWORD_KEY);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyles = "block w-full rounded-lg border-slate-300 bg-slate-50 shadow-sm focus:border-indigo-500 focus:ring-indigo-500";

  return (
    <>
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden md:grid md:grid-cols-2">
          <div className="hidden md:flex flex-col justify-center p-12 bg-indigo-600 text-white" style={{backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`}}>
              <h1 className="text-4xl font-bold font-serif-display mb-4">BioQuest</h1>
              <p className="text-indigo-200">The modern toolkit for biology educators. Prepare smarter, teach better.</p>
          </div>

          <div className="p-8 sm:p-12">
            <h1 className="text-3xl font-bold font-serif-display text-slate-800 mb-2">
              {isSignUp ? 'Create an Account' : 'Welcome Back'}
            </h1>
            <p className="text-slate-500 mb-6">{isSignUp ? 'Join to start building your question bank.' : 'Sign in to continue.'}</p>
            
            <button onClick={handleGoogleSignIn} disabled={loading} className="w-full flex items-center justify-center px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50">
              <GoogleIcon /> Sign in with Google
            </button>

            <div className="flex items-center my-6">
              <hr className="flex-grow border-t border-slate-300" /><span className="mx-4 text-xs font-semibold text-slate-400">OR SIGN IN WITH EMAIL</span><hr className="flex-grow border-t border-slate-300" />
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={`${inputStyles} mt-1`} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600">Password</label>
                  <div className="relative mt-1">
                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className={inputStyles} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600">
                      {showPassword ? <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg> : <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064 7-9.542-7 1.845 0 3.576.506 5.034 1.353m-2.47 1.825A4 4 0 0012 13a4 4 0 00-1.404 3.001m2.808-5.002l4.636 4.636M3 3l18 18" /></svg>}
                    </button>
                  </div>
                </div>
                {!isSignUp && <div className="flex items-center"><label className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" /><span className="text-sm font-medium text-slate-700">Remember me</span></label></div>}

                {isSignUp && (
                    <div className="flex items-start">
                        <div className="flex items-center h-5">
                            <input
                                id="terms"
                                aria-describedby="terms"
                                type="checkbox"
                                className="w-4 h-4 border border-slate-300 rounded bg-slate-50 focus:ring-3 focus:ring-indigo-300"
                                checked={agreedToTerms}
                                onChange={(e) => setAgreedToTerms(e.target.checked)}
                                required
                            />
                        </div>
                        <div className="ml-3 text-sm">
                            <label htmlFor="terms" className="text-slate-500">
                                I agree to the{' '}
                                <button
                                    type="button"
                                    onClick={() => setIsTermsModalOpen(true)}
                                    className="font-semibold text-indigo-600 hover:underline"
                                >
                                    Terms and Conditions
                                </button>
                            </label>
                        </div>
                    </div>
                )}

                {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
                <button type="submit" disabled={loading || (isSignUp && !agreedToTerms)} className="w-full flex justify-center px-4 py-2.5 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 font-semibold disabled:bg-indigo-400 disabled:cursor-not-allowed">{loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}</button>
              </form>
            
            <p className="text-sm text-center text-slate-500 mt-6">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}
              <button onClick={() => setIsSignUp(!isSignUp)} className="ml-1 font-semibold text-indigo-600 hover:underline">{isSignUp ? 'Sign In' : 'Sign Up'}</button>
            </p>
          </div>
        </div>
      </div>
      <Modal isOpen={isTermsModalOpen} onClose={() => setIsTermsModalOpen(false)} title="Terms and Conditions">
        <div className="prose prose-sm max-w-none text-slate-600">
          <h3>1. Introduction</h3>
          <p>Welcome to BioQuest ("App"). By creating an account and using our application, you agree to comply with and be bound by the following terms and conditions of use. Please review these terms carefully.</p>
          
          <h3>2. Data Privacy and Permissions</h3>
          <p>To provide and enhance our services, we require your consent to access certain data. By accepting these terms, you grant BioQuest permission to collect, use, and store the following information:</p>
          <ul>
            <li><strong>Personal Information:</strong> We collect personal details you provide, including but not limited to your Full Name, Email ID, Mobile Number, Age, Gender, and Date of Birth (DOB) for account creation, identification, and personalization.</li>
            <li><strong>Device Storage:</strong> We require access to your device's storage to enable features like saving, exporting, and importing your question banks and generated papers.</li>
            <li><strong>Location Data:</strong> We may request access to your device's location (GPS and network-based) to offer region-specific content, features, or analytics in the future.</li>
            <li><strong>Contacts:</strong> To facilitate future features that may allow you to share content or collaborate with your contacts, we may request permission to access your contact list.</li>
          </ul>

          <h3>3. Use of Your Data</h3>
          <p>Your data is used to operate, maintain, and improve the BioQuest App. We do not sell your personal information to third parties. Data may be used for internal analytics to understand user behavior and improve the user experience.</p>
          
          <h3>4. AI-Generated Content</h3>
          <p>The App utilizes AI services (Google's Gemini API) to generate questions. While we strive for accuracy, we do not guarantee the correctness, completeness, or suitability of AI-generated content. You are responsible for reviewing and validating all content before use.</p>

          <h3>5. User Responsibilities</h3>
          <p>You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities that occur under your account.</p>

          <h3>6. Termination</h3>
          <p>We may terminate or suspend your access to our App immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.</p>

          <h3>7. Changes to Terms</h3>
          <p>We reserve the right, at our sole discretion, to modify or replace these Terms at any time. We will provide notice of any changes by posting the new Terms and Conditions on this site.</p>
          <hr/>
          <p>By checking the box on the sign-up page, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.</p>
        </div>
      </Modal>
    </>
  );
};

export default Auth;