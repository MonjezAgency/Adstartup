import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Settings, Home, Copy, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { hasActiveSubscription } from '../lib/subscriptionService';
import { trialService } from '../lib/trialService';
import { hasManagerAccess } from '../lib/managerPlanService';
import logoNew from '../assets/logo-new.png';

export default function Header() {
  const navigate = useNavigate();
  const { user, profile, signOut, loading } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const initials = profile?.full_name
    ? profile.full_name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
    : user?.email?.[0].toUpperCase() || 'U';

  const email = user?.email || '';
  const userId = user?.id || '';

  useEffect(() => {
    checkAccess();

    // Refresh access check every 30 seconds to handle trial/subscription changes
    const interval = setInterval(checkAccess, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const checkAccess = async () => {
    if (!user) {
      setHasAccess(false);
      return;
    }

    try {
      // Founder/manager/admin accounts always have dashboard access, even
      // when they do not have a billing subscription or trial row.
      if (await hasManagerAccess(user.id)) {
        setHasAccess(true);
        return;
      }

      // Check subscription first
      const hasSub = await hasActiveSubscription(user.id);
      if (hasSub) {
        setHasAccess(true);
        return;
      }

      // Check trial
      const trialData = await trialService.getTrialStatus(user.id);
      if (trialData && trialData.trial_status === 'active') {
        setHasAccess(true);
        return;
      }

      setHasAccess(false);
    } catch (error) {
      console.error('[Header] Error checking access:', error);
      setHasAccess(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen]);

  const copyUserIdToClipboard = () => {
    navigator.clipboard.writeText(userId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogout = async () => {
    setDropdownOpen(false);
    await signOut();
    navigate('/');
  };

  const handleDashboard = () => {
    setDropdownOpen(false);
    navigate('/dashboard');
  };

  if (loading) {
    return (
      <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6">
        <div className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
          <img src={logoNew} alt="The Ad Agent Logo" className="h-10 w-auto object-contain" />
          <span>The Ad Agent</span>
        </div>
      </header>
    );
  }

  return (
    <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6 sticky top-0 z-40">
      <Link to="/" className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white hover:opacity-80 transition-opacity">
        <img src={logoNew} alt="The Ad Agent Logo" className="h-10 w-auto object-contain" />
        <span>The Ad Agent</span>
      </Link>

      <nav className="flex items-center gap-4">
        {!user ? (
          <>
            <Link
              to="/signin"
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors font-medium"
            >
              Sign In
            </Link>
            <button
              onClick={() => {
                const pricingElement = document.getElementById('pricing-section');
                if (pricingElement) {
                  pricingElement.scrollIntoView({ behavior: 'smooth' });
                } else {
                  navigate('/', { state: { scrollToPricing: true } });
                }
              }}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors font-medium"
            >
              Pricing
            </button>
            <button
              onClick={() => {
                const pricingElement = document.getElementById('pricing-section');
                if (pricingElement) {
                  pricingElement.scrollIntoView({ behavior: 'smooth' });
                } else {
                  navigate('/', { state: { scrollToPricing: true } });
                }
              }}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
            >
              Start Free
            </button>
          </>
        ) : (
          <div className="relative" ref={dropdownRef}>
            <motion.button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-10 h-10 bg-gradient-to-br from-red-600 to-red-500 rounded-full flex items-center justify-center text-white font-bold hover:shadow-lg transition-shadow"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {initials}
            </motion.button>

            <AnimatePresence>
              {dropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden"
                >
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{email}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">User ID</p>
                    <div className="flex items-center gap-2 mt-2">
                      <code className="flex-1 text-xs font-mono text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900 px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 truncate">
                        {userId}
                      </code>
                      <motion.button
                        onClick={copyUserIdToClipboard}
                        className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded transition-colors"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        {copied ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </motion.button>
                    </div>
                  </div>

                  <div className="py-2">
                    {hasAccess && (
                      <button
                        onClick={handleDashboard}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-3"
                      >
                        <Home className="w-4 h-4" />
                        Dashboard
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        navigate('/dashboard/settings');
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-3"
                    >
                      <Settings className="w-4 h-4" />
                      Account Settings
                    </button>
                  </div>

                  <div className="border-t border-gray-200 dark:border-gray-700 p-2">
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-3 font-medium"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </nav>
    </header>
  );
}
