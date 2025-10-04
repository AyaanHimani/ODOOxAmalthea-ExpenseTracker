// services/companyService.js
/**
 * Company service
 * - createCompanyIfNeeded(name, country, currencyCode, validate=false)
 * - getCurrencyForCountry(countryName)
 *
 * Note:
 * - Frontend will send both country and currency; per spec country is authoritative.
 * - If validate === true, the service will check that the provided currencyCode
 *   matches the country-derived currency; if not, it will prefer the country-derived currency.
 */

const axios = require('axios');
const Company = require('../models/Company');

/**
 * Query restcountries API for currency info for a given country name.
 * Returns: { code, name, symbol } or null on failure.
 */
async function getCurrencyForCountry(countryName) {
  if (!countryName) return null;
  try {
    const url = `https://restcountries.com/v3.1/name/${encodeURIComponent(countryName)}?fields=name,currencies`;
    const resp = await axios.get(url, { timeout: 5000 });
    const data = resp.data;
    if (!Array.isArray(data) || data.length === 0) return null;

    const item = data[0];
    const currencies = item.currencies || {};
    const codes = Object.keys(currencies);
    if (codes.length === 0) return null;

    const code = codes[0];
    const c = currencies[code];
    return { code, name: c.name, symbol: c.symbol || '' };
  } catch (err) {
    console.warn('getCurrencyForCountry error:', err.message || err);
    return null;
  }
}

/**
 * Create a company if it doesn't exist (case-insensitive name match).
 * Params:
 *  - name (string) required
 *  - country (string) optional
 *  - currencyCode (string) optional (ISO code like 'INR'/'EUR')
 *  - validate (boolean) optional - if true, validates currencyCode against country-derived currency
 *
 * Returns the Company document (newly created or existing).
 */
async function createCompanyIfNeeded(name, country, currencyCode, validate = false) {
  if (!name) throw new Error('company name required');

  // case-insensitive lookup for existing company
  let company = await Company.findOne({ name: new RegExp(`^${name}$`, 'i') });
  if (company) return company;

  let currency = null;
  let base = null;

  // Per spec: country is authoritative. If country provided, try to derive currency from it.
  if (country) {
    const cc = await getCurrencyForCountry(country);
    if (cc) {
      base = cc.code;
      currency = cc;
    }
  }

  // If currency not derived from country, but frontend supplied currencyCode, use it.
  if (!base && currencyCode) {
    base = String(currencyCode).toUpperCase();
    currency = { code: base, name: base, symbol: '' };
    // Optionally validate against country-derived currency
    if (validate && country) {
      const cc = await getCurrencyForCountry(country);
      if (cc && cc.code && cc.code !== base) {
        // mismatch — prefer country-derived currency and log warning
        console.warn(`createCompanyIfNeeded: provided currency ${base} does not match country-derived ${cc.code}. Using ${cc.code}.`);
        base = cc.code;
        currency = cc;
      }
    }
  }

  // Final fallback to USD
  if (!base) {
    base = 'USD';
    currency = { code: 'USD', name: 'US Dollar', symbol: '$' };
  }

  company = await Company.create({
    name,
    country: country || '',
    currency,
    baseCurrency: base
  });

  return company;
}

module.exports = { createCompanyIfNeeded, getCurrencyForCountry };
