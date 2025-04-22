/**
 * Performance benchmark for comparing FastAPI and Fastify implementations
 * 
 * This script runs a series of tests to compare the performance of the
 * Fastify implementation with the original FastAPI implementation.
 * 
 * Usage:
 * - Start both servers (FastAPI and Fastify)
 * - Run this script with: `npx ts-node test/performance/benchmark.ts`
 */

import axios from 'axios';
import { performance } from 'perf_hooks';

// Configuration
const FASTIFY_URL = process.env.FASTIFY_URL || 'http://localhost:3000';
const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';
const ITERATIONS = parseInt(process.env.ITERATIONS || '100');
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '10');

// Test endpoints
const ENDPOINTS = [
  { name: 'Health Check', path: '/health', method: 'GET', payload: null },
  { name: 'Models List', path: '/models', method: 'GET', payload: null },
  { name: 'Specific Model', path: '/models/gpt-4', method: 'GET', payload: null },
  { 
    name: 'Prompt Routing', 
    path: '/prompt', 
    method: 'POST', 
    payload: { 
      prompt: 'Tell me a short joke', 
      max_tokens: 50, 
      temperature: 0.7 
    } 
  }
];

// Helper function to measure response time
async function measureResponseTime(url: string, method: string, payload: any): Promise<number> {
  const startTime = performance.now();
  
  try {
    if (method === 'GET') {
      await axios.get(url);
    } else if (method === 'POST') {
      await axios.post(url, payload);
    }
    
    const endTime = performance.now();
    return endTime - startTime;
  } catch (error) {
    console.error(`Error making request to ${url}: ${error.message}`);
    return -1; // Error case
  }
}

// Run a single test
async function runTest(baseUrl: string, endpoint: any, iteration: number): Promise<number> {
  const url = `${baseUrl}${endpoint.path}`;
  return measureResponseTime(url, endpoint.method, endpoint.payload);
}

// Run tests for a specific endpoint
async function runEndpointTests(baseUrl: string, endpoint: any): Promise<number[]> {
  console.log(`Running tests for ${endpoint.name} on ${baseUrl}...`);
  
  const results: number[] = [];
  
  // Run sequential tests
  for (let i = 0; i < ITERATIONS; i++) {
    const responseTime = await runTest(baseUrl, endpoint, i);
    if (responseTime >= 0) {
      results.push(responseTime);
    }
    
    // Add a small delay between requests to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  return results;
}

// Calculate statistics
function calculateStats(times: number[]): { min: number, max: number, avg: number, p95: number, p99: number } {
  if (times.length === 0) return { min: 0, max: 0, avg: 0, p95: 0, p99: 0 };
  
  // Sort times for percentile calculations
  const sortedTimes = [...times].sort((a, b) => a - b);
  
  return {
    min: sortedTimes[0],
    max: sortedTimes[sortedTimes.length - 1],
    avg: sortedTimes.reduce((sum, time) => sum + time, 0) / sortedTimes.length,
    p95: sortedTimes[Math.floor(sortedTimes.length * 0.95)],
    p99: sortedTimes[Math.floor(sortedTimes.length * 0.99)]
  };
}

// Format milliseconds to a readable string
function formatMs(ms: number): string {
  return `${ms.toFixed(2)}ms`;
}

// Run all tests
async function runAllTests() {
  console.log(`Starting performance benchmark`);
  console.log(`Fastify URL: ${FASTIFY_URL}`);
  console.log(`FastAPI URL: ${FASTAPI_URL}`);
  console.log(`Iterations: ${ITERATIONS}`);
  console.log(`Concurrency: ${CONCURRENCY}`);
  console.log('----------------------------------------');
  
  const results: any = {};
  
  // Test each endpoint
  for (const endpoint of ENDPOINTS) {
    // Test Fastify
    const fastifyTimes = await runEndpointTests(FASTIFY_URL, endpoint);
    
    // Test FastAPI
    const fastapiTimes = await runEndpointTests(FASTAPI_URL, endpoint);
    
    // Calculate statistics
    const fastifyStats = calculateStats(fastifyTimes);
    const fastapiStats = calculateStats(fastapiTimes);
    
    // Calculate improvement percentage
    const avgImprovement = ((fastapiStats.avg - fastifyStats.avg) / fastapiStats.avg) * 100;
    const p95Improvement = ((fastapiStats.p95 - fastifyStats.p95) / fastapiStats.p95) * 100;
    
    // Store results
    results[endpoint.name] = {
      fastify: fastifyStats,
      fastapi: fastapiStats,
      improvement: {
        avg: avgImprovement,
        p95: p95Improvement
      }
    };
    
    // Print results for this endpoint
    console.log(`\nResults for ${endpoint.name}:`);
    console.log('----------------------------------------');
    console.log('Fastify:');
    console.log(`  Min: ${formatMs(fastifyStats.min)}`);
    console.log(`  Max: ${formatMs(fastifyStats.max)}`);
    console.log(`  Avg: ${formatMs(fastifyStats.avg)}`);
    console.log(`  P95: ${formatMs(fastifyStats.p95)}`);
    console.log(`  P99: ${formatMs(fastifyStats.p99)}`);
    
    console.log('FastAPI:');
    console.log(`  Min: ${formatMs(fastapiStats.min)}`);
    console.log(`  Max: ${formatMs(fastapiStats.max)}`);
    console.log(`  Avg: ${formatMs(fastapiStats.avg)}`);
    console.log(`  P95: ${formatMs(fastapiStats.p95)}`);
    console.log(`  P99: ${formatMs(fastapiStats.p99)}`);
    
    console.log('Improvement:');
    console.log(`  Avg: ${avgImprovement.toFixed(2)}%`);
    console.log(`  P95: ${p95Improvement.toFixed(2)}%`);
    console.log('----------------------------------------');
  }
  
  // Print summary
  console.log('\nSummary:');
  console.log('----------------------------------------');
  for (const endpoint of ENDPOINTS) {
    const result = results[endpoint.name];
    console.log(`${endpoint.name}: ${result.improvement.avg.toFixed(2)}% improvement in average response time`);
  }
  
  // Calculate overall improvement
  const overallAvgImprovement = ENDPOINTS.reduce((sum, endpoint) => {
    return sum + results[endpoint.name].improvement.avg;
  }, 0) / ENDPOINTS.length;
  
  console.log('----------------------------------------');
  console.log(`Overall: ${overallAvgImprovement.toFixed(2)}% improvement in average response time`);
  
  // Return results for potential further processing
  return results;
}

// Run the benchmark if this file is executed directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('Error running benchmark:', error);
    process.exit(1);
  });
}

export { runAllTests };