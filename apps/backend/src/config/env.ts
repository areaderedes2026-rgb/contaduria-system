import { z } from 'zod';

const emptyToUndefined = (value: unknown) =>
  value === '' || value === undefined || value === null ? undefined : value;

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(5432),
  DB_NAME: z.string().default('contaduria'),
  DB_USER: z.string().default('contaduria'),
  DB_PASSWORD: z.string().default('contaduria_dev'),
  DB_POOL_MAX: z.coerce.number().int().min(5).max(50).default(20),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  JWT_EXPIRES_IN: z.string().default('12h'),
  /** Rutas absolutas a PEM de mkcert (oficina / PWA en LAN). Si faltan, se usa HTTP. */
  HTTPS_KEY_PATH: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  HTTPS_CERT_PATH: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
});

export const env = envSchema.parse(process.env);
