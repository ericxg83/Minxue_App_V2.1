/**
 * Debug API endpoint - Check environment variables and Supabase connection
 */

import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

export async function checkEnvAndConnection(req: Request, res: Response) {
  console.log("\n=== 🔍 DEBUG ENDPOINT CALLED ===");
  
  const debugInfo: any = {
    timestamp: new Date().toISOString(),
    environment: {
      SUPABASE_URL_present: !!process.env.SUPABASE_URL,
      SUPABASE_URL: process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL.substring(0, 20)}...` : 'undefined',
      SUPABASE_ANON_KEY_present: !!process.env.SUPABASE_ANON_KEY,
      SUPABASE_ANON_KEY_length: process.env.SUPABASE_ANON_KEY?.length || 0,
      QWEN_API_KEY_present: !!process.env.QWEN_API_KEY,
      NODE_ENV: process.env.NODE_ENV || 'not set'
    },
    supabase: {
      initialized: false,
      error: null as string | null
    }
  };

  // Try to test Supabase connection
  try {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      const testClient = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY
      );
      
      // Try to query students table
      const { data, error } = await testClient
        .from('students')
        .select('id')
        .limit(1);
      
      if (error) {
        debugInfo.supabase.error = error.message;
        debugInfo.supabase.initialized = false;
      } else {
        debugInfo.supabase.initialized = true;
        debugInfo.supabase.students_count = data?.length || 0;
      }
    } else {
      debugInfo.supabase.error = 'Missing environment variables';
    }
  } catch (error: any) {
    debugInfo.supabase.error = error.message || 'Unknown error';
    console.error("Debug endpoint error:", error);
  }

  console.log("Debug Info:", JSON.stringify(debugInfo, null, 2));
  res.json(debugInfo);
}