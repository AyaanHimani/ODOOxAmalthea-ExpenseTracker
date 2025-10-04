// services/companyService.js
const Company = require('../models/Company');

async function createCompanyIfNeeded(companyName, countryName, currencyObj) {
  let company = await Company.findOne({ name: companyName });
  if (company) return company;

  if (!countryName) countryName = 'Unknown';
  if (!currencyObj || !currencyObj.code) {
    currencyObj = { code: 'USD', name: 'US Dollar', symbol: '$' };
  }

  company = await Company.create({
    name: companyName,
    country: String(countryName),
    currency: {
      code: String(currencyObj.code),
      name: currencyObj.name || '',
      symbol: currencyObj.symbol || ''
    },
    approvalFlows: [],
    approvalRules: []
  });
  return company;
}

module.exports = { createCompanyIfNeeded };
