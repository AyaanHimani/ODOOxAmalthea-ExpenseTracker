import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Building2, User, Mail, Lock, Globe, CheckCircle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AdminSignupPage() {
  const [formData, setFormData] = useState({
    companyName: '',
    email: '',
    password: '',
    confirmPassword: '',
    country: '',
  });

  const [countries, setCountries] = useState([]);
  const [selectedCountryData, setSelectedCountryData] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [submitStatus, setSubmitStatus] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCountries();
  }, []);

  const fetchCountries = async () => {
    try {
      setCountriesLoading(true);
      const response = await fetch('https://restcountries.com/v3.1/all?fields=name,currencies,cca2');
      const data = await response.json();

      const sortedCountries = data
        .filter(country => country.currencies)
        .sort((a, b) => a.name.common.localeCompare(b.name.common));

      setCountries(sortedCountries);
      setCountriesLoading(false);
    } catch (error) {
      console.error('Error fetching countries:', error);
      setCountriesLoading(false);
      setErrors(prev => ({ ...prev, countries: 'Failed to load countries' }));
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleCountryChange = (e) => {
    const countryCode = e.target.value;
    setFormData(prev => ({ ...prev, country: countryCode }));

    const country = countries.find(c => c.cca2 === countryCode);
    setSelectedCountryData(country);

    if (errors.country) {
      setErrors(prev => ({ ...prev, country: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!formData.country) {
      newErrors.country = 'Please select a country';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitStatus(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const currencyCode = Object.keys(selectedCountryData.currencies)[0];
      const currencyData = selectedCountryData.currencies[currencyCode];

      const payload = {
        companyName: formData.companyName.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        country: {
          code: selectedCountryData.cca2,
          name: selectedCountryData.name.common,
        },
        currency: {
          code: currencyCode,
          name: currencyData.name,
          symbol: currencyData.symbol || currencyCode,
        },
      };

      console.log('Signup Payload:', payload);
      const backendUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
      const API_ENDPOINT = `${backendUrl}/api/auth/signup`;

      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Signup failed');
      }

      const data = await response.json();
      localStorage.setItem("authToken", data.accessToken);
      localStorage.setItem("userRole", data.user.role);
      localStorage.setItem("userId", data.user.id);

      setSubmitStatus({ type: 'success', message: 'Account created successfully!' });
      console.log('Signup successful:', data);

      navigate('/login');

    } catch (error) {
      console.error('Signup error:', error);
      setSubmitStatus({
        type: 'error',
        message: error.message || 'Failed to create account. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const getCurrencyDisplay = () => {
    if (!selectedCountryData) return null;

    const currencyCode = Object.keys(selectedCountryData.currencies)[0];
    const currency = selectedCountryData.currencies[currencyCode];

    return (
      <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center gap-2 text-sm text-blue-900">
          <Globe className="w-4 h-4" />
          <span className="font-medium">Company Base Currency:</span>
          <span className="font-semibold">
            {currency.symbol || ''} {currencyCode} - {currency.name}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl mb-4 shadow-lg">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Admin Account</h1>
          <p className="text-gray-600">Set up your company's expense management system</p>
          <p className="text-sm text-gray-500 mt-1">1 admin user per company</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          {submitStatus && (
            <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${submitStatus.type === 'success'
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
              }`}>
              {submitStatus.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              )}
              <span className={`text-sm ${submitStatus.type === 'success' ? 'text-green-800' : 'text-red-800'
                }`}>
                {submitStatus.message}
              </span>
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Company Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className={`w-full pl-11 pr-4 py-3 border ${errors.name ? 'border-red-300' : 'border-gray-300'
                    } rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition`}
                  placeholder="Enter Company name"
                />
              </div>
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={`w-full pl-11 pr-4 py-3 border ${errors.email ? 'border-red-300' : 'border-gray-300'
                    } rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition`}
                  placeholder="admin@company.com"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className={`w-full pl-11 pr-12 py-3 border ${errors.password ? 'border-red-300' : 'border-gray-300'
                    } rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition`}
                  placeholder="Create a strong password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className={`w-full pl-11 pr-12 py-3 border ${errors.confirmPassword ? 'border-red-300' : 'border-gray-300'
                    } rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition`}
                  placeholder="Re-enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
              )}
            </div>

            <div>
              <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-2">
                Country Selection
              </label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none z-10" />
                <select
                  id="country"
                  name="country"
                  value={formData.country}
                  onChange={handleCountryChange}
                  disabled={countriesLoading}
                  className={`w-full pl-11 pr-10 py-3 border ${errors.country ? 'border-red-300' : 'border-gray-300'
                    } rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition appearance-none bg-white cursor-pointer ${countriesLoading ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                >
                  <option value="">
                    {countriesLoading ? 'Loading countries...' : 'Select your country'}
                  </option>
                  {countries.map((country) => {
                    const currencyCode = Object.keys(country.currencies)[0];
                    return (
                      <option key={country.cca2} value={country.cca2}>
                        {country.name.common} ({currencyCode})
                      </option>
                    );
                  })}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              {errors.country && (
                <p className="mt-1 text-sm text-red-600">{errors.country}</p>
              )}
              {errors.countries && (
                <p className="mt-1 text-sm text-red-600">{errors.countries}</p>
              )}

              {getCurrencyDisplay()}
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800">
                <span className="font-semibold">Note:</span> The selected country's currency will be set as your company's base currency for all expense management operations.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || countriesLoading}
              className={`w-full py-3 px-4 rounded-lg font-medium text-white transition-all duration-200 ${loading || countriesLoading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl'
                }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating Account...
                </span>
              ) : (
                'Create Company and Admin Account'
              )}
            </button>
          </div>

          <div className="mt-6 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <a href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
              Sign In
            </a>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-gray-500">
          By signing up, you agree to our Terms of Service and Privacy Policy
        </div>
      </div>
    </div>
  );
}