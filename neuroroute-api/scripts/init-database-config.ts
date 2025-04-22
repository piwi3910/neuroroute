/**
 * Database Configuration Initialization Script
 * 
 * This script initializes the database with default configurations and
 * migrates existing API keys from environment variables to the database.
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import crypto from 'crypto';

// Load environment variables
dotenv.config();

// Initialize Prisma client
const prisma = new PrismaClient();

// Encryption helpers
function generateEncryptionKey(): Buffer {
  const jwtSecret = process.env.JWT_SECRET ?? 'development-jwt-secret-change-in-production';
  return crypto.createHash('sha256').update(jwtSecret).digest();
}

function encrypt(value: string, encryptionKey: Buffer): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', encryptionKey, iv);
  let encrypted = cipher.update(value, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

// Main function
async function initDatabaseConfig() {
  console.log('Initializing database configuration...');
  
  try {
    // Generate encryption key
    const encryptionKey = generateEncryptionKey();
    
    // Migrate API keys from environment variables
    await migrateApiKeys(encryptionKey);
    
    // Initialize default model configurations
    await initializeModelConfigs();
    
    console.log('Database configuration initialized successfully.');
  } catch (error) {
    console.error('Error initializing database configuration:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Migrate API keys from environment variables to database
async function migrateApiKeys(encryptionKey: Buffer) {
  console.log('Migrating API keys from environment variables...');
  
  const apiKeys = [
    { provider: 'openai', envKey: 'OPENAI_API_KEY' },
    { provider: 'anthropic', envKey: 'ANTHROPIC_API_KEY' }
  ];
  
  for (const { provider, envKey } of apiKeys) {
    const apiKey = process.env[envKey];
    
    if (apiKey) {
      const key = `api_key.${provider.toLowerCase()}`;
      
      // Check if key already exists
      const existing = await prisma.config.findUnique({
        where: { key }
      });
      
      if (!existing) {
        // Encrypt the API key
        const encrypted = encrypt(apiKey, encryptionKey);
        
        // Store in database
        await prisma.config.create({
          data: {
            key,
            value: encrypted
          }
        });
        
        console.log(`Migrated ${provider} API key to database.`);
      } else {
        console.log(`${provider} API key already exists in database.`);
      }
    } else {
      console.log(`No ${provider} API key found in environment variables.`);
    }
  }
}

// Initialize default model configurations
async function initializeModelConfigs() {
  console.log('Initializing default model configurations...');
  
  const defaultModels = [
    {
      id: 'gpt-4',
      name: 'GPT-4',
      provider: 'openai',
      enabled: true,
      priority: 3,
      capabilities: ['text-generation', 'code-generation', 'reasoning', 'knowledge-retrieval'],
      config: {
        cost: 0.03,
        quality: 0.95,
        maxTokens: 8192,
        latency: 2000
      }
    },
    {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      provider: 'openai',
      enabled: true,
      priority: 2,
      capabilities: ['text-generation', 'code-generation'],
      config: {
        cost: 0.002,
        quality: 0.8,
        maxTokens: 4096,
        latency: 1000
      }
    },
    {
      id: 'claude-3-opus',
      name: 'Claude 3 Opus',
      provider: 'anthropic',
      enabled: true,
      priority: 3,
      capabilities: ['text-generation', 'code-generation', 'reasoning', 'knowledge-retrieval'],
      config: {
        cost: 0.025,
        quality: 0.93,
        maxTokens: 100000,
        latency: 2500
      }
    },
    {
      id: 'claude-3-sonnet',
      name: 'Claude 3 Sonnet',
      provider: 'anthropic',
      enabled: true,
      priority: 2,
      capabilities: ['text-generation', 'code-generation', 'reasoning'],
      config: {
        cost: 0.015,
        quality: 0.9,
        maxTokens: 100000,
        latency: 1800
      }
    },
    {
      id: 'claude-3-haiku',
      name: 'Claude 3 Haiku',
      provider: 'anthropic',
      enabled: true,
      priority: 1,
      capabilities: ['text-generation'],
      config: {
        cost: 0.003,
        quality: 0.85,
        maxTokens: 100000,
        latency: 1200
      }
    },
    {
      id: 'lmstudio-local',
      name: 'LM Studio (Local)',
      provider: 'local',
      enabled: true,
      priority: 0,
      capabilities: ['text-generation', 'code-generation'],
      config: {
        cost: 0.0,
        quality: 0.75,
        maxTokens: 4096,
        latency: 3000
      }
    }
  ];
  
  for (const model of defaultModels) {
    // Check if model already exists
    const existing = await prisma.modelConfig.findUnique({
      where: { id: model.id }
    });
    
    if (!existing) {
      // Create model configuration
      await prisma.modelConfig.create({
        data: model
      });
      
      console.log(`Created model configuration for ${model.name}.`);
    } else {
      console.log(`Model configuration for ${model.name} already exists.`);
    }
  }
}

// Run the script
initDatabaseConfig().catch(console.error);