import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3000';
const API_KEY = process.env.API_KEY || '';
const CONCURRENT_USERS = [1, 10, 50, 100, 200];
const REQUESTS_PER_USER = 50;
const ENDPOINTS = [
  { name: 'Health Check', path: '/health', method: 'get' },
  { name: 'Models List', path: '/models', method: 'get' },
  { name: 'Specific Model', path: '/models/gpt-3.5-turbo', method: 'get' },
  { 
    name: 'Prompt Routing', 
    path: '/prompt', 
    method: 'post',
    data: {
      prompt: 'Explain quantum computing in simple terms',
      maxTokens: 100
    }
  }
];

// Define result types
interface EndpointResult {
  name: string;
  path: string;
  method: string;
  requests: number;
  successful: number;
  failed: number;
  durations: number[];
  totalDuration: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerSecond: number;
}

interface ConcurrencyResult {
  concurrentUsers: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  durations: number[];
  totalDuration: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p95ResponseTime: number;
  requestsPerSecond: number;
}

interface BenchmarkResults {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalDuration: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerSecond: number;
  endpoints: Record<string, EndpointResult>;
  concurrencyTests: ConcurrencyResult[];
}

// Results storage
const results: BenchmarkResults = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalDuration: 0,
  averageResponseTime: 0,
  minResponseTime: Number.MAX_VALUE,
  maxResponseTime: 0,
  p95ResponseTime: 0,
  p99ResponseTime: 0,
  requestsPerSecond: 0,
  endpoints: {},
  concurrencyTests: []
};

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY
  }
});

// Helper function to sleep
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to calculate percentile
function percentile(values: number[], p: number) {
  if (values.length === 0) return 0;
  values.sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * values.length) - 1;
  return values[index];
}

