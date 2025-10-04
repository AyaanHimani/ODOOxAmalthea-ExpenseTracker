import React, { useState, useEffect, useRef } from "react";
import { Upload, X, FileText, Calendar, DollarSign, Tag, FileCheck, Clock, Eye, MessageSquare, AlertCircle, CheckCircle, XCircle, Loader, Camera, ArrowUpCircle, RefreshCw } from "lucide-react";

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// API Helper Functions
const api = {
  // Get auth token from localStorage
  getToken: () => localStorage.getItem('token'),
  
  // Get headers with auth
  getHeaders: () => ({
    'Authorization': `Bearer ${api.getToken()}`,
  }),

  // Submit new expense
  createExpense: async (expenseData) => {
    const response = await fetch(`${API_BASE_URL}/expenses`, {
      method: 'POST',
      headers: {
        ...api.getHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(expenseData),
    });
    if (!response.ok) throw new Error('Failed to create expense');
    return response.json();
  },

  // List expenses
  listExpenses: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${API_BASE_URL}/expenses?${params}`, {
      headers: api.getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch expenses');
    return response.json();
  },

  // OCR extraction
  extractReceiptData: async (file) => {
    const formData = new FormData();
    formData.append('receipt', file);
    
    const response = await fetch(`${API_BASE_URL}/ocr/extract`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error('OCR extraction failed');
    return response.json();
  },

  // Upload receipt (if you have a separate endpoint)
  uploadReceipt: async (file) => {
    const formData = new FormData();
    formData.append('receipt', file);
    
    const response = await fetch(`${API_BASE_URL}/receipts/upload`, {
      method: 'POST',
      headers: api.getHeaders(),
      body: formData,
    });
    if (!response.ok) throw new Error('Failed to upload receipt');
    return response.json();
  },
};

const categories = [
  "Travel",
  "Food",
  "Office Supplies",
  "Accommodation",
  "Transportation",
  "Meals & Entertainment",
  "Communication",
  "Miscellaneous",
];

function formatDateISO(d) {
  const dt = new Date(d);
  return dt.toISOString().split("T")[0];
}

export default function EmployeeDashboard() {
  const [amount, setAmount] = useState("");
  const [originalAmount, setOriginalAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [date, setDate] = useState(formatDateISO(new Date()));
  const [category, setCategory] = useState(categories[0]);
  const [description, setDescription] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [receipts, setReceipts] = useState([]);
  const [receiptUrls, setReceiptUrls] = useState([]); // For backend URLs
  const [previewUrls, setPreviewUrls] = useState([]);
  const [errors, setErrors] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [history, setHistory] = useState([]);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [companyInfo, setCompanyInfo] = useState({ name: "ACME Ltd", currency: "USD" });
  const fileInputRef = useRef();

  // Fetch expenses on mount
  useEffect(() => {
    fetchExpenses();
  }, []);

  useEffect(() => {
    const urls = receipts.map((f) => URL.createObjectURL(f));
    setPreviewUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [receipts]);

  async function fetchExpenses() {
    try {
      setLoading(true);
      const data = await api.listExpenses();
      setHistory(data.expenses || []);
    } catch (error) {
      console.error('Error fetching expenses:', error);
      setErrors('Failed to load expenses. Please try again.');
      setTimeout(() => setErrors(null), 3000);
    } finally {
      setLoading(false);
    }
  }

  async function onFilesSelected(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setReceipts((prev) => [...prev, ...files]);
    fileInputRef.current.value = "";

    // Auto OCR on first file
    if (files.length > 0 && receipts.length === 0) {
      setOcrProcessing(true);
      try {
        const ocrData = await api.extractReceiptData(files[0]);
        
        // Map OCR response to form fields
        if (ocrData.success) {
          setAmount(ocrData.data.amount?.toString() || "");
          setOriginalAmount(ocrData.data.amount?.toString() || "");
          setDate(ocrData.data.date || formatDateISO(new Date()));
          setCategory(ocrData.data.category || categories[0]);
          setDescription(ocrData.data.description || "");
          setMerchantName(ocrData.data.merchantName || ocrData.data.vendor || "");
          
          setErrors("✓ Receipt scanned successfully! Please verify the extracted data.");
          setTimeout(() => setErrors(null), 4000);
        } else {
          setErrors("⚠️ OCR processing completed but some fields may need manual entry.");
          setTimeout(() => setErrors(null), 4000);
        }
      } catch (err) {
        console.error('OCR Error:', err);
        setErrors("⚠️ OCR processing failed. Please fill in the fields manually.");
        setTimeout(() => setErrors(null), 4000);
      } finally {
        setOcrProcessing(false);
      }
    }
  }

  function removeReceipt(index) {
    setReceipts((prev) => prev.filter((_, i) => i !== index));
    setReceiptUrls((prev) => prev.filter((_, i) => i !== index));
  }

  function validate() {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return "Enter a valid amount greater than 0";
    if (!date) return "Select a date";
    if (!category) return "Select a category";
    if (receipts.length === 0 && receiptUrls.length === 0) return "Attach at least one receipt";
    if (!description.trim()) return "Enter a description";
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrors(null);
    
    const v = validate();
    if (v) {
      setErrors(v);
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      // Upload receipts first if any
      const uploadedReceiptUrls = [];
      for (let i = 0; i < receipts.length; i++) {
        setProgress(Math.floor(((i + 1) / (receipts.length + 1)) * 70));
        
        try {
          const uploadResult = await api.uploadReceipt(receipts[i]);
          uploadedReceiptUrls.push(uploadResult.url || uploadResult.path);
        } catch (uploadError) {
          console.error('Receipt upload error:', uploadError);
          // Continue even if one upload fails
        }
      }

      setProgress(80);

      // Create expense payload
      const expenseData = {
        amount: Number(amount),
        originalAmount: Number(originalAmount || amount),
        currency: currency,
        date: date,
        category: category,
        description: description.trim(),
        merchantName: merchantName.trim() || undefined,
        receipts: uploadedReceiptUrls,
      };

      // Submit expense
      const result = await api.createExpense(expenseData);
      
      setProgress(100);

      // Reset form
      setAmount("");
      setOriginalAmount("");
      setCurrency("USD");
      setDescription("");
      setMerchantName("");
      setReceipts([]);
      setReceiptUrls([]);
      setPreviewUrls([]);
      setDate(formatDateISO(new Date()));
      
      setErrors("✓ Expense submitted successfully! Awaiting manager approval.");
      
      // Refresh expense list
      await fetchExpenses();
      
      setTimeout(() => {
        setErrors(null);
        setProgress(0);
      }, 3000);

    } catch (error) {
      console.error('Submission error:', error);
      setErrors(`Failed to submit expense: ${error.message}`);
    } finally {
      setUploading(false);
    }
  }

  const totalSubmitted = history.reduce((s, item) => s + Number(item.amount || 0), 0);
  const pendingCount = history.filter(h => h.status?.toLowerCase() === "pending").length;
  const approvedCount = history.filter(h => h.status?.toLowerCase() === "approved").length;
  const rejectedCount = history.filter(h => h.status?.toLowerCase() === "rejected").length;

  const filteredHistory = filterStatus === "all" 
    ? history 
    : history.filter(h => h.status?.toLowerCase() === filterStatus);

  if (loading && history.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <div className="text-gray-600 font-medium">Loading expenses...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Expense Manager
            </h1>
            <p className="mt-1 text-gray-600">Submit expenses, track approvals in real-time</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={fetchExpenses}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white shadow-md hover:shadow-lg border border-gray-200 text-gray-700 transition-all"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <div className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold shadow-lg">
              {companyInfo.name} • {companyInfo.currency}
            </div>
            <button className="bg-white px-4 py-2 rounded-xl shadow-md hover:shadow-lg border border-gray-200 text-gray-700 transition-all">
              Logout
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<DollarSign className="w-6 h-6" />}
            title="Total Submitted"
            value={`$${Number(totalSubmitted).toLocaleString()}`}
            subtitle={`${history.length} expenses`}
            gradient="from-indigo-500 to-blue-600"
          />
          <StatCard
            icon={<Clock className="w-5 h-5" />}
            title="Pending"
            value={pendingCount}
            subtitle="Awaiting approval"
            gradient="from-amber-400 to-orange-500"
          />
          <StatCard
            icon={<CheckCircle className="w-5 h-5" />}
            title="Approved"
            value={approvedCount}
            subtitle="Ready for payment"
            gradient="from-green-400 to-emerald-600"
          />
          <StatCard
            icon={<XCircle className="w-5 h-5" />}
            title="Rejected"
            value={rejectedCount}
            subtitle="Needs revision"
            gradient="from-red-400 to-rose-600"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-5 gap-6 mb-8">
          {/* Submission Form */}
          <div className="lg:col-span-3">
            <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl p-6 border border-white/50">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Submit New Expense</h2>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Camera className="w-4 h-4" />
                  <span>OCR Enabled</span>
                </div>
              </div>

              {ocrProcessing && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3">
                  <Loader className="w-5 h-5 animate-spin text-blue-600" />
                  <span className="text-blue-800 font-medium">Processing receipt with OCR...</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Receipt Upload First */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Receipt Upload (OCR Auto-fill) *
                  </label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-indigo-300 rounded-2xl p-8 text-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/50 transition-all"
                  >
                    <Upload className="mx-auto w-10 h-10 text-indigo-600 mb-3" />
                    <div className="text-sm font-medium text-gray-700">Click to upload receipt</div>
                    <div className="text-xs text-gray-500 mt-2">Auto-extracts amount, date, category • Images or PDF</div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,application/pdf"
                      multiple
                      onChange={onFilesSelected}
                      className="hidden"
                    />
                  </div>

                  {previewUrls.length > 0 && (
                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {previewUrls.map((u, i) => (
                        <div key={i} className="relative rounded-xl overflow-hidden border-2 border-gray-200 shadow-sm">
                          <div className="h-32 bg-gray-100 flex items-center justify-center">
                            {receipts[i].type === "application/pdf" ? (
                              <div className="text-center">
                                <FileText className="w-12 h-12 text-red-500 mx-auto mb-2" />
                                <div className="text-xs text-gray-600 font-medium">PDF</div>
                              </div>
                            ) : (
                              <img src={u} alt="preview" className="w-full h-full object-cover" />
                            )}
                          </div>
                          <div className="p-2 bg-white flex items-center justify-between gap-2">
                            <div className="truncate text-xs text-gray-700">{receipts[i].name}</div>
                            <button 
                              type="button"
                              onClick={() => removeReceipt(i)} 
                              className="text-red-600 hover:text-red-800 p-1 hover:bg-red-50 rounded"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Amount and Currency */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Amount *</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                      <input
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        inputMode="decimal"
                        required
                        className="pl-10 w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Currency *</label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      required
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none bg-white transition-all"
                    >
                      <option value="USD">USD - US Dollar</option>
                      <option value="EUR">EUR - Euro</option>
                      <option value="GBP">GBP - British Pound</option>
                      <option value="INR">INR - Indian Rupee</option>
                      <option value="JPY">JPY - Japanese Yen</option>
                      <option value="AUD">AUD - Australian Dollar</option>
                      <option value="CAD">CAD - Canadian Dollar</option>
                    </select>
                  </div>
                </div>

                {/* Date and Category */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Date *</label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Category *</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      required
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none bg-white transition-all"
                    >
                      {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                {/* Merchant Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Merchant/Vendor Name</label>
                  <input
                    value={merchantName}
                    onChange={(e) => setMerchantName(e.target.value)}
                    placeholder="e.g., Starbucks, Uber, Hotel Grand"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none transition-all"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Description *</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="Brief description of the expense"
                    required
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none resize-none transition-all"
                  />
                </div>

                {errors && (
                  <div className={`p-4 rounded-xl flex items-start gap-3 ${errors.includes('✓') ? 'bg-green-50 border-2 border-green-200 text-green-800' : 'bg-red-50 border-2 border-red-200 text-red-800'}`}>
                    {errors.includes('✓') ? <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
                    <span className="font-medium">{errors}</span>
                  </div>
                )}

                {/* Submit Button */}
                <div className="flex items-center gap-4">
                  <button
                    type="submit"
                    disabled={uploading || ocrProcessing}
                    className="flex-1 px-6 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {uploading ? (
                      <>
                        <Loader className="w-5 h-5 animate-spin" />
                        Submitting {progress}%
                      </>
                    ) : (
                      <>
                        <ArrowUpCircle className="w-5 h-5" />
                        Submit Expense
                      </>
                    )}
                  </button>
                </div>

                {uploading && (
                  <div className="w-full bg-gray-200 rounded-full overflow-hidden h-2">
                    <div 
                      style={{ width: `${progress}%` }} 
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-300"
                    />
                  </div>
                )}
              </form>
            </div>
          </div>

          {/* Quick Stats Sidebar */}
          <div className="lg:col-span-2">
            <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl p-6 border border-white/50 sticky top-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Submission Tips</h3>
              <div className="space-y-4">
                <TipCard
                  icon={<Camera className="w-5 h-5 text-blue-600" />}
                  title="OCR Magic"
                  description="Upload receipt first - we'll auto-fill amount, date & category"
                />
                <TipCard
                  icon={<FileCheck className="w-5 h-5 text-green-600" />}
                  title="Clear Photos"
                  description="Ensure receipt text is readable for accurate extraction"
                />
                <TipCard
                  icon={<Clock className="w-5 h-5 text-amber-600" />}
                  title="Fast Approval"
                  description="Expenses under policy limits get approved faster"
                />
                <TipCard
                  icon={<MessageSquare className="w-5 h-5 text-purple-600" />}
                  title="Add Details"
                  description="Good descriptions help approvers make quick decisions"
                />
              </div>

              <div className="mt-6 p-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border-2 border-indigo-100">
                <div className="text-sm font-semibold text-gray-700 mb-2">Approval Flow</div>
                <div className="space-y-2 text-xs text-gray-600">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                    <span>Step 1: Manager Review</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                    <span>Step 2: Auto-conversion to {companyInfo.currency}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span>Step 3: Payment Processing</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Expense History */}
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl p-6 border border-white/50">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
            <h3 className="text-2xl font-bold text-gray-800">Expense History</h3>
            
            {/* Filter Tabs */}
            <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
              {["all", "pending", "approved", "rejected"].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    filterStatus === status
                      ? "bg-white text-indigo-600 shadow-md"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <ExpenseHistoryTable 
            entries={filteredHistory} 
            onViewDetails={setSelectedExpense}
            loading={loading}
          />
        </div>
      </div>

      {/* Expense Details Modal */}
      {selectedExpense && (
        <ExpenseDetailsModal
          expense={selectedExpense}
          onClose={() => setSelectedExpense(null)}
        />
      )}
    </div>
  );
}

function StatCard({ icon, title, value, subtitle, gradient }) {
  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-5 shadow-lg border border-white/50 hover:shadow-xl transition-all">
      <div className="flex items-center gap-4">
        <div className={`rounded-xl p-3 bg-gradient-to-br ${gradient} text-white shadow-md`}>
          {icon}
        </div>
        <div className="flex-1">
          <div className="text-xs font-semibold text-gray-500 uppercase">{title}</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{value}</div>
          <div className="text-xs text-gray-500 mt-0.5">{subtitle}</div>
        </div>
      </div>
    </div>
  );
}

function TipCard({ icon, title, description }) {
  return (
    <div className="flex gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-colors">
      <div className="flex-shrink-0 mt-0.5">{icon}</div>
      <div>
        <div className="text-sm font-semibold text-gray-800">{title}</div>
        <div className="text-xs text-gray-600 mt-1">{description}</div>
      </div>
    </div>
  );
}

function ExpenseHistoryTable({ entries = [], onViewDetails, loading }) {
  if (loading && entries.length === 0) {
    return (
      <div className="py-16 text-center">
        <Loader className="mx-auto w-12 h-12 text-indigo-500 mb-4 animate-spin" />
        <div className="text-gray-500 font-medium">Loading expenses...</div>
      </div>
    );
  }

  if (!entries.length) {
    return (
      <div className="py-16 text-center">
        <FileText className="mx-auto w-16 h-16 text-gray-300 mb-4" />
        <div className="text-gray-500 font-medium">No expenses found</div>
        <div className="text-sm text-gray-400 mt-2">Submit your first expense to get started</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((e) => (
        <div 
          key={e._id || e.id} 
          className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl border-2 border-gray-100 bg-gradient-to-r from-white to-gray-50 hover:shadow-lg hover:border-indigo-200 transition-all cursor-pointer"
          onClick={() => onViewDetails(e)}
        >
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center border-2 border-gray-200 flex-shrink-0">
              {e.receipts && e.receipts.length > 0 ? (
                <img 
                  src={e.receipts[0]} 
                  alt="receipt" 
                  className="w-full h-full object-cover" 
                  onError={(ev) => {
                    ev.target.src = "https://via.placeholder.com/300?text=Receipt";
                  }}
                />
              ) : (
                <FileText className="w-8 h-8 text-gray-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-gray-500">{e._id || e.id}</span>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs text-gray-500">
                  {new Date(e.date || e.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="text-lg font-bold text-gray-900">
                {e.merchantName || e.merchant || "Unknown Merchant"}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-gray-600">{e.category}</span>
                {e.currency && e.currency !== "USD" && (
                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-semibold">
                    {e.currency}
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-1 line-clamp-1">
                {e.description || "No description"}
              </div>
            </div>
          </div>

          <div className="flex md:flex-col items-center md:items-end gap-3 md:gap-2">
            <div className="text-2xl font-bold text-gray-900">
              ${Number(e.amount || 0).toLocaleString()}
            </div>
            <StatusBadge status={e.status} />
            <button 
              onClick={(ev) => {
                ev.stopPropagation();
                onViewDetails(e);
              }}
              className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              <Eye className="w-4 h-4" />
              <span>Details</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }) {
  const s = (status || "draft").toLowerCase();
  const base = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold";
  
  if (s === "approved") {
    return (
      <span className={`${base} bg-green-100 text-green-700 ring-2 ring-green-200`}>
        <CheckCircle className="w-3.5 h-3.5" />
        Approved
      </span>
    );
  }
  if (s === "rejected") {
    return (
      <span className={`${base} bg-red-100 text-red-700 ring-2 ring-red-200`}>
        <XCircle className="w-3.5 h-3.5" />
        Rejected
      </span>
    );
  }
  if (s === "pending") {
    return (
      <span className={`${base} bg-amber-100 text-amber-700 ring-2 ring-amber-200`}>
        <Clock className="w-3.5 h-3.5" />
        Pending
      </span>
    );
  }
  return <span className={`${base} bg-gray-100 text-gray-700 ring-2 ring-gray-200`}>{status}</span>;
}

function ExpenseDetailsModal({ expense, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Expense Details</h2>
            <p className="text-indigo-100 text-sm mt-1">{expense._id || expense.id}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-xl transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
          {/* Status Banner */}
          <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-gray-50 to-gray-100 border-2 border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600 mb-1">Current Status</div>
                <StatusBadge status={expense.status} />
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600 mb-1">Amount</div>
                <div className="text-3xl font-bold text-gray-900">
                  ${Number(expense.amount || 0).toLocaleString()}
                </div>
                {expense.currency && expense.currency !== "USD" && (
                  <div className="text-xs text-gray-500 mt-1">
                    Original: {expense.originalAmount || expense.amount} {expense.currency}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Expense Info Grid */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <InfoField 
              label="Merchant/Vendor" 
              value={expense.merchantName || expense.merchant || "Not specified"} 
            />
            <InfoField label="Category" value={expense.category || "Uncategorized"} />
            <InfoField 
              label="Date" 
              value={new Date(expense.date || expense.createdAt).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })} 
            />
            <InfoField label="Currency" value={expense.currency || "USD"} />
            <InfoField 
              label="Submitted On" 
              value={new Date(expense.createdAt || expense.date).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })} 
            />
            <InfoField 
              label="Submitted By" 
              value={expense.employeeName || expense.submittedBy || "You"} 
            />
          </div>

          {/* Description */}
          <div className="mb-6">
            <label className="text-sm font-semibold text-gray-700 mb-2 block">Description</label>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-gray-700">
              {expense.description || "No description provided"}
            </div>
          </div>

          {/* Receipt Images */}
          {expense.receipts && expense.receipts.length > 0 && (
            <div className="mb-6">
              <label className="text-sm font-semibold text-gray-700 mb-3 block">Receipt(s)</label>
              <div className="grid grid-cols-2 gap-4">
                {expense.receipts.map((receipt, idx) => (
                  <div key={idx} className="rounded-xl overflow-hidden border-2 border-gray-200 shadow-md">
                    <img 
                      src={receipt} 
                      alt={`Receipt ${idx + 1}`} 
                      className="w-full h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => window.open(receipt, '_blank')}
                      onError={(ev) => {
                        ev.target.src = "https://via.placeholder.com/300?text=Receipt";
                      }}
                    />
                    <div className="p-2 bg-white">
                      <a 
                        href={receipt} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        View Full Size
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Approval Timeline */}
          {expense.approvalSteps && expense.approvalSteps.length > 0 && (
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-3 block">Approval Timeline</label>
              <div className="space-y-3">
                {expense.approvalSteps.map((step, idx) => (
                  <div key={idx} className="flex gap-4 p-4 rounded-xl bg-gray-50 border border-gray-200">
                    <div className="flex-shrink-0">
                      {step.status === "Approved" && (
                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        </div>
                      )}
                      {step.status === "Rejected" && (
                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                          <XCircle className="w-5 h-5 text-red-600" />
                        </div>
                      )}
                      {step.status === "Pending" && (
                        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                          <Clock className="w-5 h-5 text-amber-600" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">
                        {step.approverName || step.approver || "Approver"}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {step.status === "Pending" 
                          ? "Awaiting review" 
                          : `${step.status} ${step.date ? `on ${new Date(step.date).toLocaleDateString()}` : ''}`
                        }
                      </div>
                      {step.comments && (
                        <div className="mt-2 p-3 bg-white rounded-lg border border-gray-200 text-sm text-gray-700">
                          <div className="flex items-start gap-2">
                            <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            <span>{step.comments}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* If no approval steps, show default message */}
          {(!expense.approvalSteps || expense.approvalSteps.length === 0) && (
            <div className="mt-6">
              <label className="text-sm font-semibold text-gray-700 mb-3 block">Approval Status</label>
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-3">
                <Clock className="w-5 h-5 text-amber-600" />
                <span className="text-sm text-amber-800 font-medium">
                  Awaiting manager approval
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:shadow-lg transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoField({ label, value }) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">{label}</label>
      <div className="text-base font-medium text-gray-900">{value}</div>
    </div>
  );
}