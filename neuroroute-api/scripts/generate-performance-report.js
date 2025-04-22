#!/usr/bin/env node

/**
 * Performance Report Generator
 * 
 * This script generates an HTML report from performance test results.
 * It reads the performance test results from the test/performance/results.json file
 * and generates a comprehensive HTML report with charts and tables.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const RESULTS_FILE = path.join(__dirname, '../test/performance/results.json');
const REPORT_FILE = path.join(__dirname, '../performance-report.html');
const PACKAGE_JSON = path.join(__dirname, '../package.json');

// Check if results file exists
if (!fs.existsSync(RESULTS_FILE)) {
  console.error(`Error: Results file not found at ${RESULTS_FILE}`);
  console.error('Run performance tests first to generate results.');
  process.exit(1);
}

// Read results
let results;
try {
  results = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8'));
} catch (error) {
  console.error(`Error parsing results file: ${error.message}`);
  process.exit(1);
}

// Read package.json for version
let version = 'unknown';
try {
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
  version = packageJson.version ?? 'unknown';
} catch (error) {
  console.warn(`Warning: Could not read package.json: ${error.message}`);
}

// Get git commit info
let gitCommit = 'unknown';
let gitBranch = 'unknown';
try {
  gitCommit = execSync('git rev-parse --short HEAD').toString().trim();
  gitBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
} catch (error) {
  console.warn(`Warning: Could not get git info: ${error.message}`);
}

// Get timestamp
const timestamp = new Date().toISOString();

// Generate HTML report
function generateReport(results) {
  // Calculate summary statistics
  const summary = {
    totalRequests: results.totalRequests ?? 0,
    successfulRequests: results.successfulRequests ?? 0,
    failedRequests: results.failedRequests ?? 0,
    totalDuration: results.totalDuration ?? 0,
    averageResponseTime: results.averageResponseTime ?? 0,
    minResponseTime: results.minResponseTime ?? 0,
    maxResponseTime: results.maxResponseTime ?? 0,
    p95ResponseTime: results.p95ResponseTime ?? 0,
    p99ResponseTime: results.p99ResponseTime ?? 0,
    requestsPerSecond: results.requestsPerSecond ?? 0,
  };

  // Calculate success rate
  const successRate = summary.totalRequests > 0 
    ? (summary.successfulRequests / summary.totalRequests) * 100 
    : 0;

  // Generate endpoint-specific data for charts
  const endpoints = results.endpoints ?? {};
  const endpointNames = Object.keys(endpoints);
  const responseTimeData = endpointNames.map(name => ({
    name,
    avg: endpoints[name].averageResponseTime ?? 0,
    min: endpoints[name].minResponseTime ?? 0,
    max: endpoints[name].maxResponseTime ?? 0,
    p95: endpoints[name].p95ResponseTime ?? 0,
  }));

  const throughputData = endpointNames.map(name => ({
    name,
    rps: endpoints[name].requestsPerSecond ?? 0,
  }));

  // Generate HTML
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NeuroRoute Performance Report</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 1px solid #eee;
    }
    .header h1 {
      margin-bottom: 5px;
      color: #2c3e50;
    }
    .header p {
      color: #7f8c8d;
      margin: 5px 0;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .summary-card {
      background-color: #f8f9fa;
      border-radius: 8px;
      padding: 15px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    .summary-card h3 {
      margin-top: 0;
      color: #2c3e50;
      font-size: 16px;
    }
    .summary-card p {
      font-size: 24px;
      font-weight: bold;
      margin: 10px 0 0;
      color: #3498db;
    }
    .summary-card.success p {
      color: #27ae60;
    }
    .summary-card.warning p {
      color: #f39c12;
    }
    .summary-card.danger p {
      color: #e74c3c;
    }
    .chart-container {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
      gap: 30px;
      margin-bottom: 30px;
    }
    .chart-card {
      background-color: #fff;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .chart-card h2 {
      margin-top: 0;
      color: #2c3e50;
      font-size: 18px;
      margin-bottom: 20px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    th, td {
      padding: 12px 15px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th {
      background-color: #f8f9fa;
      font-weight: 600;
      color: #2c3e50;
    }
    tr:hover {
      background-color: #f8f9fa;
    }
    .footer {
      text-align: center;
      margin-top: 50px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      color: #7f8c8d;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>NeuroRoute Performance Report</h1>
    <p>Version: ${version} | Commit: ${gitCommit} | Branch: ${gitBranch}</p>
    <p>Generated: ${new Date(timestamp).toLocaleString()}</p>
  </div>

  <div class="summary">
    <div class="summary-card">
      <h3>Total Requests</h3>
      <p>${summary.totalRequests.toLocaleString()}</p>
    </div>
    <div class="summary-card success">
      <h3>Success Rate</h3>
      <p>${successRate.toFixed(2)}%</p>
    </div>
    <div class="summary-card">
      <h3>Avg Response Time</h3>
      <p>${summary.averageResponseTime.toFixed(2)} ms</p>
    </div>
    <div class="summary-card">
      <h3>Requests/Second</h3>
      <p>${summary.requestsPerSecond.toFixed(2)}</p>
    </div>
    <div class="summary-card warning">
      <h3>P95 Response Time</h3>
      <p>${summary.p95ResponseTime.toFixed(2)} ms</p>
    </div>
    <div class="summary-card danger">
      <h3>Max Response Time</h3>
      <p>${summary.maxResponseTime.toFixed(2)} ms</p>
    </div>
  </div>

  <div class="chart-container">
    <div class="chart-card">
      <h2>Response Time by Endpoint</h2>
      <canvas id="responseTimeChart"></canvas>
    </div>
    <div class="chart-card">
      <h2>Throughput by Endpoint</h2>
      <canvas id="throughputChart"></canvas>
    </div>
  </div>

  <h2>Endpoint Details</h2>
  <table>
    <thead>
      <tr>
        <th>Endpoint</th>
        <th>Requests</th>
        <th>Success</th>
        <th>Avg (ms)</th>
        <th>Min (ms)</th>
        <th>Max (ms)</th>
        <th>P95 (ms)</th>
        <th>Req/Sec</th>
      </tr>
    </thead>
    <tbody>
      ${endpointNames.map(name => {
        const endpoint = endpoints[name];
        return `
          <tr>
            <td>${name}</td>
            <td>${endpoint.requests || 0}</td>
            <td>${endpoint.successful || 0}</td>
            <td>${(endpoint.averageResponseTime || 0).toFixed(2)}</td>
            <td>${(endpoint.minResponseTime ?? 0).toFixed(2)}</td>
            <td>${(endpoint.maxResponseTime ?? 0).toFixed(2)}</td>
            <td>${(endpoint.p95ResponseTime ?? 0).toFixed(2)}</td>
            <td>${(endpoint.requestsPerSecond ?? 0).toFixed(2)}</td>
          </tr>
        `;
      }).join('')}
    </tbody>
  </table>

  <h2>Concurrency Test Results</h2>
  <table>
    <thead>
      <tr>
        <th>Concurrent Users</th>
        <th>Avg Response Time (ms)</th>
        <th>Req/Sec</th>
        <th>Success Rate</th>
      </tr>
    </thead>
    <tbody>
      ${(results.concurrencyTests || []).map(test => `
        <tr>
          <td>${test.concurrentUsers}</td>
          <td>${(test.averageResponseTime ?? 0).toFixed(2)}</td>
          <td>${(test.requestsPerSecond ?? 0).toFixed(2)}</td>
          <td>${((test.successfulRequests / test.totalRequests) * 100 || 0).toFixed(2)}%</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="chart-card">
    <h2>Response Time vs Concurrency</h2>
    <canvas id="concurrencyChart"></canvas>
  </div>

  <div class="footer">
    <p>NeuroRoute Performance Report | Generated by CI/CD Pipeline</p>
  </div>

  <script>
    // Response Time Chart
    const responseTimeCtx = document.getElementById('responseTimeChart').getContext('2d');
    new Chart(responseTimeCtx, {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(responseTimeData.map(d => d.name))},
        datasets: [
          {
            label: 'Avg Response Time (ms)',
            data: ${JSON.stringify(responseTimeData.map(d => d.avg))},
            backgroundColor: 'rgba(52, 152, 219, 0.7)',
            borderColor: 'rgba(52, 152, 219, 1)',
            borderWidth: 1
          },
          {
            label: 'P95 Response Time (ms)',
            data: ${JSON.stringify(responseTimeData.map(d => d.p95))},
            backgroundColor: 'rgba(243, 156, 18, 0.7)',
            borderColor: 'rgba(243, 156, 18, 1)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Response Time (ms)'
            }
          }
        }
      }
    });

    // Throughput Chart
    const throughputCtx = document.getElementById('throughputChart').getContext('2d');
    new Chart(throughputCtx, {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(throughputData.map(d => d.name))},
        datasets: [{
          label: 'Requests per Second',
          data: ${JSON.stringify(throughputData.map(d => d.rps))},
          backgroundColor: 'rgba(46, 204, 113, 0.7)',
          borderColor: 'rgba(46, 204, 113, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Requests per Second'
            }
          }
        }
      }
    });

    // Concurrency Chart
    const concurrencyCtx = document.getElementById('concurrencyChart').getContext('2d');
    new Chart(concurrencyCtx, {
      type: 'line',
      data: {
        labels: ${JSON.stringify((results.concurrencyTests || []).map(t => t.concurrentUsers))},
        datasets: [{
          label: 'Avg Response Time (ms)',
          data: ${JSON.stringify((results.concurrencyTests || []).map(t => t.averageResponseTime ?? 0))},
          backgroundColor: 'rgba(52, 152, 219, 0.1)',
          borderColor: 'rgba(52, 152, 219, 1)',
          borderWidth: 2,
          tension: 0.3,
          fill: true
        }]
      },
      options: {
        responsive: true,
        scales: {
          x: {
            title: {
              display: true,
              text: 'Concurrent Users'
            }
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Response Time (ms)'
            }
          }
        }
      }
    });
  </script>
</body>
</html>`;
}

// Generate and write report
try {
  const reportHtml = generateReport(results);
  fs.writeFileSync(REPORT_FILE, reportHtml);
  console.log(`Performance report generated at: ${REPORT_FILE}`);
} catch (error) {
  console.error(`Error generating report: ${error.message}`);
  process.exit(1);
}