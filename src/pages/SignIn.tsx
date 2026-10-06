import { useState, FormEvent, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import logoNew from '../assets/logo-new.png';

export default function SignIn() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, signInWithGoogle } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [resendingConfirmation, setResendingConfirmation] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  const resendConfirmation = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('Enter your email first, then press Resend confirmation email.');
      return;
    }

    setResendingConfirmation(true);
    setResendMessage('');
    setError('');
    const { supabase } = await import('../lib/supabase');
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: normalizedEmail,
      options: { emailRedirectTo: `${window.location.origin}/auth/verified` },
    });
    setResendingConfirmation(false);
    if (resendError) setError(resendError.message);
    else setResendMessage('A new confirmation link was sent. Check Inbox, Spam, and Promotions.');
  };

  useEffect(() => {
    const message = searchParams.get('message');
    if (message === 'check-email') {
      setShowEmailVerification(true);
    } else if (message === 'verification-failed') {
      setError('Email verification failed. Please try again or request a new confirmation email.');
      setShake(true);
      setTimeout(() => setShake(false), 650);
    } else if (message === 'please-confirm') {
      setError('Please confirm your email before signing in. Check your inbox for the confirmation link.');
      setShake(true);
      setTimeout(() => setShake(false), 650);
    }
  }, [searchParams]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setShake(false);
    setIsLoading(true);

    try {
      const { error: authError } = await signIn(email.trim().toLowerCase(), password);

      if (authError) {
        setError(authError.message);
        setShake(true);
        setTimeout(() => setShake(false), 650);
        setIsLoading(false);
        return;
      }

      setIsSuccess(true);

      // Wait for auth state to update before redirecting
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check if user has completed brief
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('brief_completed, plan_type')
          .eq('id', user.id)
          .maybeSingle();

        // If user has trial and hasn't completed brief, redirect to brief
        // Trial routing applies only to regular client accounts. Managers and
        // Tech/Founder accounts should go straight to their dashboard.
        const isTechAccount = user?.email?.toLowerCase() === '7bd02025@gmail.com';
        if (!isTechAccount && userData?.plan_type === 'trial' && !userData?.brief_completed) {
          navigate('/brief');
          return;
        }
      }

      // Otherwise redirect to home
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      setShake(true);
      setTimeout(() => setShake(false), 650);
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        setError(error.message);
        setShake(true);
        setTimeout(() => setShake(false), 650);
      }
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed');
      setShake(true);
      setTimeout(() => setShake(false), 650);
    }
  };

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
              Welcome to <span className="text-red-600">The Ad Agent</span>
            </h1>
            <p className="text-gray-400 text-lg">
              Launch your advertising campaigns with precision and speed.
            </p>
          </motion.div>
        </div>

        {/* Decorative gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-red-600/10 via-transparent to-transparent" />
      </motion.div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{
            opacity: isSuccess ? 0 : 1,
            y: isSuccess ? -20 : 0,
            scale: isSuccess ? 0.95 : 1
          }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md"
        >
          {/* Mobile Logo */}
          <div className="lg:hidden mb-8 text-center">
            <div className="flex flex-col items-center mb-4">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-2">
                <img src={logoNew} alt="The Ad Agent Logo" className="w-full h-full object-contain" />
              </div>
              <div className="text-4xl font-bold text-red-600">The Ad Agent</div>
            </div>
            <h2 className="text-3xl font-bold">Sign In</h2>
          </div>

          {/* Desktop Title */}
          <div className="hidden lg:block mb-8">
            <h2 className="text-4xl font-bold mb-2">Sign In</h2>
            <p className="text-gray-400">Access your campaign dashboard</p>
          </div>

          <AnimatePresence>
            {showEmailVerification && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="mb-6 p-4 bg-green-600/10 border border-green-600/20 rounded-lg text-green-500 text-sm flex items-start gap-3"
              >
                <Mail className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium mb-1">Check your email</p>
                  <p className="text-green-400/80">
                    A confirmation link has been sent to your email. Please click the link to verify your account before signing in.
                  </p>
                </div>
              </motion.div>
            )}
            {error && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{
                  opacity: 1,
                  x: shake ? [0, -10, 10, -10, 10, 0] : 0
                }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: shake ? 0.5 : 0.3 }}
                className="mb-6 p-4 bg-red-600/10 border border-red-600/20 rounded-lg text-red-500 text-sm"
              >
                {error}
              </motion.div>
            )}
            {resendMessage && <p className="mb-4 text-sm text-green-400">{resendMessage}</p>}
          </AnimatePresence>

          <motion.form
            onSubmit={handleSubmit}
            className="space-y-6"
            animate={{ x: shake ? [0, -10, 10, -10, 10, 0] : 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Email Field */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              <label
                htmlFor="email"
                className="block text-sm font-medium mb-2 transition-all duration-300"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-black border border-gray-800 rounded-lg focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600/20 transition-all duration-300 text-white placeholder-gray-600"
                placeholder="Enter your email"
              />
            </motion.div>

            {/* Password Field */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              <label
                htmlFor="password"
                className="block text-sm font-medium mb-2 transition-all duration-300"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-black border border-gray-800 rounded-lg focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600/20 transition-all duration-300 text-white placeholder-gray-600 pr-12"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors duration-150"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </motion.div>

            {/* Remember Me & Forgot Password */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center justify-between"
            >
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 bg-black border-gray-800 rounded focus:ring-2 focus:ring-red-600 text-red-600 cursor-pointer"
                />
                <span className="ml-2 text-sm text-gray-400">Remember me</span>
              </label>
              <Link
                to="/forgot-password"
                className="text-sm text-red-600 hover:text-red-500 transition-colors"
              >
                Forgot password?
              </Link>
            </motion.div>

            {/* Submit Button */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ scale: isLoading ? 1 : 1.02 }}
              whileTap={{ scale: isLoading ? 1 : 0.98 }}
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
            >
              {isLoading && (
                <motion.div
                  className="absolute inset-0 bg-red-700"
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                />
              )}
              <span className="relative">{isLoading ? 'Signing in...' : 'Sign In'}</span>
            </motion.button>

            {/* Divider */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="relative flex items-center justify-center"
            >
              <div className="border-t border-gray-800 w-full"></div>
              <span className="absolute bg-black px-4 text-gray-500 text-sm">or</span>
            </motion.div>

            {/* Google Sign In Button */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={handleGoogleSignIn}
              className="w-full py-3 bg-white hover:bg-gray-100 text-gray-900 font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-3 border border-gray-300"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>Continue with Google</span>
            </motion.button>

            {/* Sign Up Link */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="text-center text-sm text-gray-400"
            >
              Don't have an account?{' '}
              <Link to={`/signup?${searchParams.toString()}`} className="text-red-600 hover:text-red-500 transition-colors font-medium">
                Sign Up
              </Link>
            </motion.p>

            {/* Privacy and Terms Links */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              className="text-center text-xs text-gray-500"
            >
              By signing in, you agree to our{' '}
              <Link to="/terms-of-service" className="text-gray-400 hover:text-white transition-colors">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link to="/privacy-policy" className="text-gray-400 hover:text-white transition-colors">
                Privacy Policy
              </Link>
            </motion.p>
          </motion.form>

          <button
            type="button"
            onClick={resendConfirmation}
            disabled={resendingConfirmation}
            className="mt-4 w-full text-sm text-red-500 hover:text-red-400 disabled:opacity-50"
          >
            {resendingConfirmation ? 'Sending confirmation email...' : 'Resend confirmation email'}
          </button>
        </motion.div>
      </div>
    </div>
  );
}
