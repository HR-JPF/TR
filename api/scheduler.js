// ============================================================
// TATHKEER - Vercel Serverless Scheduler
// Runs every minute via Vercel Cron Job
// Sends Telegram + Browser notifications
// ============================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SECRET_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8829533024:AAEUZLBakA1-EjJu8CBbHITujPnOuyslWjY';
const CRON_SECRET = process.env.CRON_SECRET || 'tathkeer-cron-2026';

export default async function handler(req, res) {
  // Security check
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    // Allow Vercel cron calls without auth in production
    if (req.headers['x-vercel-cron'] !== '1' && authHeader !== `Bearer ${CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Missing Supabase credentials' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
  });

  const now = new Date();
  const windowEnd = new Date(now.getTime() + 60000); // +1 minute

  console.log(`[Scheduler] Running at ${now.toISOString()}`);

  try {
    // Fetch pending reminder rules that are due
    const { data: dueRules, error: rulesError } = await supabase
      .from('reminder_rules')
      .select(`
        *,
        events!inner (
          id, title, event_time, status, user_id
        ),
        users!inner (
          id, username, telegram_chat_id, timezone
        )
      `)
      .eq('sent', false)
      .lte('scheduled_at', windowEnd.toISOString())
      .gte('scheduled_at', new Date(now.getTime() - 120000).toISOString()) // -2 min buffer
      .eq('events.status', 'active');

    if (rulesError) {
      console.error('[Scheduler] Error fetching rules:', rulesError);
      return res.status(500).json({ error: rulesError.message });
    }

    if (!dueRules || dueRules.length === 0) {
      console.log('[Scheduler] No due reminders');
      return res.status(200).json({ processed: 0, message: 'No reminders due' });
    }

    console.log(`[Scheduler] Found ${dueRules.length} due reminders`);
    const results = [];

    for (const rule of dueRules) {
      const event = rule.events;
      const user = rule.users;
      const channels = rule.channels || {};

      const eventTime = new Date(event.event_time);
      const minutesUntil = Math.round((eventTime - now) / 60000);
      const timeLabel = minutesUntil <= 0 ? 'حان الوقت!' :
        minutesUntil === 1 ? 'خلال دقيقة' :
        `خلال ${minutesUntil} دقيقة`;

      const message = `⏰ *تذكير - منصة تذكير*\n\nالحدث: *${event.title}*\nالوقت: ${timeLabel}\nتاريخ الحدث: ${new Date(event.event_time).toLocaleString('ar-SA', { timeZone: user.timezone || 'Asia/Riyadh' })}`;

      let notifSent = false;

      // Telegram notification
      if (channels.telegram && user.telegram_chat_id) {
        try {
          const telegramRes = await fetch(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: user.telegram_chat_id,
                text: message,
                parse_mode: 'Markdown'
              })
            }
          );
          const telegramData = await telegramRes.json();
          if (telegramData.ok) {
            console.log(`[Telegram] Sent to ${user.telegram_chat_id}`);
            notifSent = true;
            await supabase.from('notification_logs').insert({
              user_id: user.id,
              event_id: event.id,
              rule_id: rule.id,
              channel: 'telegram',
              status: 'sent',
              message
            });
          } else {
            console.error('[Telegram] Error:', telegramData);
            await supabase.from('notification_logs').insert({
              user_id: user.id,
              event_id: event.id,
              rule_id: rule.id,
              channel: 'telegram',
              status: 'failed',
              error_message: JSON.stringify(telegramData)
            });
          }
        } catch (telegramErr) {
          console.error('[Telegram] Exception:', telegramErr);
        }
      }

      // Mark rule as sent
      await supabase
        .from('reminder_rules')
        .update({ sent: true, sent_at: now.toISOString() })
        .eq('id', rule.id);

      results.push({
        rule_id: rule.id,
        event_title: event.title,
        user: user.username,
        channels_triggered: Object.keys(channels).filter(c => channels[c]),
        sent: notifSent
      });
    }

    console.log(`[Scheduler] Processed ${results.length} reminders`);
    return res.status(200).json({ processed: results.length, results });

  } catch (err) {
    console.error('[Scheduler] Fatal error:', err);
    return res.status(500).json({ error: err.message });
  }
}
