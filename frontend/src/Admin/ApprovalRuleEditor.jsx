import React, { useEffect, useState } from "react";
import {
    Save, RotateCcw, Search, X, Plus, Trash2, ChevronUp, ChevronDown,
    Shield, Users, AlertCircle, CheckCircle, Info, Settings, Eye, ArrowLeft
} from 'lucide-react';
import { useNavigate } from "react-router-dom"; // Add this import

/**
 * ApprovalRuleEditor.jsx
 *
 * Usage:
 *  - For editing an existing rule: <ApprovalRuleEditor ruleId="..."/>
 *  - For creating a new rule: <ApprovalRuleEditor />
 *
 * Environment:
 *  - VITE_API_URL must be set (import.meta.env.VITE_API_URL)
 *  - Admin token must be available as localStorage.getItem('authToken')
 */

function blankRule() {
    return {
        name: "",
        description: "",
        manager: null,
        isManagerApprover: false,
        approvers: [],
        sequence: false,
        type: "percentage",
        percentageThreshold: 60,
        specificApprover: null,
        enabled: true
    };
}

export default function ApprovalRuleEditor({ ruleId }) {
    const API = import.meta.env.VITE_API_URL || "";
    const token = localStorage.getItem("authToken") || "";

    const [rule, setRule] = useState(blankRule());
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [searchQ, setSearchQ] = useState("");
    const [userSearchResults, setUserSearchResults] = useState([]);
    const [userCache, setUserCache] = useState({});
    const [toast, setToast] = useState(null);
    const [managerSearchQ, setManagerSearchQ] = useState("");
    const [managerSearchResults, setManagerSearchResults] = useState([]);
    const [approverSearchQ, setApproverSearchQ] = useState("");
    const [approverSearchResults, setApproverSearchResults] = useState([]);
    const navigate = useNavigate(); // Add this line

    useEffect(() => {
        if (ruleId) loadRule(ruleId);
    }, [ruleId]);

    function apiHeaders() {
        return {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        };
    }

    async function apiGet(path) {
        const res = await fetch(`${API}${path}`, { headers: apiHeaders() });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || res.statusText);
        return data;
    }

    async function apiPost(path, body) {
        const res = await fetch(`${API}${path}`, {
            method: "POST",
            headers: apiHeaders(),
            body: JSON.stringify(body)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || res.statusText);
        return data;
    }

    async function apiPatch(path, body) {
        const res = await fetch(`${API}${path}`, {
            method: "PATCH",
            headers: apiHeaders(),
            body: JSON.stringify(body)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || res.statusText);
        return data;
    }

    async function loadRule(id) {
        setLoading(true);
        try {
            const data = await apiGet(`/api/admin/approval-rules/${id}`);
            const r = data.rule || data;
            r.approvers = (r.approvers || []).map(a =>
                typeof a === "string" ? { user: a, required: false } : a
            );
            setRule({ ...blankRule(), ...r });
            const ids = Array.from(new Set(r.approvers.map(a => a.user).filter(Boolean).concat(r.specificApprover ? [r.specificApprover] : []).concat(r.manager ? [r.manager] : [])));
            await Promise.all(ids.map(id => fetchUser(id)));
        } catch (err) {
            console.error("loadRule error", err);
            showToast("error", err.message);
        } finally {
            setLoading(false);
        }
    }

    async function fetchUser(id) {
        if (!id || userCache[id]) return userCache[id];
        try {
            const data = await apiGet(`/api/admin/users/${id}`);
            const user = data.user || data;
            setUserCache(prev => ({ ...prev, [id]: user }));
            return user;
        } catch (err) {
            try {
                const data = await apiGet(`/api/admin/users?search=${id}`);
                const u = (data.users || [])[0];
                if (u) setUserCache(prev => ({ ...prev, [u._id]: u }));
                return u;
            } catch (e) {
                return null;
            }
        }
    }

    let userSearchTimeout = null;
    function onSearchQChange(v) {
        setSearchQ(v);
        if (userSearchTimeout) clearTimeout(userSearchTimeout);
        userSearchTimeout = setTimeout(() => runUserSearch(v), 350);
    }

    async function runUserSearch(q) {
        if (!q || q.length < 1) {
            setUserSearchResults([]);
            return;
        }
        try {
            const data = await apiGet(`/api/admin/users?search=${encodeURIComponent(q)}&limit=20`);
            const users = data.users || [];
            setUserSearchResults(users);
            setUserCache(prev => {
                const n = { ...prev };
                users.forEach(u => { n[u._id] = u; });
                return n;
            });
        } catch (err) {
            console.error("user search error", err);
            showToast("error", err.message);
        }
    }

    function addApprover(userId) {
        if (!userId) return;
        if (rule.approvers.some(a => String(a.user) === String(userId))) {
            showToast("error", "Approver already added");
            return;
        }
        const newApprovers = [...rule.approvers, { user: userId, required: false }];
        setRule({ ...rule, approvers: newApprovers });
        fetchUser(userId).catch(() => { });
    }

    function removeApprover(index) {
        const newApprovers = rule.approvers.slice();
        newApprovers.splice(index, 1);
        setRule({ ...rule, approvers: newApprovers });
    }

    function moveApprover(index, dir) {
        const arr = rule.approvers.slice();
        const to = index + dir;
        if (to < 0 || to >= arr.length) return;
        const tmp = arr[to];
        arr[to] = arr[index];
        arr[index] = tmp;
        setRule({ ...rule, approvers: arr });
    }

    function toggleRequired(index) {
        const arr = rule.approvers.slice();
        arr[index] = { ...arr[index], required: !arr[index].required };
        setRule({ ...rule, approvers: arr });
    }

    async function setManagerById(id) {
        if (!id) {
            setRule({ ...rule, manager: null });
            return;
        }
        const u = await fetchUser(id);
        if (!u) return showToast("error", "Manager not found");
        setRule({ ...rule, manager: id });
    }

    function setSpecificApproverId(id) {
        setRule({ ...rule, specificApprover: id });
        if (id) fetchUser(id).catch(() => { });
    }

    function validateRule() {
        if (!rule.name || rule.name.trim().length < 3) return "Please provide a rule name (3+ chars)";
        if (!Array.isArray(rule.approvers) || rule.approvers.length === 0) return "Add at least one approver";
        if (rule.type === "percentage" || rule.type === "hybrid") {
            if (typeof rule.percentageThreshold !== "number" || rule.percentageThreshold <= 0 || rule.percentageThreshold > 100)
                return "Percentage must be between 1 and 100";
        }
        if (rule.type === "specific" || rule.type === "hybrid") {
            if (!rule.specificApprover) return "Select specific approver for specific/hybrid rule";
            if (!rule.approvers.some(a => String(a.user) === String(rule.specificApprover)))
                return "Specific approver must be one of approvers (add them first)";
        }
        return null;
    }

    async function handleSave() {
        const err = validateRule();
        if (err) return showToast("error", err);

        setSaving(true);
        try {
            const payload = {
                name: rule.name,
                description: rule.description,
                manager: rule.manager,
                isManagerApprover: !!rule.isManagerApprover,
                approvers: rule.approvers.map(a => ({ user: a.user, required: !!a.required })),
                sequence: !!rule.sequence,
                type: rule.type,
                percentageThreshold: rule.type === "percentage" || rule.type === "hybrid" ? rule.percentageThreshold : undefined,
                specificApprover: rule.type === "specific" || rule.type === "hybrid" ? rule.specificApprover : undefined,
                enabled: !!rule.enabled
            };
            let data;
            if (ruleId) {
                data = await apiPatch(`/api/admin/approval-rules/${ruleId}`, payload);
                showToast("success", "Rule updated successfully");
                if (data.rule) setRule(r => ({ ...r, ...data.rule }));
            } else {
                data = await apiPost(`/api/admin/approval-rules`, payload);
                showToast("success", "Rule created successfully");
                if (data.rule) setRule({ ...rule, ...data.rule });
            }
        } catch (err) {
            console.error("save error", err);
            showToast("error", err.message);
        } finally {
            setSaving(false);
        }
    }

    function showToast(type, message) {
        setToast({ type, message });
        setTimeout(() => setToast(null), 5000);
    }

    function getUserName(id) {
        if (!id) return "—";
        const u = userCache[id];
        return u ? u.name || u.email || id : id;
    }

    function getUserEmail(id) {
        if (!id) return "";
        const u = userCache[id];
        return u?.email || "";
    }

    function previewEvaluate() {
        const sampleDecisions = {};
        rule.approvers.slice(0, Math.min(2, rule.approvers.length)).forEach(a => sampleDecisions[a.user] = "approved");
        if (rule.isManagerApprover && rule.manager) sampleDecisions[rule.manager] = "approved";

        const approverList = [];
        if (rule.isManagerApprover) {
            const man = rule.manager || "SUBMITTER_MANAGER";
            if (!rule.approvers.some(a => String(a.user) === String(man))) {
                approverList.push({ user: man, required: true });
            }
        }
        rule.approvers.forEach(a => approverList.push({ user: a.user, required: !!a.required }));

        if (rule.sequence) {
            for (let i = 0; i < approverList.length; i++) {
                const u = approverList[i].user;
                const decision = sampleDecisions[u];
                if (!decision) return { result: "pending", reason: `Waiting for ${getUserName(u)} decision (step ${i + 1})` };
                if (decision === "rejected" && approverList[i].required)
                    return { result: "rejected", reason: `${getUserName(u)} (required) rejected at step ${i + 1}` };
            }
            return { result: "approved", reason: "All sequential steps satisfied" };
        } else {
            if ((rule.type === "specific" || rule.type === "hybrid") && rule.specificApprover) {
                if (sampleDecisions[rule.specificApprover] === "approved") {
                    return { result: "approved", reason: "Specific approver approved" };
                }
            }
            if (rule.type === "percentage" || rule.type === "hybrid") {
                const total = approverList.length;
                const approvedCount = approverList.reduce((s, a) => s + (sampleDecisions[a.user] === "approved" ? 1 : 0), 0);
                const pct = total === 0 ? 0 : Math.round((approvedCount / total) * 100);
                if (pct >= (rule.percentageThreshold || 0))
                    return { result: "approved", reason: `Approved by ${pct}% (threshold ${rule.percentageThreshold}%)` };
                return { result: "pending", reason: `${approvedCount}/${total} approved (${pct}%)` };
            }
            return { result: "pending", reason: "Waiting for approver decisions" };
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
                <svg className="animate-spin h-12 w-12 text-blue-600" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
            </div>
        );
    }

    let managerSearchTimeout = null;
    function onManagerSearchQChange(v) {
        setManagerSearchQ(v);
        if (managerSearchTimeout) clearTimeout(managerSearchTimeout);
        managerSearchTimeout = setTimeout(() => runManagerSearch(v), 350);
    }
    async function runManagerSearch(q) {
        if (!q || q.length < 1) {
            setManagerSearchResults([]);
            return;
        }
        try {
            const data = await apiGet(`/api/admin/users?search=${encodeURIComponent(q)}&limit=20`);
            const users = data.users || [];
            setManagerSearchResults(users);
            setUserCache(prev => {
                const n = { ...prev };
                users.forEach(u => { n[u._id] = u; });
                return n;
            });
        } catch (err) {
            setManagerSearchResults([]);
        }
    }

    // --- Approver search ---
    let approverSearchTimeout = null;
    function onApproverSearchQChange(v) {
        setApproverSearchQ(v);
        if (approverSearchTimeout) clearTimeout(approverSearchTimeout);
        approverSearchTimeout = setTimeout(() => runApproverSearch(v), 350);
    }
    async function runApproverSearch(q) {
        if (!q || q.length < 1) {
            setApproverSearchResults([]);
            return;
        }
        try {
            const data = await apiGet(`/api/admin/users?search=${encodeURIComponent(q)}&limit=20`);
            const users = data.users || [];
            setApproverSearchResults(users);
            setUserCache(prev => {
                const n = { ...prev };
                users.forEach(u => { n[u._id] = u; });
                return n;
            });
        } catch (err) {
            setApproverSearchResults([]);
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <button
                                    onClick={() => navigate("/admin/dashboard")}
                                    className="p-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition mr-2"
                                    title="Back to Dashboard"
                                >
                                    <ArrowLeft className="w-5 h-5 text-gray-700" />
                                </button>
                                <div className="p-2 bg-blue-600 rounded-lg">
                                    <Settings className="w-6 h-6 text-white" />
                                </div>
                                <h1 className="text-3xl font-bold text-gray-900">
                                    {ruleId ? "Edit Approval Rule" : "Create Approval Rule"}
                                </h1>
                            </div>
                            <p className="text-gray-600">Define approvers, sequence and conditional rules for expense approval</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => { setRule(blankRule()); setToast(null); }}
                                className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
                            >
                                <RotateCcw className="w-4 h-4" />
                                Reset
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Save className="w-4 h-4" />
                                {saving ? "Saving..." : (ruleId ? "Update Rule" : "Create Rule")}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Toast Notification */}
                {toast && (
                    <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${toast.type === "success"
                        ? "bg-green-50 border border-green-200"
                        : toast.type === "error"
                            ? "bg-red-50 border border-red-200"
                            : "bg-blue-50 border border-blue-200"
                        }`}>
                        {toast.type === "success" ? (
                            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                        ) : toast.type === "error" ? (
                            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                        ) : (
                            <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                        )}
                        <div className="flex-1">
                            <span className={`text-sm ${toast.type === "success" ? "text-green-800" : toast.type === "error" ? "text-red-800" : "text-blue-800"
                                }`}>
                                {toast.message}
                            </span>
                        </div>
                        <button onClick={() => setToast(null)} className="text-gray-400 hover:text-gray-600">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column: Rule Metadata */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Rule Details</h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Rule Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={rule.name}
                                        onChange={e => setRule({ ...rule, name: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="e.g., Travel Expenses > $500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Description
                                    </label>
                                    <textarea
                                        value={rule.description}
                                        onChange={e => setRule({ ...rule, description: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                        rows={4}
                                        placeholder="Describe when this rule applies..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Status
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={rule.enabled}
                                            onChange={e => setRule({ ...rule, enabled: e.target.checked })}
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-700">Rule is active</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Manager Override */}
                        {/* Manager Override */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Manager Override</h3>
                            <div className="space-y-4">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        value={managerSearchQ}
                                        onChange={e => onManagerSearchQChange(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="Search users..."
                                    />
                                </div>
                                {managerSearchResults.length > 0 && (
                                    <div className="max-h-48 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-2">
                                        {managerSearchResults.map(u => (
                                            <div key={u._id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-semibold">
                                                        {u.name?.charAt(0)?.toUpperCase() || "U"}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-900">{u.name}</div>
                                                        <div className="text-xs text-gray-500">{u.email}</div>
                                                    </div>
                                                </div>
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => { setManagerById(u._id); setManagerSearchResults([]); setManagerSearchQ(""); }}
                                                        className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition"
                                                    >
                                                        Set Manager
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {rule.manager ? (
                                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <Shield className="w-4 h-4 text-purple-600" />
                                                <span className="text-sm font-medium text-purple-900">{getUserName(rule.manager)}</span>
                                            </div>
                                            <button
                                                onClick={() => setManagerById(null)}
                                                className="text-purple-600 hover:text-purple-800"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="text-xs text-purple-700 mb-2">{getUserEmail(rule.manager)}</div>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={rule.isManagerApprover}
                                                onChange={e => setRule({ ...rule, isManagerApprover: e.target.checked })}
                                                className="w-4 h-4 text-purple-600 border-gray-300 rounded"
                                            />
                                            <span className="text-xs text-purple-900">Manager must approve first</span>
                                        </label>
                                    </div>
                                ) : (
                                    <div className="text-sm text-gray-500 text-center py-3">
                                        No manager override set
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Approvers & Rules */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Approvers List */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900">Approvers</h3>
                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={rule.sequence}
                                            onChange={e => setRule({ ...rule, sequence: e.target.checked })}
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                                        />
                                        <span className="text-sm text-gray-700">Sequential approval</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={rule.isManagerApprover}
                                            onChange={e => setRule({ ...rule, isManagerApprover: e.target.checked })}
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                                        />
                                        <span className="text-sm text-gray-700">Manager approves</span>
                                    </label>
                                </div>
                            </div>

                            <div className="space-y-3 mb-4">
                                {rule.approvers.map((a, idx) => (
                                    <div key={idx} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
                                            {getUserName(a.user)?.charAt(0)?.toUpperCase() || "U"}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-gray-900 truncate">{getUserName(a.user)}</div>
                                            <div className="text-xs text-gray-500 truncate">{getUserEmail(a.user)}</div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <label className="flex items-center gap-1 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={!!a.required}
                                                    onChange={() => toggleRequired(idx)}
                                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                                                />
                                                <span className="text-xs text-gray-700">Required</span>
                                            </label>
                                            <div className="flex flex-col gap-1">
                                                <button
                                                    onClick={() => moveApprover(idx, -1)}
                                                    disabled={idx === 0}
                                                    className="p-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                                >
                                                    <ChevronUp className="w-3 h-3" />
                                                </button>
                                                <button
                                                    onClick={() => moveApprover(idx, 1)}
                                                    disabled={idx === rule.approvers.length - 1}
                                                    className="p-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                                >
                                                    <ChevronDown className="w-3 h-3" />
                                                </button>
                                            </div>
                                            <button
                                                onClick={() => removeApprover(idx)}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {rule.approvers.length === 0 && (
                                    <div className="text-center py-8 text-gray-500">
                                        <Users className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                                        <p className="text-sm">No approvers added yet</p>
                                        <p className="text-xs">Search and add users below</p>
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 border-t border-gray-200">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Add Approver</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        value={searchQ}
                                        onChange={e => onSearchQChange(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="Search by name or email..."
                                    />
                                </div>
                                {userSearchResults.length > 0 && (
                                    <div className="mt-2 max-h-48 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-2">
                                        {userSearchResults.map(u => (
                                            <div key={u._id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-semibold">
                                                        {u.name?.charAt(0)?.toUpperCase() || "U"}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-900">{u.name}</div>
                                                        <div className="text-xs text-gray-500">{u.email}</div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => { addApprover(u._id); setUserSearchResults([]); setSearchQ(""); }}
                                                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                                                >
                                                    <Plus className="w-3 h-3" />
                                                    Add
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Conditional Rules */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Approval Logic</h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Rule Type</label>
                                    <select
                                        value={rule.type}
                                        onChange={e => setRule({ ...rule, type: e.target.value })}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white cursor-pointer"
                                    >
                                        <option value="percentage">Percentage Rule</option>
                                        <option value="specific">Specific Approver Rule</option>
                                        <option value="hybrid">Hybrid Rule (Percentage OR Specific)</option>
                                    </select>
                                </div>

                                {(rule.type === "percentage" || rule.type === "hybrid") && (
                                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                        <label className="block text-sm font-medium text-blue-900 mb-2">
                                            Minimum Approval Percentage
                                        </label>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="number"
                                                value={rule.percentageThreshold}
                                                min={1}
                                                max={100}
                                                onChange={e => setRule({ ...rule, percentageThreshold: Number(e.target.value) || 0 })}
                                                className="w-24 px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                            <span className="text-sm text-blue-900">% of approvers must approve</span>
                                        </div>
                                        <p className="text-xs text-blue-700 mt-2">
                                            If {rule.percentageThreshold}% or more approvers approve, the expense is auto-approved
                                        </p>
                                    </div>
                                )}

                                {(rule.type === "specific" || rule.type === "hybrid") && (
                                    <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                                        <label className="block text-sm font-medium text-purple-900 mb-2">
                                            Specific Approver (Auto-Approve)
                                        </label>
                                        <select
                                            value={rule.specificApprover || ""}
                                            onChange={e => setSpecificApproverId(e.target.value || null)}
                                            className="w-full px-4 py-2.5 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 appearance-none bg-white cursor-pointer"
                                        >
                                            <option value="">-- Select approver --</option>
                                            {rule.approvers.map(a => (
                                                <option key={a.user} value={a.user}>{getUserName(a.user)}</option>
                                            ))}
                                        </select>
                                        <p className="text-xs text-purple-700 mt-2">
                                            If this approver approves, the expense is immediately approved
                                        </p>
                                    </div>
                                )}

                                <div className="pt-4 border-t border-gray-200">
                                    <button
                                        onClick={() => {
                                            const res = previewEvaluate();
                                            showToast(res.result === "approved" ? "success" : res.result === "rejected" ? "error" : "info", `Preview: ${res.result.toUpperCase()} — ${res.reason}`);
                                        }}
                                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm font-medium"
                                    >
                                        <Eye className="w-4 h-4" />
                                        Preview Rule Logic
                                    </button>
                                    <p className="text-xs text-gray-500 mt-2">
                                        Simulates approval with first 2 approvers approving
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Info Box */}
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                                <Info className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                                <div className="text-sm text-amber-800">
                                    <p className="font-medium mb-1">How Approval Rules Work:</p>
                                    <ul className="space-y-1 text-xs">
                                        <li>• <strong>Sequential:</strong> Approvers must approve in order. Moves to next after approval.</li>
                                        <li>• <strong>Parallel:</strong> All approvers can act simultaneously. Logic evaluated when decisions made.</li>
                                        <li>• <strong>Percentage:</strong> Auto-approves when threshold % of approvers approve.</li>
                                        <li>• <strong>Specific:</strong> Auto-approves when designated approver approves.</li>
                                        <li>• <strong>Hybrid:</strong> Auto-approves if EITHER percentage OR specific approver condition met.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}