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
  console.log('Testing Generate Proposal...\n');

  try {
    const proposal = await makeRequest('POST', '/api/proposal', {
      topic: 'Citation-grounded agent for literature review workflows',
      title: 'Citation-Grounded Literature Review Agent',
      problem: 'Literature review processes are time-consuming and error-prone without proper citation tracking',
      method: 'An AI agent that retrieves papers and maintains citation context throughout workflow',
      timeline: '6 months implementation, 2 months testing',
      evaluation: 'Compare against manual review time and accuracy metrics',
      resources: '$50k for computational resources and APIs',
      references: 'Papers on RAG, citation networks, and information retrieval'
    });
    
    console.log(`Status: ${proposal.status}`);
    console.log(`Has proposalLatex: ${!!proposal.data.proposalLatex}`);
    console.log(`Has complianceMatrix: ${Array.isArray(proposal.data.complianceMatrix)}`);
    console.log(`Has evaluationReport: ${!!proposal.data.evaluationReport}`);
    console.log(`Has questions: ${Array.isArray(proposal.data.questions)}`);
    console.log();
    
    if (proposal.data.proposalLatex) {
      console.log('LaTeX Preview (first 500 chars):');
      console.log(proposal.data.proposalLatex.substring(0, 500));
      console.log('...');
    }
    
    if (proposal.data.error) {
      console.log('ERROR:', proposal.data.error);
      console.log('DETAIL:', proposal.data.detail);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

test();
