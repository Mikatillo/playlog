import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');
  const since = searchParams.get('since');

  if (!userId || !since) {
    return NextResponse.json({ count: 0 });
  }

  try {
    const { count, error } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', userId)
      .gt('created_at', since);

    if (error) {
      console.error('New followers count error:', error);
      return NextResponse.json({ count: 0 });
    }

    return NextResponse.json({ count: count || 0 });
  } catch (error: any) {
    console.error('New followers count error:', error);
    return NextResponse.json({ count: 0 });
  }
}
