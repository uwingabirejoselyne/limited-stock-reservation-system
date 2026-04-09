import { createHash, randomBytes, scryptSync } from 'crypto';
import { prisma } from '../lib/prisma';
import { ConflictError } from '../utils/errors';
import type { CreateUserInput } from '../schemas/user.schema';

export interface UserResult {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export async function createUser(input: CreateUserInput): Promise<UserResult> {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (existing) {
    throw new ConflictError('A user with that email already exists');
  }

  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      password: hashPassword(input.password),
    },
  });

  return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
}
