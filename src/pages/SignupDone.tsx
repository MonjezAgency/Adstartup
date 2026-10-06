import { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, CheckCircle, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import logoNew from '../assets/logo-new.png';

export default function SignupDone() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const source = searchParams.get('source') || '';
    const isGoogleSignup = source === 'google';

    // Get email from sessionStorage (for regular signup)
    const [email, setEmail] = useState('');
    const [isCheckingAuth, setIsCheckingAuth] = useState(isGoogleSignup);
    const [resending, setResending] = useState(false);
    const [resendMessage, setResendMessage] = useState('');

    const resendConfirmation = async () => {
        if (!email) return;
        setResending(true);
        setResendMessage('');
        const { error } = await supabase.auth.resend({
            type: 'signup',
            email: email.trim().toLowerCase(),
            options: { emailRedirectTo: `${window.location.origin}/auth/verified` },
        });
        setResending(false);
        setResendMessage(error
            ? error.message
            : 'A new confirmation link was sent. Check Inbox, Spam, and Promotions.');
    };

    useEffect(() => {
        const storedEmail = sessionStorage.getItem('signupEmail');
        if (storedEmail) {
            setEmail(storedEmail);
            // Clear it after reading
            sessionStorage.removeItem('signupEmail');
        }
        // Prevent going back to signup form
        window.history.pushState(null, '', window.location.href);
    }, []);

    useEffect(() => {
        // For Google signup, check if user is authenticated and redirect to dashboard
        if (isGoogleSignup && user) {
            // User is authenticated via Google, redirect to dashboard after a brief moment
            const timer = setTimeout(() => {
                navigate('/dashboard');
            }, 2000);
            return () => clearTimeout(timer);
        } else if (isGoogleSignup) {
            // Still checking auth
            setIsCheckingAuth(true);
            const timer = setTimeout(() => {
                setIsCheckingAuth(false);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [isGoogleSignup, user, navigate]);

    // Show loading state for Google signup
    if (isGoogleSignup && isCheckingAuth && !user) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center"
                >
                    <Loader2 className="w-12 h-12 text-red-500 animate-spin mx-auto mb-4" />
                    <p className="text-gray-400">Setting up your account...</p>
                </motion.div>
            </div>
        );
    }

    // Show success for Google signup (already authenticated)
    if (isGoogleSignup && user) {
        return (
            <div className="min-h-screen bg-black text-white flex">
                {/* Left Side */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6 }}
                    className="hidden lg:flex lg:w-1/2 items-center justify-center p-12 relative overflow-hidden"
                >
                    <div className="relative z-10 max-w-lg">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center">
                                <img src={logoNew} alt="The Ad Agent Logo" className="w-full h-full object-contain" />
                            </div>
                            <div className="text-6xl font-bold text-red-600">The Ad Agent</div>
                        </div>
                        <h1 className="text-5xl font-bold mb-4">
                            Welcome <span className="text-red-600">Aboard!</span>
                        </h1>
                        <p className="text-gray-400 text-lg">
                            Your account is ready. Let's create amazing campaigns!
                        </p>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-br from-red-600/10 via-transparent to-transparent" />
                </motion.div>

                {/* Right Side */}
                <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        className="w-full max-w-md text-center"
                    >
                        {/* Mobile Logo */}
                        <div className="lg:hidden mb-8">
                            <div className="flex flex-col items-center mb-4">
                                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-2">
                                    <img src={logoNew} alt="The Ad Agent Logo" className="w-full h-full object-contain" />
                                </div>
                                <div className="text-4xl font-bold text-red-600">The Ad Agent</div>
                            </div>
                        </div>

                        {/* Success Icon */}
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
                            className="mb-6 flex justify-center"
                        >
                            <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center border-2 border-green-500/30">
                                <CheckCircle className="w-12 h-12 text-green-500" />
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                        >
                            <h2 className="text-3xl font-bold mb-4 text-green-400">Welcome!</h2>
                            <p className="text-gray-400 mb-2 text-lg">
                                Your account has been created successfully!
                            </p>
                            <p className="text-gray-500 mb-8">
                                Redirecting you to dashboard...
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5 }}
                        >
                            <Loader2 className="w-6 h-6 text-red-500 animate-spin mx-auto" />
                        </motion.div>
                    </motion.div>
                </div>
            </div>
        );
    }

    // Regular email signup - show verification instructions
    return (
        <div className="min-h-screen bg-black text-white flex">
            {/* Left Side - Branding (Desktop Only) */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="hidden lg:flex lg:w-1/2 items-center justify-center p-12 relative overflow-hidden"
            >
                <div className="relative z-10 max-w-lg">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center">
                                <img src={logoNew} alt="The Ad Agent Logo" className="w-full h-full object-contain" />
                            </div>
                            <div className="text-6xl font-bold text-red-600">The Ad Agent</div>
                        </div>
                        <h1 className="text-5xl font-bold mb-4">
                            Almost <span className="text-red-600">There!</span>
                        </h1>
                        <p className="text-gray-400 text-lg">
                            Just one more step to unlock powerful advertising campaigns.
                        </p>
                    </motion.div>
                </div>

                {/* Decorative gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-red-600/10 via-transparent to-transparent" />
            </motion.div>

            {/* Right Side - Message */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="w-full max-w-md text-center"
                >
                    {/* Mobile Logo */}
                    <div className="lg:hidden mb-8">
                        <div className="flex flex-col items-center mb-4">
                            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-2">
                                <img src={logoNew} alt="The Ad Agent Logo" className="w-full h-full object-contain" />
                            </div>
                            <div className="text-4xl font-bold text-red-600">The Ad Agent</div>
                        </div>
                    </div>

                    {/* Success Icon */}
                    <motion.div
                        initial={{ y: 20 }}
                        animate={{ y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                    >
                        <div className="mb-6 flex justify-center">
                            <motion.div
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="relative"
                            >
                                <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center border-2 border-green-500/30">
                                    <CheckCircle className="w-12 h-12 text-green-500" />
                                </div>
                                <motion.div
                                    className="absolute inset-0 rounded-full border-2 border-green-500/50"
                                    animate={{ scale: [1, 1.3, 1], opacity: [0.8, 0, 0.8] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                />
                            </motion.div>
                        </div>
                    </motion.div>

                    {/* Title */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                    >
                        <h2 className="text-3xl font-bold mb-4">Account Created!</h2>
                        <p className="text-gray-400 mb-6 text-lg">
                            We've sent a verification email to:
                        </p>
                    </motion.div>

                    {/* Email Display */}
                    {email && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.3 }}
                            className="mb-8 p-4 bg-red-600/10 border border-red-600/20 rounded-xl flex items-center justify-center gap-3"
                        >
                            <Mail className="w-5 h-5 text-red-500" />
                            <p className="font-medium text-white break-all">{email}</p>
                        </motion.div>
                    )}

                    {/* Instructions */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.4 }}
                        className="mb-8 space-y-4"
                    >
                        <div className="p-6 bg-gray-900/50 border border-gray-800 rounded-xl text-left">
                            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                                <Mail className="w-5 h-5 text-red-500" />
                                Check Your Email
                            </h3>
                            <ul className="space-y-3 text-gray-400">
                                <li className="flex items-start gap-2">
                                    <span className="text-red-500 font-bold">1.</span>
                                    <span>Open your email inbox</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-red-500 font-bold">2.</span>
                                    <span>Look for the verification email from The Ad Agent</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-red-500 font-bold">3.</span>
                                    <span>Click the verification link to activate your account</span>
                                </li>
                            </ul>
                        </div>

                        <p className="text-sm text-gray-500">
                            Didn't receive the email? Check your spam folder or contact support.
                        </p>
                        <button
                            type="button"
                            onClick={resendConfirmation}
                            disabled={!email || resending}
                            className="text-sm text-red-500 hover:text-red-400 disabled:opacity-50 font-medium"
                        >
                            {resending ? 'Sending confirmation email...' : 'Resend confirmation email'}
                        </button>
                        {resendMessage && <p className="text-sm text-gray-400">{resendMessage}</p>}
                    </motion.div>

                    {/* Sign In Button */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.5 }}
                    >
                        <Link
                            to="/signin"
                            className="inline-flex items-center gap-2 px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-all duration-200 group"
                        >
                            Go to Sign In
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </motion.div>
                </motion.div>
            </div>
        </div>
    );
}
