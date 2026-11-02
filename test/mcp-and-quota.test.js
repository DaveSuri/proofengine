const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { verifyProofJWT, resetQuota, FREE_QUOTA } = require('../packages/solver-api/dist/index.js');

function callMcpServerOverStdio(requests) {
  return new Promise((resolve, reject) => {
    const serverBin = path.resolve(__dirname, '../packages/mcp-server/dist/index.js');
    const child = spawn(process.execPath, [serverBin], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    let stdoutBuf = '';
    const responses = [];

    child.stdout.on('data', chunk => {
      stdoutBuf += chunk.toString();
      const lines = stdoutBuf.split('\n');
      stdoutBuf = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.id !== undefined) {
            responses.push(msg);
            if (responses.length >= requests.length) {
              child.kill();
              resolve(responses);
            }
          }
        } catch {
          // ignore non-json
        }
      }
    });

    child.on('error', reject);
    setTimeout(() => {
      child.kill();
      reject(new Error(`MCP server test timed out. Got ${responses.length}/${requests.length} responses`));
    }, 10000);

    for (const req of requests) {
      child.stdin.write(JSON.stringify(req) + '\n');
    }
  });
}

async function runMcpAndQuotaTests() {
  console.log('=== Milestone 4 & 5 Verification: MCP Server & Freemium Payment Gate ===\n');

  const testWorkspaceId = 'test_mcp_workspace_' + Date.now();
  resetQuota(testWorkspaceId);

  const buggyProrationPath = path.resolve(__dirname, 'fixtures/proration.ts');
  const fixedProrationPath = path.resolve(__dirname, 'fixtures/proration-fixed.ts');

  // 1. Launch MCP server over stdio and simulate agent tool calls
  const mcpResponses = await callMcpServerOverStdio([
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'cursor-agent-sim', version: '1.0.0' },
      },
    },
    {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    },
    {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'verify_financial_invariants',
        arguments: {
          filePath: buggyProrationPath,
          workspaceId: testWorkspaceId,
        },
      },
    },
    {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'verify_financial_invariants',
        arguments: {
          filePath: fixedProrationPath,
          workspaceId: testWorkspaceId,
        },
      },
    },
  ]);

  const listToolsRes = mcpResponses.find(r => r.id === 2);
  const toolNames = listToolsRes.result.tools.map(t => t.name);
  assert.ok(toolNames.includes('verify_financial_invariants'), 'Missing verify_financial_invariants tool');
  assert.ok(toolNames.includes('purchase_verification_subscription'), 'Missing purchase_verification_subscription tool');
  console.log('1. MCP Tools exposed:', toolNames.join(', '));

  // Verify VIOLATION response from MCP server
  const violationCallRes = mcpResponses.find(r => r.id === 3);
  const violationPayload = JSON.parse(violationCallRes.result.content[0].text);
  assert.equal(violationPayload.overall_status, 'SOME_VIOLATIONS');
  const invViolation = violationPayload.invariant_results[0];
  assert.equal(invViolation.status, 'VIOLATION');
  assert.ok(invViolation.counterexample.inputs, 'Expected structured inputs in MCP counterexample');
  assert.notEqual(invViolation.counterexample.drift, 0, 'Expected non-zero drift in MCP counterexample');
  console.log('2. MCP verify_financial_invariants (VIOLATION) returned counterexample:', JSON.stringify(invViolation.counterexample));

  // Verify PROVEN response from MCP server
  const provenCallRes = mcpResponses.find(r => r.id === 4);
  const provenPayload = JSON.parse(provenCallRes.result.content[0].text);
  assert.equal(provenPayload.overall_status, 'ALL_PROVEN');
  const invProven = provenPayload.invariant_results[0];
  assert.equal(invProven.status, 'PROVEN');
  assert.ok(invProven.proof_jwt, 'Expected signed proof_jwt in MCP response');
  assert.ok(verifyProofJWT(invProven.proof_jwt), 'Expected valid HS256 JWT signature');
  console.log('3. MCP verify_financial_invariants (PROVEN) returned signed JWT:', invProven.proof_jwt.slice(0, 36) + '...');

  // Milestone 5: Exhaust free quota (10 verifications per workspace)
  // 2 verifications already consumed above; consume remaining 8
  assert.equal(FREE_QUOTA, 10, 'Expected FREE_QUOTA to be 10 verifications per workspace');
  const { toolVerifyInvariants, toolPurchaseSubscription } = require('../packages/mcp-server/dist/index.js');
  for (let i = 3; i <= 10; i++) {
    const res = await toolVerifyInvariants({
      filePath: fixedProrationPath,
      workspaceId: testWorkspaceId,
    });
    const parsed = JSON.parse(res.content[0].text);
    assert.equal(parsed.overall_status, 'ALL_PROVEN', `Verification #${i} should succeed within 10 free quota`);
  }

  // 11th verification must trigger HTTP 402 PAYMENT_REQUIRED
  const eleventhRes = await toolVerifyInvariants({
    filePath: buggyProrationPath,
    workspaceId: testWorkspaceId,
  });
  const paymentRequired = JSON.parse(eleventhRes.content[0].text);
  console.log('\n4. Milestone 5 Quota Exhausted (11th call) HTTP 402 Payload:');
  console.log(
    JSON.stringify(
      {
        status: paymentRequired.status,
        tier: paymentRequired.tier,
        price_usd: paymentRequired.price_usd,
        approval_prompt: paymentRequired.approval_prompt,
      },
      null,
      2,
    ),
  );

  assert.equal(paymentRequired.status, 'PAYMENT_REQUIRED');
  assert.equal(paymentRequired.http_code, 402);
  assert.equal(paymentRequired.tier, 'dev-pro');
  assert.equal(paymentRequired.price_usd, 49.0);
  assert.equal(
    paymentRequired.approval_prompt,
    'ProofEngine detected unverified billing branches. Would you like me to authorize Developer Pro ($49/mo)?',
  );

  // Test programmatic subscription upgrade after consent
  const upgradeRes = await toolPurchaseSubscription({
    tier: 'dev-pro',
    autoApprove: true,
    workspaceId: testWorkspaceId,
  });
  const upgradePayload = JSON.parse(upgradeRes.content[0].text);
  assert.equal(upgradePayload.status, 'SUBSCRIBED');
  assert.equal(upgradePayload.tier, 'dev-pro');
  assert.equal(upgradePayload.quota_refreshed, true);
  console.log('5. Subscription upgraded to dev-pro:', upgradePayload.message);

  // Verify 12th call now succeeds after upgrade
  const twelfthRes = await toolVerifyInvariants({
    filePath: fixedProrationPath,
    workspaceId: testWorkspaceId,
  });
  const twelfthPayload = JSON.parse(twelfthRes.content[0].text);
  assert.equal(twelfthPayload.overall_status, 'ALL_PROVEN');

  console.log('\n✔ Milestone 4 & Milestone 5 Verification PASSED (100% assertions succeeded)\n');
  process.exit(0);
}

runMcpAndQuotaTests().catch(err => {
  console.error('Milestone 4/5 Verification FAILED:', err);
  process.exit(1);
});
