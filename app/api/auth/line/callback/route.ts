import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { derivePassword } from '@/lib/crypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const origin = request.nextUrl.origin;

  // User denied or LINE returned error
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${error}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/login?error=missing_params`);
  }

  // CSRF verification — state may contain redirect_to after ":"
  const savedState = request.cookies.get('line_oauth_state')?.value;
  const [stateValue, redirectTo] = (savedState || '').split(':');
  if (!stateValue || stateValue !== state) {
    return NextResponse.redirect(`${origin}/login?error=invalid_state`);
  }

  const channelId = process.env.LINE_LOGIN_CHANNEL_ID!;
  const channelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET!;
  const redirectUri = `${origin}/api/auth/line/callback`;

  try {
    // 1. Exchange authorization code for tokens
    const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: channelId,
        client_secret: channelSecret,
      }),
    });

    if (!tokenRes.ok) {
      console.error('LINE token exchange failed:', await tokenRes.text());
      return NextResponse.redirect(`${origin}/login?error=token_failed`);
    }

    const tokenData = await tokenRes.json();
    const idToken = tokenData.id_token;
    const accessToken = tokenData.access_token;

    if (!idToken) {
      return NextResponse.redirect(`${origin}/login?error=no_id_token`);
    }

    // 2. Verify id_token to extract LINE User ID
    const verifyRes = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        id_token: idToken,
        client_id: channelId,
      }),
    });

    if (!verifyRes.ok) {
      console.error('LINE id_token verify failed:', await verifyRes.text());
      return NextResponse.redirect(`${origin}/login?error=verify_failed`);
    }

    const verifyData = await verifyRes.json();
    const lineUserId = verifyData.sub;

    if (!lineUserId) {
      return NextResponse.redirect(`${origin}/login?error=no_sub`);
    }

    // 3. Fetch LINE profile (display name + picture)
    let lineDisplayName: string | null = null;
    let linePictureUrl: string | null = null;
    if (accessToken) {
      try {
        const profileRes = await fetch('https://api.line.me/v2/profile', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (profileRes.ok) {
          const profile = await profileRes.json();
          lineDisplayName = profile.displayName || null;
          linePictureUrl = profile.pictureUrl || null;
        }
      } catch (e) {
        console.warn('LINE profile fetch failed:', e);
      }
    }

    // 4. Look up existing user by line_user_id
    const { data: existingProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('line_user_id', lineUserId)
      .single();

    const dummyEmail = `${lineUserId}@line.feelhub.local`;
    const derivedPw = derivePassword(lineUserId);

    // Collect cookies from Supabase signIn
    const pendingCookies: { name: string; value: string; options: CookieOptions }[] = [];
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            pendingCookies.length = 0;
            cookiesToSet.forEach(({ name, value, options }) => {
              pendingCookies.push({ name, value, options });
            });
          },
        },
      }
    );

    if (existingProfile) {
      // 5a. Existing user — sign in
      let { error: signInError } = await supabase.auth.signInWithPassword({
        email: dummyEmail,
        password: derivedPw,
      });

      // Auth user with dummy email doesn't exist yet (migrating from old FC email auth)
      if (signInError) {
        const { error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: dummyEmail,
          password: derivedPw,
          email_confirm: true,
        });

        if (createError) {
          console.error('Migration user creation error:', createError);
          return NextResponse.redirect(`${origin}/login?error=create_failed`);
        }

        const result = await supabase.auth.signInWithPassword({
          email: dummyEmail,
          password: derivedPw,
        });
        signInError = result.error;

        if (signInError) {
          console.error('Supabase sign in error after migration:', signInError);
          return NextResponse.redirect(`${origin}/login?error=auth_failed`);
        }

        // Migrate profile to new auth user
        const { data: { user: newUser } } = await supabase.auth.getUser();
        if (newUser && newUser.id !== existingProfile.id) {
          // Move related data to new user id
          const oldId = existingProfile.id;
          const newId = newUser.id;
          await supabaseAdmin.from('feelcycle_sessions').update({ user_id: newId }).eq('user_id', oldId);
          await supabaseAdmin.from('feelcycle_credentials').update({ user_id: newId }).eq('user_id', oldId);
          await supabaseAdmin.from('attendance_history').update({ user_id: newId }).eq('user_id', oldId);
          await supabaseAdmin.from('waitlist').update({ user_id: newId }).eq('user_id', oldId);
          await supabaseAdmin.from('user_profiles').delete().eq('id', oldId);
          await supabaseAdmin.from('user_profiles').upsert({
            id: newId,
            line_user_id: lineUserId,
            line_display_name: lineDisplayName,
            line_picture_url: linePictureUrl,
            updated_at: new Date().toISOString(),
          });
          // Delete old auth user
          await supabaseAdmin.auth.admin.deleteUser(oldId);
        }
      } else {
        // Update LINE profile info
        await supabaseAdmin
          .from('user_profiles')
          .update({
            line_display_name: lineDisplayName,
            line_picture_url: linePictureUrl,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingProfile.id);
      }
    } else {
      // 5b. New user — create + sign in
      const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: dummyEmail,
        password: derivedPw,
        email_confirm: true,
      });

      if (createError) {
        console.error('User creation error:', createError);
        return NextResponse.redirect(`${origin}/login?error=create_failed`);
      }

      const newUserId = createData.user.id;

      // Create user_profiles row
      await supabaseAdmin
        .from('user_profiles')
        .upsert({
          id: newUserId,
          line_user_id: lineUserId,
          line_display_name: lineDisplayName,
          line_picture_url: linePictureUrl,
          updated_at: new Date().toISOString(),
        });

      // Sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: dummyEmail,
        password: derivedPw,
      });

      if (signInError) {
        console.error('Supabase sign in error after create:', signInError);
        return NextResponse.redirect(`${origin}/login?error=auth_failed`);
      }
    }

    // 6. Set cookies and redirect
    const finalRedirect = redirectTo || '/';
    const response = NextResponse.redirect(`${origin}${finalRedirect}`);

    // Set Supabase auth cookies
    for (const { name, value, options } of pendingCookies) {
      response.cookies.set(name, value, options);
    }

    // Clean up state cookie
    response.cookies.delete('line_oauth_state');

    return response;
  } catch (e) {
    console.error('LINE callback error:', e);
    return NextResponse.redirect(`${origin}/login?error=unknown`);
  }
}
