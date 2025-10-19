// Quick API Testing Script

async function testAPI() {
  console.log('🚀 Testing Codex API endpoints...\n');
  
  // Test 1: Health Check
  try {
    const health = await fetch('http://localhost:4000/healthz');
    const healthData = await health.json();
    console.log('✅ Health Check:', health.status, healthData);
  } catch (err) {
    console.log('❌ Health Check Failed:', err.message);
  }
  
  // Test 2: Metrics
  try {
    const metrics = await fetch('http://localhost:4000/metrics');
    const metricsText = await metrics.text();
    console.log('✅ Metrics:', metrics.status, metricsText.substring(0, 100) + '...');
  } catch (err) {
    console.log('❌ Metrics Failed:', err.message);
  }
  
  // Test 3: Auth Login (should fail without valid credentials)
  try {
    const auth = await fetch('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'wrongpassword' })
    });
    const authData = await auth.json();
    console.log('✅ Auth Login (expected fail):', auth.status, authData);
  } catch (err) {
    console.log('❌ Auth Login Failed:', err.message);
  }
  
  // Test 4: Products (should fail without auth)
  try {
    const products = await fetch('http://localhost:4000/api/products');
    const productsData = await products.json();
    console.log('✅ Products (expected 401):', products.status, productsData);
  } catch (err) {
    console.log('❌ Products Failed:', err.message);
  }
  
  console.log('\n🎯 API Testing Complete!');
}

testAPI().catch(console.error);