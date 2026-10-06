import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { hasActiveSubscription } from '../lib/subscriptionService';
import { trialService } from '../lib/trialService';
import { hasManagerAccess } from '../lib/managerPlanService';
import { Loader } from 'lucide-react';

interface SubscriptionProtectedRouteProps {
  children: React.ReactNode;
}

export default function SubscriptionProtectedRoute({ children }: SubscriptionProtectedRouteProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    checkAccess();

    // Refresh access check periodically
    const interval = setInterval(checkAccess, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const checkAccess = async () => {
    if (!user) {
      setIsLoading(false);
      setHasAccess(false);
      return;
    }

    try {
      // Founder/manager/admin accounts always have dashboard access.
      // Read the role from Supabase instead of relying on an email cache.
      if (await hasManagerAccess(user.id)) {
        setHasAccess(true);
        setIsLoading(false);
        return;
      }

      // Check if user has active subscription
      const hasSub = await hasActiveSubscription(user.id);
      if (hasSub) {
        setHasAccess(true);
        setIsLoading(false);
        return;
      }

      // Check if user has active trial
      const trialData = await trialService.getTrialStatus(user.id);
      if (trialData && trialData.trial_status === 'active') {
        setHasAccess(true);
        setIsLoading(false);
        return;
      }

      // No active subscription or trial
      setHasAccess(false);
      setIsLoading(false);
    } catch (error) {
      console.error('[SubscriptionProtectedRoute] Error checking access:', error);
      // If there's an error reading data, deny access for safety
      setHasAccess(false);
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Checking subscription status...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  if (!hasAccess) {
    return <Navigate to="/" state={{ scrollToPricing: true }} replace />;
  }

  return <>{children}</>;
}
