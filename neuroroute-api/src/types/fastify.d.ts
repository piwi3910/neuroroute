import { FastifyInstance } from 'fastify';
import { AppConfig } from '../config.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig;
  }
}