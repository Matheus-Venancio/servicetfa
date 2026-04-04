import { Database } from './src/integrations/supabase/types';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient<Database>('https://xyz.com', 'xyz');

supabase.from('atendentes').insert({
  nome: 'A',
  email: 'A',
  telefone: '123',
  papel: 'ATENDENTE',
  status: 'OFFLINE',
  max_leads: 10
});
