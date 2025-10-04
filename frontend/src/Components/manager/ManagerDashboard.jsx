import React, { useEffect, useState, useMemo } from "react";

/**
 * ManagerDashboard.jsx
 * A simplified manager portal dashboard.
 * Uses environment-based API host via import.meta.env.VITE_API_URL
 */

function shortDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString();
}

function ExpenseCard({ exp, onReview, onQuickApprove, onQuickReject }) {
  return (
    <article className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-6 border border-gray-100">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                  {exp.submittedBy?.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {exp.submittedBy?.name || "Unknown"}
                  </div>
                  <div className="text-xs text-gray-500">
                    {exp.submittedBy?.email}
                  </div>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {exp.category}
              </h3>
              <p className="text-sm text-gray-600 mb-2">
                {exp.description || "No description provided"}
              </p>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                  <span>Date: {shortDate(exp.expenseDate)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                  <span>Flow: {exp.approvalFlowName || "Standard"}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                  <span>Step: {(exp.currentStepIndex ?? 0) + 1}</span>
                </div>
              </div>
            </div>
            <div className="text-right ml-4">
              <div className="text-2xl font-bold text-gray-900 mb-1">
                {exp.currencyOriginal}{" "}
                {Number(exp.amountOriginal).toLocaleString()}
              </div>
              <div className="text-sm text-gray-500 mb-3">
                Base: {exp.baseCurrency}{" "}
                {Number(exp.amountBase).toLocaleString()}
              </div>
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                  exp.status === "approved"
                    ? "bg-emerald-100 text-emerald-700"
                    : exp.status === "rejected"
                    ? "bg-rose-100 text-rose-700"
                    : exp.status === "pending"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {exp.status === "approved"
                  ? "Approved"
                  : exp.status === "rejected"
                  ? "Rejected"
                  : exp.status === "pending"
                  ? "Pending Review"
                  : exp.status?.charAt(0).toUpperCase() +
                      exp.status?.slice(1) || "Unknown"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
            <button
              onClick={() => onReview(exp)}
              className="px-4 py-2 rounded-lg border-2 border-gray-200 text-sm font-medium text-gray-700 hover:border-indigo-300 hover:bg-indigo-50 transition-all"
            >
              Review Details
            </button>
            <button
              onClick={() => onQuickApprove(exp._id)}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 text-white text-sm font-medium hover:from-emerald-600 hover:to-green-700 shadow-md hover:shadow-lg transition-all"
            >
              Approve
            </button>
            <button
              onClick={() => onQuickReject(exp._id)}
              className="px-4 py-2 rounded-lg border-2 border-rose-200 text-sm font-medium text-rose-600 hover:bg-rose-50 hover:border-rose-300 transition-all"
            >
              Reject
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function ManagerDashboard() {
  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const token = localStorage.getItem("authToken") || "";
  const [tab, setTab] = useState("pending");
  const [pending, setPending] = useState([]);
  const [teamExpenses, setTeamExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [teamLoading, setTeamLoading] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadPending();
    loadTeamExpenses();
  }, []);

  /* ---- API Helper ---- */
  async function apiGet(url) {
    const fullUrl = `${API_BASE}${url}`;
    const res = await fetch(fullUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.message || res.statusText);
    return data;
  }

  async function apiPost(url, body) {
    const fullUrl = `${API_BASE}${url}`;
    const res = await fetch(fullUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.message || res.statusText);
    return data;
  }

  /* ---- Fetch Data ---- */
  async function loadPending() {
    setLoading(true);
    try {
      const data = await apiGet(`/api/approvals/pending`);
      setPending(data.pending || []);
    } catch (err) {
      console.error("loadPending", err);
      setToast({ type: "error", message: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function loadTeamExpenses() {
    setTeamLoading(true);
    try {
      const data = await apiGet(`/api/expenses?team=true`);
      setTeamExpenses(data.expenses || []);
    } catch (err) {
      console.error("loadTeamExpenses", err);
      setToast({ type: "error", message: err.message });
    } finally {
      setTeamLoading(false);
    }
  }

  /* ---- Approve / Reject ---- */
  async function handleApprove(id) {
    try {
      await apiPost(`/api/expenses/${id}/approve`, {
        comments: comment || "Approved by manager",
      });
      setToast({ type: "success", message: "Expense approved successfully!" });
      loadPending();
      loadTeamExpenses();
      closeModal();
      setComment("");
    } catch (err) {
      setToast({ type: "error", message: err.message });
    }
  }

  async function handleReject(id) {
    try {
      await apiPost(`/api/expenses/${id}/reject`, {
        comments: comment || "Rejected by manager",
      });
      setToast({ type: "success", message: "Expense rejected" });
      loadPending();
      loadTeamExpenses();
      closeModal();
      setComment("");
    } catch (err) {
      setToast({ type: "error", message: err.message });
    }
  }

  function openModal(exp) {
    setSelectedExpense(exp);
    setModalOpen(true);
    setComment("");
  }

  function closeModal() {
    setSelectedExpense(null);
    setModalOpen(false);
    setComment("");
  }

  //...
  const totalPending = teamExpenses.filter(
    (exp) => exp.status === "pending"
  ).length;
  const totalTeam = teamExpenses.length;
  const totalAmountPending = useMemo(
    () =>
      teamExpenses
        .filter((exp) => exp.status === "pending")
        .reduce((sum, e) => sum + (Number(e.amountBase) || 0), 0),
    [teamExpenses] // Also update the dependency array here
  );
  //...

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 p-8">
      <main className="max-w-7xl mx-auto grid gap-6 grid-cols-1 lg:grid-cols-4">
        {/* Main Content */}
        <section className="lg:col-span-3 space-y-6">
          <div className="flex items-center gap-3 bg-white rounded-xl p-2 shadow-sm">
            <button
              onClick={() => setTab("pending")}
              className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all ${
                tab === "pending"
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              Pending Approvals
            </button>
            <button
              onClick={() => setTab("team")}
              className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all ${
                tab === "team"
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              Team Expenses
            </button>
          </div>

          {/* Pending list */}
          {tab === "pending" && (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800">
                  Pending Approvals
                  <span className="ml-3 text-lg font-normal text-gray-500">
                    ({totalPending})
                  </span>
                </h2>
              </div>
              {loading ? (
                <div className="p-12 bg-white rounded-xl shadow text-center">
                  <div className="inline-block w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                  <p className="mt-4 text-gray-600">
                    Loading pending approvals...
                  </p>
                </div>
              ) : pending.length === 0 ? (
                <div className="p-12 bg-white rounded-xl shadow text-center">
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">
                    All Caught Up!
                  </h3>
                  <p className="text-gray-600">
                    No pending approvals at the moment.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pending
                    .filter((exp) => exp.status === "pending")
                    .map((exp) => (
                      <ExpenseCard
                        key={exp._id}
                        exp={exp}
                        onReview={(e) => openModal(e)}
                        onQuickApprove={handleApprove}
                        onQuickReject={handleReject}
                      />
                    ))}
                  {pending.filter((exp) => exp.status === "pending").length ===
                    0 && (
                    <div className="p-12 bg-white rounded-xl shadow text-center">
                      <h3 className="text-xl font-semibold text-gray-800 mb-2">
                        All Caught Up!
                      </h3>
                      <p className="text-gray-600">
                        No pending approvals at the moment.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Team Expenses */}
          {tab === "team" && (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800">
                  Team Expenses
                  <span className="ml-3 text-lg font-normal text-gray-500">
                    ({totalTeam})
                  </span>
                </h2>
              </div>
              {teamLoading ? (
                <div className="p-12 bg-white rounded-xl shadow text-center">
                  <div className="inline-block w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                  <p className="mt-4 text-gray-600">Loading team expenses...</p>
                </div>
              ) : teamExpenses.length === 0 ? (
                <div className="p-12 bg-white rounded-xl shadow text-center">
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">
                    No Team Expenses
                  </h3>
                  <p className="text-gray-600">
                    Your team hasn't submitted any expenses yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {teamExpenses.map((e) => (
                    <div
                      key={e._id}
                      className="bg-white p-5 rounded-xl shadow-md hover:shadow-lg transition-all border border-gray-100"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white font-semibold">
                            {e.submittedBy?.name?.charAt(0)?.toUpperCase() ||
                              "?"}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900 mb-1">
                              {e.submittedBy?.name || "Unknown"} •{" "}
                              {shortDate(e.expenseDate)}
                            </div>
                            <div className="font-semibold text-gray-800 mb-1">
                              {e.category} — {e.description || "No description"}
                            </div>
                            <span
                              className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                                e.status === "approved"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : e.status === "rejected"
                                  ? "bg-rose-100 text-rose-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {e.status?.charAt(0).toUpperCase() +
                                e.status?.slice(1)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <div className="text-xl font-bold text-gray-900">
                            {e.baseCurrency}{" "}
                            {Number(e.amountBase).toLocaleString()}
                          </div>
                          <div className="text-sm text-gray-500">
                            {e.currencyOriginal}{" "}
                            {Number(e.amountOriginal).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        {/* Sidebar */}
        <aside className="space-y-4">
          <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100">
            <h4 className="font-bold text-lg text-gray-800 mb-4">Summary</h4>
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200">
                <div className="text-sm text-amber-700 mb-1">
                  Pending Approvals
                </div>
                <div className="text-3xl font-bold text-amber-900">
                  {totalPending}
                </div>
              </div>
              <div className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200">
                <div className="text-sm text-blue-700 mb-1">Team Expenses</div>
                <div className="text-3xl font-bold text-blue-900">
                  {totalTeam}
                </div>
              </div>
              <div className="p-4 rounded-lg bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200">
                <div className="text-sm text-purple-700 mb-1">
                  Pending Value
                </div>
                <div className="text-2xl font-bold text-purple-900">
                  {totalAmountPending.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </aside>
      </main>

      {/* Modal */}
      {modalOpen && selectedExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-8 shadow-2xl">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              Review Expense
            </h3>
            <div className="h-1 w-20 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full mb-6"></div>

            <div className="mb-6 p-5 bg-gray-50 rounded-xl">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Submitted By</div>
                  <div className="font-semibold text-gray-900">
                    {selectedExpense.submittedBy?.name}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Amount</div>
                  <div className="font-semibold text-gray-900">
                    {selectedExpense.currencyOriginal}{" "}
                    {Number(selectedExpense.amountOriginal).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Category</div>
                  <div className="font-semibold text-gray-900">
                    {selectedExpense.category}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Date</div>
                  <div className="font-semibold text-gray-900">
                    {shortDate(selectedExpense.expenseDate)}
                  </div>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Description</div>
                <p className="text-gray-800">
                  {selectedExpense.description || "No description provided"}
                </p>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Add Your Comments
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl p-4 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                placeholder="Enter your review comments here..."
                rows="4"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleApprove(selectedExpense._id)}
                className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl font-semibold hover:from-emerald-600 hover:to-green-700 shadow-lg hover:shadow-xl transition-all"
              >
                Approve
              </button>
              <button
                onClick={() => handleReject(selectedExpense._id)}
                className="flex-1 py-3 bg-gradient-to-r from-rose-500 to-red-600 text-white rounded-xl font-semibold hover:from-rose-600 hover:to-red-700 shadow-lg hover:shadow-xl transition-all"
              >
                Reject
              </button>
              <button
                onClick={closeModal}
                className="px-6 py-3 border-2 border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-8 right-8 p-5 rounded-xl shadow-2xl backdrop-blur-sm ${
            toast.type === "success"
              ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white"
              : "bg-gradient-to-r from-rose-500 to-red-600 text-white"
          }`}
        >
          <div className="flex items-center gap-3">
            <div>
              <div className="font-semibold">{toast.message}</div>
              <button
                className="text-sm underline opacity-90 hover:opacity-100 mt-1"
                onClick={() => setToast(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
