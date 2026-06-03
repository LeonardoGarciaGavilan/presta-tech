import { registerAs } from '@nestjs/config';

export default registerAs('supabase', () => ({
  url: process.env.SUPABASE_URL,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  bucket: process.env.SUPABASE_STORAGE_BUCKET || 'documentos',
  signedUrlExpiry: parseInt(process.env.SIGNED_URL_EXPIRY_SECONDS || '300', 10),
}));