// Run a single request
async function runRequest(endpoint: any): Promise<any> {
  const startTime = Date.now();
  try {
    if (endpoint.method === 'get') {
      await api.get(endpoint.path);
    } else if (endpoint.method === 'post') {
      await api.post(endpoint.path, endpoint.data);
    }
    const duration = Date.now() - startTime;
    return { success: true, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    return { success: false, duration, error };
  }
}

// Run tests for a specific endpoint
async function testEndpoint(endpoint: any, concurrentUsers: number = 1): Promise<any> {
  console.log(`Testing ${endpoint.name} with ${concurrentUsers} concurrent users...`);
  
  const endpointResults = {
    name: endpoint.name,
    path: endpoint.path,
    method: endpoint.method,
    requests: 0,
    successful: 0,
    failed: 0,
    durations: [] as number[],
    totalDuration: 0,
    averageResponseTime: 0,
    minResponseTime: Number.MAX_VALUE,
    maxResponseTime: 0,
    p95ResponseTime: 0,
    p99ResponseTime: 0,
    requestsPerSecond: 0
  };
  
  const startTime = Date.now();
  
  // Create batches of concurrent requests
  const batches = [];
  for (let i = 0; i < concurrentUsers; i++) {
    const batch = [];
    for (let j = 0; j < REQUESTS_PER_USER; j++) {
      batch.push(runRequest(endpoint));
    }
    batches.push(batch);
  }
  
  // Run batches sequentially to simulate concurrent users
  for (const batch of batches) {
    const results = await Promise.all(batch);
    
    for (const result of results) {
      endpointResults.requests++;
      endpointResults.durations.push(result.duration);
      endpointResults.totalDuration += result.duration;
      
      if (result.success) {
        endpointResults.successful++;
      } else {
        endpointResults.failed++;
      }
      
      endpointResults.minResponseTime = Math.min(endpointResults.minResponseTime, result.duration);
      endpointResults.maxResponseTime = Math.max(endpointResults.maxResponseTime, result.duration);
    }
    
    // Add a small delay between batches to avoid overwhelming the server
    await sleep(100);
  }
  
  const totalDuration = Date.now() - startTime;
  
  // Calculate statistics
  endpointResults.averageResponseTime = endpointResults.totalDuration / endpointResults.requests;
  endpointResults.p95ResponseTime = percentile(endpointResults.durations, 95);
  endpointResults.p99ResponseTime = percentile(endpointResults.durations, 99);
  endpointResults.requestsPerSecond = (endpointResults.requests / totalDuration) * 1000;
  
  console.log(`  Completed ${endpointResults.requests} requests (${endpointResults.successful} successful, ${endpointResults.failed} failed)`);
  console.log(`  Avg: ${endpointResults.averageResponseTime.toFixed(2)}ms, Min: ${endpointResults.minResponseTime}ms, Max: ${endpointResults.maxResponseTime}ms`);
  console.log(`  P95: ${endpointResults.p95ResponseTime}ms, P99: ${endpointResults.p99ResponseTime}ms`);
  console.log(`  Throughput: ${endpointResults.requestsPerSecond.toFixed(2)} req/sec`);
  
  return endpointResults;
}

// Run concurrency tests
async function runConcurrencyTests(): Promise<void> {
  console.log('\n=== Running Concurrency Tests ===\n');
  
  // Use the health endpoint for concurrency testing
  const endpoint = ENDPOINTS[0];
  
  for (const concurrentUsers of CONCURRENT_USERS) {
    console.log(`\nTesting with ${concurrentUsers} concurrent users...`);
    
    const concurrencyResult = {
      concurrentUsers,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      durations: [] as number[],
      totalDuration: 0,
      averageResponseTime: 0,
      minResponseTime: Number.MAX_VALUE,
      maxResponseTime: 0,
      p95ResponseTime: 0,
      requestsPerSecond: 0
    };
    
    const startTime = Date.now();
    
    // Create requests
    const requests = [];
    for (let i = 0; i < concurrentUsers * REQUESTS_PER_USER; i++) {
      requests.push(runRequest(endpoint));
    }
    
    // Run all requests concurrently
    const results = await Promise.all(requests);
    
    for (const result of results) {
      concurrencyResult.totalRequests++;
      concurrencyResult.durations.push(result.duration);
      concurrencyResult.totalDuration += result.duration;
      
      if (result.success) {
        concurrencyResult.successfulRequests++;
      } else {
        concurrencyResult.failedRequests++;
      }
      
      concurrencyResult.minResponseTime = Math.min(concurrencyResult.minResponseTime, result.duration);
      concurrencyResult.maxResponseTime = Math.max(concurrencyResult.maxResponseTime, result.duration);
    }
    
    const totalDuration = Date.now() - startTime;
    
    // Calculate statistics
    concurrencyResult.averageResponseTime = concurrencyResult.totalDuration / concurrencyResult.totalRequests;
    concurrencyResult.p95ResponseTime = percentile(concurrencyResult.durations, 95);
    concurrencyResult.requestsPerSecond = (concurrencyResult.totalRequests / totalDuration) * 1000;
    
    console.log(`  Completed ${concurrencyResult.totalRequests} requests (${concurrencyResult.successfulRequests} successful, ${concurrencyResult.failedRequests} failed)`);
    console.log(`  Avg: ${concurrencyResult.averageResponseTime.toFixed(2)}ms, Min: ${concurrencyResult.minResponseTime}ms, Max: ${concurrencyResult.maxResponseTime}ms`);
    console.log(`  P95: ${concurrencyResult.p95ResponseTime}ms`);
    console.log(`  Throughput: ${concurrencyResult.requestsPerSecond.toFixed(2)} req/sec`);
    
    // Add concurrency result to results
    results.concurrencyTests.push(concurrencyResult);
  }
}

// Main function
async function runBenchmark(): Promise<void> {
  console.log('=== NeuroRoute Performance Benchmark ===');
  console.log(`API URL: ${API_URL}`);
  console.log(`API Key: ${API_KEY ? '********' : 'Not provided'}`);
  console.log('');
  
  const startTime = Date.now();
  
  // Test each endpoint
  for (const endpoint of ENDPOINTS) {
    const endpointResult = await testEndpoint(endpoint);
    results.endpoints[endpoint.name] = endpointResult;
    
    // Update global statistics
    results.totalRequests += endpointResult.requests;
    results.successfulRequests += endpointResult.successful;
    results.failedRequests += endpointResult.failed;
    results.totalDuration += endpointResult.totalDuration;
    
    if (endpointResult.minResponseTime < results.minResponseTime) {
      results.minResponseTime = endpointResult.minResponseTime;
    }
    
    if (endpointResult.maxResponseTime > results.maxResponseTime) {
      results.maxResponseTime = endpointResult.maxResponseTime;
    }
    
    console.log('');
  }
  
  // Run concurrency tests
  await runConcurrencyTests();
  
  // Calculate global statistics
  results.averageResponseTime = results.totalDuration / results.totalRequests;
  
  // Combine all durations for percentile calculations
  const allDurations: number[] = [];
  Object.values(results.endpoints).forEach((endpoint: any) => {
    allDurations.push(...endpoint.durations);
  });
  
  results.p95ResponseTime = percentile(allDurations, 95);
  results.p99ResponseTime = percentile(allDurations, 99);
  
  const totalDuration = Date.now() - startTime;
  results.requestsPerSecond = (results.totalRequests / totalDuration) * 1000;
  
  // Print summary
  console.log('\n=== Benchmark Summary ===\n');
  console.log(`Total Requests: ${results.totalRequests} (${results.successfulRequests} successful, ${results.failedRequests} failed)`);
  console.log(`Average Response Time: ${results.averageResponseTime.toFixed(2)}ms`);
  console.log(`Min Response Time: ${results.minResponseTime}ms`);
  console.log(`Max Response Time: ${results.maxResponseTime}ms`);
  console.log(`P95 Response Time: ${results.p95ResponseTime}ms`);
  console.log(`P99 Response Time: ${results.p99ResponseTime}ms`);
  console.log(`Overall Throughput: ${results.requestsPerSecond.toFixed(2)} req/sec`);
  
  // Save results to file
  const resultsFile = path.join(__dirname, 'results.json');
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to ${resultsFile}`);
}

// Run the benchmark
runBenchmark().catch(error => {
  console.error('Benchmark failed:', error);
  process.exit(1);
});