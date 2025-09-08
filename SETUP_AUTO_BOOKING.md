# Setting Up Automatic Booking Processing

The booking system needs to run `process_active_bookings()` periodically to:
- Lock systems when bookings start
- Unlock systems when bookings end
- Mark completed bookings

## Option 1: Supabase Edge Function with Cron (Recommended)

### Step 1: Deploy the Edge Function

```bash
# Login to Supabase CLI
npx supabase login

# Link your project
npx supabase link --project-ref tosrjpdztyamtfmntkob

# Deploy the edge function
npx supabase functions deploy process-bookings
```

### Step 2: Set up Cron Job in Supabase Dashboard

1. Go to your Supabase Dashboard
2. Navigate to **Database → Extensions**
3. Enable `pg_cron` extension if not already enabled
4. Go to **SQL Editor** and run:

```sql
-- Schedule the Edge Function to run every minute
SELECT cron.schedule(
  'process-bookings',
  '* * * * *', -- Every minute
  $$
  SELECT
    net.http_post(
      url := 'https://tosrjpdztyamtfmntkob.supabase.co/functions/v1/process-bookings',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  $$
);
```

## Option 2: External Cron Service

If you can't use Supabase's pg_cron, you can use an external service:

### Using cron-job.org (Free)

1. Sign up at https://cron-job.org
2. Create a new cron job:
   - URL: `https://tosrjpdztyamtfmntkob.supabase.co/functions/v1/process-bookings`
   - Schedule: Every minute (* * * * *)
   - Method: POST
   - Headers: 
     ```
     Authorization: Bearer YOUR_ANON_KEY
     Content-Type: application/json
     ```

### Using GitHub Actions

Create `.github/workflows/process-bookings.yml`:

```yaml
name: Process Bookings

on:
  schedule:
    - cron: '* * * * *' # Every minute
  workflow_dispatch: # Allow manual trigger

jobs:
  process:
    runs-on: ubuntu-latest
    steps:
      - name: Call Process Bookings Function
        run: |
          curl -X POST \
            'https://tosrjpdztyamtfmntkob.supabase.co/functions/v1/process-bookings' \
            -H 'Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}' \
            -H 'Content-Type: application/json' \
            -d '{}'
```

Add your `SUPABASE_ANON_KEY` to GitHub Secrets.

## Option 3: Manual Processing

For testing or small-scale use, you can manually trigger processing:

1. Go to Supabase Dashboard → SQL Editor
2. Run: `SELECT process_active_bookings();`

## Verifying It Works

After setting up automatic processing:

1. Create a test booking that starts immediately
2. Wait 1-2 minutes
3. Check if the system gets locked automatically
4. Wait for the booking to end
5. Verify the system unlocks automatically

## Troubleshooting

If bookings aren't processing:

1. Check Edge Function logs in Supabase Dashboard
2. Verify the `process_active_bookings()` function exists:
   ```sql
   SELECT proname FROM pg_proc WHERE proname = 'process_active_bookings';
   ```
3. Test the function manually:
   ```sql
   SELECT process_active_bookings();
   ```
4. Check for errors in the system_bookings table:
   ```sql
   SELECT * FROM system_bookings WHERE status = 'active' ORDER BY created_at DESC;
   ```