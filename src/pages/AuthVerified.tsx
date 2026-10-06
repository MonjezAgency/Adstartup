import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import logoNew from '../assets/logo-new.png';

export default function AuthVerified() {
    const navigate = useNavigate();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('Verifying your email...');

    useEffect(() => {
        const confirmEmail = async () => {
            try {
                console.log('[AuthVerified] Starting email verification...');

                const { data: { session }, error } = await supabase.auth.getSession();

                console.log('[AuthVerified] Session check:', {
                    hasSession: !!session,
                    hasUser: !!session?.user,
                    emailConfirmed: session?.user?.email_confirmed_at,
                    error: error?.message,
                });

                if (error) {
                    console.error('[AuthVerified] Session error:', error.message);
                    setStatus('error');
                    setMessage('Error verifying email. Please try again.');
                    setTimeout(() => navigate('/signin?message=verification-failed'), 3000);
                    return;
                }

                if (session?.user && session.user.email_confirmed_at) {
                    console.log('[AuthVerified] ✅ Email confirmed successfully!');

                    // Keep the legacy public.users flag synchronized with
                    // Supabase Auth so existing accounts can sign in.
                    await supabase
                        .from('users')
                        .update({ verified: true, updated_at: new Date().toISOString() })
                        .eq('id', session.user.id);

                    setStatus('success');
                    setMessage('Email verified successfully!');

                    setTimeout(() => {
                        navigate('/signin?verified=true');
                    }, 2500);
                } else {
                    console.warn('[AuthVerified] ❌ No session or email not confirmed');
                    setStatus('error');
                    setMessage('Please confirm your email to continue.');
                    setTimeout(() => navigate('/signin?message=please-confirm'), 3000);
                }
            } catch (err) {
                console.error('[AuthVerified] Unexpected error:', err);
                setStatus('error');
                setMessage('An unexpected error occurred.');
                setTimeout(() => navigate('/signin'), 3000);
            }
        };

        confirmEmail();
    }, [navigate]);

    return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="max-w-md w-full bg-gray-900/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-800 text-center"
            >
                {/* Logo */}
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
                        <img src={logoNew} alt="The Ad Agent Logo" className="w-full h-full object-contain" />
                    </div>
                </div>

                {status === 'loading' && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                    >
                        <Loader2 className="w-16 h-16 text-red-500 animate-spin mx-auto" />
                        <h1 className="text-2xl font-bold">{message}</h1>
                        <p className="text-gray-400">Please wait while we verify your email...</p>
                    </motion.div>
                )}

                {status === 'success' && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                    >
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                        >
                            <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
                        </motion.div>
                        <h1 className="text-2xl font-bold text-green-400">{message}</h1>
                        <p className="text-gray-400">Redirecting you to sign in...</p>
                    </motion.div>
                )}

                {status === 'error' && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                    >
                        <XCircle className="w-16 h-16 text-red-500 mx-auto" />
                        <h1 className="text-2xl font-bold text-red-400">{message}</h1>
                        <p className="text-gray-400">Redirecting you to sign in...</p>
                    </motion.div>
                )}
            </motion.div>
        </div>
    );
}
