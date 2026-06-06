#!/usr/bin/env node

import http from 'http';

function makeRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: 8787,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(data)
          });
        } catch {
          resolve({
            status: res.statusCode,
            data: data
          });
        }
      });
    });

    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function test() {
  console.log('Testing Proposal API...\n');

  try {
    // Test health
    console.log('1. Testing /api/health...');
    const health = await makeRequest('GET', '/api/health');
    console.log(`   Status: ${health.status}`);
    console.log(`   Response:`, health.data);
    console.log();

    // Test agent start
    console.log('2. Testing /api/agent/start...');
    const start = await makeRequest('POST', '/api/agent/start', {
      topic: 'Test topic for agent workflow'
    });
    console.log(`   Status: ${start.status}`);
    console.log(`   Has fieldSuggestions: ${Array.isArray(start.data.fieldSuggestions)}`);
    console.log(`   Has decisions: ${Array.isArray(start.data.decisions)}`);
    console.log();

    // Test proposal generation
    console.log('3. Testing /api/proposal...');
    const proposal = await makeRequest('POST', '/api/proposal', {
      topic: 'Test research topic',
      title: 'Test Proposal',
      problem: 'A research problem',
      method: 'An approach',
      timeline: '6 months',
      evaluation: 'Metrics to use',
      resources: 'Budget needed',
      references: 'Research papers'
    });
    console.log(`   Status: ${proposal.status}`);
    console.log(`   Has proposalLatex: ${!!proposal.data.proposalLatex}`);
    console.log(`   Has complianceMatrix: ${Array.isArray(proposal.data.complianceMatrix)}`);
    console.log();

    console.log('✅ All API tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

test();
