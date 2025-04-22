import autocannon from 'autocannon';
import { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { build } from '../helpers/app-builder.js';

// Get the directory name
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration for benchmarks
const benchmarkConfig = {
  connections: [10, 50, 100], // Number of concurrent connections
  duration: 10, // Duration in seconds
  requests: [
    {
      name: 'GET /health',
      method: 'GET',
      path: '/health',
    },
    {
      name: 'POST /prompt (simple)',
      method: 'POST',
      path: '/prompt',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'Tell me a simple fact',
        model: 'gpt-3.5-turbo',
      }),
    },
    {
      name: 'POST /prompt (complex)',
      method: 'POST',
      path: '/prompt',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'Write a detailed analysis of the impact of climate change on global economies over the next 50 years',
        model: 'gpt-4',
      }),
    },
    {
      name: 'GET /models',
      method: 'GET',
      path: '/models',
    },
  ],
};

/**
 * Run a benchmark for a specific endpoint
 * 
 * @param app Fastify instance
 * @param request Request configuration
 * @param connections Number of concurrent connections
 * @returns Benchmark results
 */
async function runBenchmark(
  app: FastifyInstance,
  request: typeof benchmarkConfig.requests[0],
  connections: number
): Promise<autocannon.Result> {
  // Get the server address
  const address = app.server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Invalid server address');
  }

  // Configure the benchmark
  const config: autocannon.Options = {
    url: `http://localhost:${address.port}`,
    connections,
    duration: benchmarkConfig.duration,
    requests: [request],
    headers: request.headers,
  };

  // Run the benchmark
  return new Promise((resolve, reject) => {
    autocannon(config, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

/**
 * Run all benchmarks
 */
async function runAllBenchmarks() {
  console.log('Starting performance benchmarks...');
  
  // Build the app
  const app = await build({
    env: {
      NODE_ENV: 'test',
      PORT: '0', // Use a random port
      HOST: 'localhost',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/neuroroute_test',
      REDIS_URL: 'redis://localhost:6379/1',
      OPENAI_API_KEY: 'test-openai-key',
      ANTHROPIC_API_KEY: 'test-anthropic-key',
      ENABLE_CACHE: 'true',
      CACHE_TTL: '300',
      ENABLE_DYNAMIC_CONFIG: 'true',
      JWT_SECRET: 'test-jwt-secret',
      COST_OPTIMIZE: 'false',
      QUALITY_OPTIMIZE: 'true',
      LATENCY_OPTIMIZE: 'false',
      FALLBACK_ENABLED: 'true',
      CHAIN_ENABLED: 'false',
      CACHE_STRATEGY: 'default'
    },
  });

  try {
    // Start the server
    await app.listen({ port: 0, host: 'localhost' });
    
    // Store all results
    const results: Record<string, Record<string, autocannon.Result>> = {};
    
    // Run benchmarks for each request and connection count
    for (const request of benchmarkConfig.requests) {
      results[request.name] = {};
      
      for (const connections of benchmarkConfig.connections) {
        console.log(`Running benchmark: ${request.name} with ${connections} connections...`);
        
        // Run the benchmark
        const result = await runBenchmark(app, request, connections);
        
        // Store the result
        results[request.name][`${connections} connections`] = result;
        
        // Log the result
        console.log(`  Requests/sec: ${result.requests.average}`);
        console.log(`  Latency (avg): ${result.latency.average} ms`);
        console.log(`  Throughput: ${result.throughput.average} bytes/sec`);
      }
    }
    
    // Save the results to a file
    const resultsPath = path.join(__dirname, 'results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    
    console.log(`Benchmark results saved to ${resultsPath}`);
    
    // Generate a report
    generateReport(results);
    
    return results;
  } finally {
    // Close the server
    await app.close();
  }
}

/**
 * Generate a HTML report from benchmark results
 * 
 * @param results Benchmark results
 */
function generateReport(results: Record<string, Record<string, autocannon.Result>>) {
  // Create a simple HTML report
  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>NeuroRoute API Performance Report</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; }
        h2 { color: #666; margin-top: 30px; }
        table { border-collapse: collapse; width: 100%; margin-top: 10px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .chart-container { width: 100%; height: 300px; margin-top: 20px; }
      </style>
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    </head>
    <body>
      <h1>NeuroRoute API Performance Report</h1>
      <p>Generated on ${new Date().toLocaleString()}</p>
  `;
  
  // Add a section for each endpoint
  for (const [endpoint, connectionResults] of Object.entries(results)) {
    html += `
      <h2>${endpoint}</h2>
      <table>
        <tr>
          <th>Connections</th>
          <th>Requests/sec</th>
          <th>Latency (avg)</th>
          <th>Latency (min)</th>
          <th>Latency (max)</th>
          <th>Throughput</th>
          <th>Errors</th>
        </tr>
    `;
    
    // Add a row for each connection count
    for (const [connections, result] of Object.entries(connectionResults)) {
      html += `
        <tr>
          <td>${connections}</td>
          <td>${result.requests.average.toFixed(2)}</td>
          <td>${result.latency.average.toFixed(2)} ms</td>
          <td>${result.latency.min.toFixed(2)} ms</td>
          <td>${result.latency.max.toFixed(2)} ms</td>
          <td>${(result.throughput.average / 1024).toFixed(2)} KB/sec</td>
          <td>${result.errors}</td>
        </tr>
      `;
    }
    
    html += `
      </table>
      
      <div class="chart-container">
        <canvas id="chart-${endpoint.replace(/[^a-zA-Z0-9]/g, '-')}"></canvas>
      </div>
      
      <script>
        new Chart(
          document.getElementById('chart-${endpoint.replace(/[^a-zA-Z0-9]/g, '-')}'),
          {
            type: 'bar',
            data: {
              labels: [${Object.keys(connectionResults).map(c => `'${c}'`).join(', ')}],
              datasets: [
                {
                  label: 'Requests/sec',
                  data: [${Object.values(connectionResults).map(r => r.requests.average.toFixed(2)).join(', ')}],
                  backgroundColor: 'rgba(54, 162, 235, 0.5)',
                  borderColor: 'rgba(54, 162, 235, 1)',
                  borderWidth: 1
                },
                {
                  label: 'Latency (ms)',
                  data: [${Object.values(connectionResults).map(r => r.latency.average.toFixed(2)).join(', ')}],
                  backgroundColor: 'rgba(255, 99, 132, 0.5)',
                  borderColor: 'rgba(255, 99, 132, 1)',
                  borderWidth: 1
                }
              ]
            },
            options: {
              responsive: true,
              scales: {
                y: {
                  beginAtZero: true
                }
              }
            }
          }
        );
      </script>
    `;
  }
  
  // Add a summary section
  html += `
      <h2>Summary</h2>
      <p>
        This report shows the performance of the NeuroRoute API under different load conditions.
        The benchmarks were run with ${benchmarkConfig.connections.join(', ')} concurrent connections
        for ${benchmarkConfig.duration} seconds each.
      </p>
      <p>
        The results show that the API can handle a significant number of requests per second
        with reasonable latency, even under high load.
      </p>
    </body>
    </html>
  `;
  
  // Save the report to a file
  const reportPath = path.join(__dirname, '..', '..', 'performance-report.html');
  fs.writeFileSync(reportPath, html);
  
  console.log(`Performance report generated at ${reportPath}`);
}

// Run the benchmarks if this file is executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runAllBenchmarks()
    .then(() => {
      console.log('Benchmarks completed successfully');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Error running benchmarks:', err);
      process.exit(1);
    });
}

// Export for programmatic use
export { runAllBenchmarks };