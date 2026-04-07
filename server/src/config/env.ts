if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required');
  process.exit(1);
}

export const JWT_SECRET: string = process.env.JWT_SECRET;
