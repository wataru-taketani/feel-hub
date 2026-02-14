import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('programs')
    .select('program_name, color_code, text_color');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const colorMap: Record<string, { colorCode: string; textColor: string }> = {};
  for (const row of data || []) {
    colorMap[row.program_name] = {
      colorCode: row.color_code,
      textColor: row.text_color,
    };
  }

  return NextResponse.json(colorMap, {
    headers: {
      'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
