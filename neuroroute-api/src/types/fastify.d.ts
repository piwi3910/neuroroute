import { FastifyInstance } from 'fastify';
import { AppConfig } from '../config';

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig;
  }
}