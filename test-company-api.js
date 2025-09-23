#!/usr/bin/env node

// Company API Test Script
// This script demonstrates how to test the Company API endpoints

const axios = require('axios');

const BASE_URL = 'http://localhost:8443/companies';

// Test data
const testCompany = {
  quickbooks_company_id: '9341455357036451',
  firs_business_id: 'BID123456789',
  tin: '12345678-0001'
};

const updateData = {
  firs_business_id: 'BID987654321',
  tin: '98765432-0001'
};

async function testAPI() {
  console.log('🧪 Testing Company API...\n');

  try {
    // Test 1: Health Check
    console.log('1. Testing Health Check...');
    try {
      const healthResponse = await axios.get(`${BASE_URL}/health/check`);
      console.log('✅ Health Check:', healthResponse.data);
    } catch (error) {
      console.log('❌ Health Check failed:', error.response?.data || error.message);
    }
    console.log('');

    // Test 2: Create Company
    console.log('2. Testing Create Company...');
    let companyId;
    try {
      const createResponse = await axios.post(BASE_URL, testCompany);
      console.log('✅ Company Created:', createResponse.data);
      companyId = createResponse.data.data?.id;
    } catch (error) {
      console.log('❌ Create Company failed:', error.response?.data || error.message);
      return; // Exit if we can't create a company
    }
    console.log('');

    // Test 3: Get All Companies
    console.log('3. Testing Get All Companies...');
    try {
      const getAllResponse = await axios.get(BASE_URL);
      console.log('✅ Get All Companies:', getAllResponse.data);
    } catch (error) {
      console.log('❌ Get All Companies failed:', error.response?.data || error.message);
    }
    console.log('');

    // Test 4: Search by QuickBooks ID
    console.log('4. Testing Search by QuickBooks ID...');
    try {
      const searchResponse = await axios.get(`${BASE_URL}/search?qb_id=${testCompany.quickbooks_company_id}`);
      console.log('✅ Search by QB ID:', searchResponse.data);
    } catch (error) {
      console.log('❌ Search by QB ID failed:', error.response?.data || error.message);
    }
    console.log('');

    if (companyId) {
      // Test 5: Get Company by ID
      console.log('5. Testing Get Company by ID...');
      try {
        const getByIdResponse = await axios.get(`${BASE_URL}/${companyId}`);
        console.log('✅ Get Company by ID:', getByIdResponse.data);
      } catch (error) {
        console.log('❌ Get Company by ID failed:', error.response?.data || error.message);
      }
      console.log('');

      // Test 6: Update Company
      console.log('6. Testing Update Company...');
      try {
        const updateResponse = await axios.put(`${BASE_URL}/${companyId}`, updateData);
        console.log('✅ Company Updated:', updateResponse.data);
      } catch (error) {
        console.log('❌ Update Company failed:', error.response?.data || error.message);
      }
      console.log('');

      // Test 7: Delete Company
      console.log('7. Testing Delete Company...');
      try {
        const deleteResponse = await axios.delete(`${BASE_URL}/${companyId}`);
        console.log('✅ Company Deleted:', deleteResponse.data);
      } catch (error) {
        console.log('❌ Delete Company failed:', error.response?.data || error.message);
      }
      console.log('');
    }

    // Test 8: Test Error Cases
    console.log('8. Testing Error Cases...');

    // Test invalid company ID
    try {
      await axios.get(`${BASE_URL}/invalid-id`);
    } catch (error) {
      console.log('✅ Invalid ID error handled correctly:', error.response?.data?.message || error.message);
    }

    // Test missing required fields
    try {
      await axios.post(BASE_URL, { quickbooks_company_id: 'test' });
    } catch (error) {
      console.log('✅ Validation error handled correctly:', error.response?.data?.message || error.message);
    }

    console.log('\n🎉 API Testing Complete!');

  } catch (error) {
    console.error('❌ Test setup failed:', error.message);
    console.log('\n💡 Make sure the server is running with: npm run start:dev');
    console.log('💡 And that Supabase environment variables are configured.');
  }
}

// Check if axios is available
try {
  require('axios');
} catch (error) {
  console.log('❌ axios is required to run this test script.');
  console.log('Install it with: npm install axios');
  process.exit(1);
}

// Check if server is likely running
const checkServer = async () => {
  try {
    await axios.get('http://localhost:8443/companies/health/check', { timeout: 2000 });
    return true;
  } catch (error) {
    return false;
  }
};

checkServer().then(isRunning => {
  if (!isRunning) {
    console.log('⚠️  Server doesn\'t appear to be running on localhost:8443');
    console.log('Start the server with: npm run start:dev');
    console.log('Proceeding with tests anyway...\n');
  }
  testAPI();
});