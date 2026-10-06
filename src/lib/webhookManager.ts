import { supabase, Webhook } from './supabase';

interface WebhookPayload {
  event: string;
  user_id: string;
  timestamp: string;
  webhook_id: string;
  [key: string]: any;
}

interface WebhookResponse {
  success: boolean;
  message?: string;
  error?: string;
}

async function getWebhookUrl(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('webhook_url, enable_webhooks')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;

    if (!data?.webhook_url || !data?.enable_webhooks) {
      console.log('[Webhooks] Webhook not configured or disabled for user:', userId);
      return null;
    }

    return data.webhook_url;
  } catch (err) {
    console.error('[Webhooks] Error getting webhook URL:', err);
    return null;
  }
}

export async function recordWebhook(
  userId: string,
  eventType: string,
  payload: Omit<WebhookPayload, 'webhook_id'>,
  targetUrl: string
): Promise<string> {
  try {
    const webhookId = crypto.randomUUID();
    const fullPayload: WebhookPayload = {
      ...payload,
      webhook_id: webhookId,
    };

    const { data, error } = await supabase
      .from('webhooks')
      .insert([
        {
          user_id: userId,
          event_type: eventType,
          payload: fullPayload,
          target_url: targetUrl,
          status: 'pending',
          retry_count: 0,
          max_retries: 3,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    console.log('[Webhooks] Recorded webhook:', eventType, 'ID:', webhookId);
    return webhookId;
  } catch (err) {
    console.error('[Webhooks] Error recording webhook:', err);
    throw err;
  }
}

async function updateWebhookStatus(
  webhookId: string,
  status: Webhook['status'],
  responseCode?: number,
  responseBody?: string
): Promise<void> {
  try {
    const updates: Record<string, any> = {
      status,
      last_attempted_at: new Date().toISOString(),
    };

    if (status === 'delivered' || status === 'sent') {
      updates.sent_at = new Date().toISOString();
    }

    if (responseCode) {
      updates.response_code = responseCode;
    }

    if (responseBody) {
      updates.response_body = responseBody;
    }

    const { error } = await supabase
      .from('webhooks')
      .update(updates)
      .eq('id', webhookId);

    if (error) throw error;
  } catch (err) {
    console.error('[Webhooks] Error updating webhook status:', err);
  }
}

async function incrementRetryCount(webhookId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('webhooks')
      .update({
        retry_count: supabase
          .rpc('increment', { x: 1 })
          .then(() => undefined)
          .catch(() => undefined),
      })
      .eq('id', webhookId);

    if (error) {
      const { data: webhook } = await supabase
        .from('webhooks')
        .select('retry_count')
        .eq('id', webhookId)
        .single();

      if (webhook) {
        await supabase
          .from('webhooks')
          .update({ retry_count: (webhook.retry_count || 0) + 1 })
          .eq('id', webhookId);
      }
    }
  } catch (err) {
    console.error('[Webhooks] Error incrementing retry count:', err);
  }
}

export async function sendWebhookWithRetry(
  userId: string,
  eventType: string,
  eventPayload: Record<string, any>,
  maxRetries: number = 3
): Promise<string> {
  const webhookUrl = await getWebhookUrl(userId);

  if (!webhookUrl) {
    console.log('[Webhooks] No webhook configured, skipping');
    return 'no_webhook_configured';
  }

  const payload: Omit<WebhookPayload, 'webhook_id'> = {
    event: eventType,
    user_id: userId,
    timestamp: new Date().toISOString(),
    ...eventPayload,
  };

  const webhookId = await recordWebhook(userId, eventType, payload, webhookUrl);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...payload,
          webhook_id: webhookId,
          retry_count: attempt,
        }),
      });

      const responseBody = await response.text();

      if (response.ok) {
        await updateWebhookStatus(webhookId, 'delivered', response.status, responseBody);
        console.log('[Webhooks] Successfully sent webhook:', eventType);
        return webhookId;
      }

      lastError = new Error(`HTTP ${response.status}: ${responseBody}`);
      console.warn('[Webhooks] Webhook delivery failed (attempt', attempt + 1, '):', lastError);

      await updateWebhookStatus(webhookId, 'failed', response.status, responseBody);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error('[Webhooks] Webhook send error (attempt', attempt + 1, '):', lastError);

      await updateWebhookStatus(webhookId, 'failed', undefined, lastError.message);
    }

    if (attempt < maxRetries) {
      const delayMs = 1000 * Math.pow(2, attempt);
      console.log('[Webhooks] Retrying in', delayMs, 'ms...');
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      await incrementRetryCount(webhookId);
    }
  }

  console.error('[Webhooks] All retry attempts failed for webhook:', webhookId);
  throw lastError || new Error('Webhook delivery failed');
}

export async function buildKillAllAdsPayload(
  userId: string,
  adNames: string[]
): Promise<Record<string, any>> {
  return {
    action: 'Killed All Ads',
    action_type: 'kill_all_ads',
    user_id: userId,
    ads_count: adNames.length,
    ads: adNames,
  };
}

export async function buildRemoveAdPayload(
  userId: string,
  adName: string,
  userEmail: string
): Promise<Record<string, any>> {
  return {
    action: 'Remove',
    action_type: 'remove_ad',
    ad_name: adName,
    user_id: userId,
    user_email: userEmail,
  };
}

export async function triggerKillAllAdsWebhook(
  userId: string,
  adNames: string[],
  userEmail: string
): Promise<string> {
  try {
    const payload = await buildKillAllAdsPayload(userId, adNames);
    payload.user_email = userEmail;

    const webhookId = await sendWebhookWithRetry(userId, 'kill_all_ads', payload);
    return webhookId;
  } catch (err) {
    console.error('[Webhooks] Error triggering kill all ads webhook:', err);
    throw err;
  }
}

export async function triggerRemoveAdWebhook(
  userId: string,
  adName: string,
  userEmail: string
): Promise<string> {
  try {
    const payload = await buildRemoveAdPayload(userId, adName, userEmail);
    const webhookId = await sendWebhookWithRetry(userId, 'remove_ad', payload);
    return webhookId;
  } catch (err) {
    console.error('[Webhooks] Error triggering remove ad webhook:', err);
    throw err;
  }
}

export async function triggerEntityActionWebhook(
  userId: string,
  adName: string,
  userEmail: string,
  actionName: string,
  actionType: string
): Promise<string> {
  try {
    const payload = {
      action: actionName,
      action_type: actionType,
      ad_name: adName,
      user_id: userId,
      user_email: userEmail,
    };
    const webhookId = await sendWebhookWithRetry(userId, actionType, payload);
    return webhookId;
  } catch (err) {
    console.error(`[Webhooks] Error triggering ${actionType} webhook:`, err);
    throw err;
  }
}

export async function getRecentWebhooks(userId: string, limit: number = 10): Promise<Webhook[]> {
  try {
    const { data, error } = await supabase
      .from('webhooks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[Webhooks] Error fetching recent webhooks:', err);
    return [];
  }
}
