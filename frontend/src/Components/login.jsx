import React, { useState } from 'react';
import { Eye, EyeOff, Mail, Lock, LogIn, AlertCircle, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function SignInPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordStatus, setForgotPasswordStatus] = useState(null);
  const navigate = useNavigate();
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }

    if (submitStatus) {
      setSubmitStatus(null);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
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
      const payload = {
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
      };

      console.log('Login Payload:', payload);

      // TODO: Replace with your actual API endpoint
      const backendUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const API_ENDPOINT = `${backendUrl}/api/auth/login`;
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Login failed');
      }

      const data = await response.json();

      setSubmitStatus({ type: 'success', message: 'Login successful!' });
      console.log('Login successful:', data);

      // TODO: Store authentication token
      // localStorage.setItem('authToken', data.token);
      // localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('authToken', data.accessToken);
      localStorage.setItem('userRole', data.user.role);
      localStorage.setItem('userId', data.user.id);
      localStorage.setItem('company', JSON.stringify(data.user.company));
      // TODO: Redirect based on user role
      setTimeout(() => {
        if (data.user.role === 'admin') {
          navigate('/admin');
        } else if (data.user.role === 'manager') {
          navigate('/manager');
        } else {
          navigate('/employee');
        }
        console.log('Redirecting to dashboard...');
      }, 1000);

    } catch (error) {
      console.error('Login error:', error);
      setSubmitStatus({
        type: 'error',
        message: error.message || 'Invalid email or password. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!formData.email.trim()) {
      setErrors({ email: 'Please enter your email address first' });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setErrors({ email: 'Please enter a valid email address' });
      return;
    }

    setForgotPasswordLoading(true);
    setForgotPasswordStatus(null);

    try {
      const payload = {
        email: formData.email.trim().toLowerCase(),
      };

      console.log('Forgot Password Payload:', payload);

      // TODO: Replace with your actual API endpoint
      const API_ENDPOINT = 'YOUR_BACKEND_API_ENDPOINT/auth/forgot-password';

      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send reset email');
      }

      const data = await response.json();

      setForgotPasswordStatus({
        type: 'success',
        message: 'Password reset link has been sent to your email!'
      });
      console.log('Forgot password successful:', data);

    } catch (error) {
      console.error('Forgot password error:', error);
      setForgotPasswordStatus({
        type: 'error',
        message: error.message || 'Failed to send reset email. Please try again.'
      });
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl mb-4 shadow-lg">
            <LogIn className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Sign In</h1>
          <p className="text-gray-600">Welcome back! Please sign in to continue</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          {submitStatus && (
            <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${submitStatus.type === 'success'
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
              }`}>
              {submitStatus.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              )}
              <span className={`text-sm ${submitStatus.type === 'success' ? 'text-green-800' : 'text-red-800'
                }`}>
                {submitStatus.message}
              </span>
            </div>
          )}

          {forgotPasswordStatus && (
            <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${forgotPasswordStatus.type === 'success'
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
              }`}>
              {forgotPasswordStatus.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              )}
              <span className={`text-sm ${forgotPasswordStatus.type === 'success' ? 'text-green-800' : 'text-red-800'
                }`}>
                {forgotPasswordStatus.message}
              </span>
            </div>
          )}

          <div className="space-y-5">
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
                  placeholder="your.email@company.com"
                  autoComplete="email"
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
                  placeholder="Enter your password"
                  autoComplete="current-password"
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

            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className={`w-full py-3 px-4 rounded-lg font-medium text-white transition-all duration-200 ${loading
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
                  Signing In...
                </span>
              ) : (
                'Login'
              )}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={forgotPasswordLoading}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {forgotPasswordLoading ? 'Sending...' : 'Forgot password?'}
              </button>
            </div>
          </div>

          <div className="mt-6 text-center text-sm text-gray-600">
            Don't have an account?{' '}
            <a href="/signup" className="text-blue-600 hover:text-blue-700 font-medium">
              Sign Up
            </a>
          </div>
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <span className="font-semibold">Note:</span> Clicking "Forgot password?" will send a randomly generated unique password to your email. You can change your password after signing in.
          </p>
        </div>
      </div>
    </div>
  );
}