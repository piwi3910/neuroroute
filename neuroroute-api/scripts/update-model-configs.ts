/**
 * Update Model Configurations Script
 * 
 * This script updates the model configurations in the database to use the new model names.
 * It will delete the old model configurations and create new ones with the updated names.
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Prisma client
const prisma = new PrismaClient();

// Main function
async function updateModelConfigs() {
  console.log('Updating model configurations...');
  
  try {
    // Delete old model configurations
    const oldModelIds = ['gpt-4', 'gpt-3.5-turbo', 'claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'];
    
    for (const modelId of oldModelIds) {
      await prisma.modelConfig.deleteMany({
        where: { id: modelId }
      });
      
      console.log(`Deleted model configuration for ${modelId}.`);
    }
    
    // Create new model configurations
    const newModels = [
      {
        id: 'gpt-4.1',
        name: 'GPT-4.1',
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
        id: 'claude-3-7-sonnet-latest',
        name: 'Claude 3.7 Sonnet',
        provider: 'anthropic',
        enabled: true,
        priority: 3,
        capabilities: ['text-generation', 'code-generation', 'reasoning', 'knowledge-retrieval'],
        config: {
          cost: 0.025,
          quality: 0.95,
          maxTokens: 200000,
          latency: 2000
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
    
    for (const model of newModels) {
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
        // Update model configuration
        await prisma.modelConfig.update({
          where: { id: model.id },
          data: model
        });
        
        console.log(`Updated model configuration for ${model.name}.`);
      }
    }
    
    console.log('Model configurations updated successfully.');
  } catch (error) {
    console.error('Error updating model configurations:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
updateModelConfigs().catch(console.error);