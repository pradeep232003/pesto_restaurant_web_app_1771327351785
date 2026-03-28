import { createClient } from '@supabase/supabase-js';
import { MOCK_LOCATIONS, MOCK_MENU_ITEMS } from './mockData';

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;

// Check if we have valid Supabase credentials
export const hasSupabaseCredentials = !!(supabaseUrl && supabaseAnonKey);

// Create a mock query builder that mimics Supabase's chainable API
const createMockQueryBuilder = (tableName) => {
  let data = tableName === 'locations' ? [...MOCK_LOCATIONS] : [...MOCK_MENU_ITEMS];
  let filters = {};

  const builder = {
    select: (columns = '*') => {
      return builder;
    },
    eq: (column, value) => {
      filters[column] = value;
      return builder;
    },
    order: (column, options = {}) => {
      const ascending = options.ascending !== false;
      data.sort((a, b) => {
        if (ascending) {
          return a[column] > b[column] ? 1 : -1;
        }
        return a[column] < b[column] ? 1 : -1;
      });
      return builder;
    },
    single: () => {
      let result = data;
      Object.keys(filters).forEach(key => {
        result = result.filter(item => item[key] === filters[key] || item.id === filters[key] || item.slug === filters[key]);
      });
      return Promise.resolve({ 
        data: result[0] || null, 
        error: result.length === 0 ? { code: 'PGRST116', message: 'No rows returned' } : null 
      });
    },
    then: (resolve) => {
      let result = data;
      Object.keys(filters).forEach(key => {
        result = result.filter(item => item[key] === filters[key]);
      });
      resolve({ data: result, error: null });
    },
  };

  // Make it thenable for async/await
  builder[Symbol.toStringTag] = 'Promise';
  
  return builder;
};

// Create a mock supabase client for when credentials are not available
const createMockClient = () => {
  return {
    from: (tableName) => createMockQueryBuilder(tableName),
    auth: {
      signUp: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured - using demo mode' } }),
      signInWithPassword: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured - using demo mode' } }),
      signOut: () => Promise.resolve({ error: null }),
      onAuthStateChange: (callback) => {
        // Call with null session initially
        setTimeout(() => callback('SIGNED_OUT', null), 0);
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    },
  };
};

// Export either real or mock client
export const supabase = hasSupabaseCredentials 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
      }
    })
  : createMockClient();

// Log warning in development
if (!hasSupabaseCredentials) {
  console.warn('Supabase credentials not found. Running in demo mode with sample data.');
}
