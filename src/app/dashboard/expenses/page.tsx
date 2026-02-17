"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { useToast } from "@/components/ui/Toast";

interface Expense {
  id: string;
  description: string;
  amount_cents: number;
  expense_date: string;
  category: string;
  client_id?: string;
  is_billable: boolean;
  is_billed: boolean;
  is_tax_deductible: boolean;
  tax_category?: string;
  payment_method?: string;
  vendor?: string;
  receipt_url?: string;
  receipt_filename?: string;
  notes?: string;
  clients?: {
    id: string;
    name: string;
    company?: string;
  };
}

interface Client {
  id: string;
  name: string;
  company?: string;
}

interface RecurringExpense {
  id: string;
  description: string;
  amount_cents: number;
  frequency: string;
  day_of_month: number;
  start_date: string;
  end_date?: string;
  category: string;
  client_id?: string;
  is_billable: boolean;
  is_tax_deductible: boolean;
  payment_method?: string;
  vendor?: string;
  notes?: string;
  is_active: boolean;
  clients?: {
    id: string;
    name: string;
    company?: string;
  };
}

const FREQUENCIES = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annually", label: "Annually" },
];

const DEFAULT_CATEGORIES = [
  { value: "software", label: "Software & Subscriptions" },
  { value: "hardware", label: "Hardware & Equipment" },
  { value: "hosting", label: "Hosting & Infrastructure" },
  { value: "marketing", label: "Marketing & Advertising" },
  { value: "travel", label: "Travel" },
  { value: "office", label: "Office Supplies" },
  { value: "meals", label: "Meals & Entertainment" },
  { value: "professional_services", label: "Professional Services" },
  { value: "insurance", label: "Insurance" },
  { value: "utilities", label: "Utilities" },
  { value: "other", label: "Other" },
];

const DEFAULT_CATEGORY_VALUES = DEFAULT_CATEGORIES.map(c => c.value);

const PAYMENT_METHODS = [
  { value: "card", label: "Credit/Debit Card" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cash", label: "Cash" },
  { value: "paypal", label: "PayPal" },
  { value: "check", label: "Check" },
  { value: "other", label: "Other" },
];

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function currency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export default function ExpensesPage() {
  const { showToast, ToastContainer } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [activeTab, setActiveTab] = useState<"expenses" | "recurring">("expenses");

  // Form state for one-time expenses
  const [description, setDescription] = useState("");
  const [amountDollars, setAmountDollars] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [category, setCategory] = useState("other");
  const [customCategory, setCustomCategory] = useState("");
  const [clientId, setClientId] = useState("");
  const [isBillable, setIsBillable] = useState(false);
  const [isTaxDeductible, setIsTaxDeductible] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [vendor, setVendor] = useState("");
  const [notes, setNotes] = useState("");

  // Recurring expense form state
  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringExpense | null>(null);
  const [recFrequency, setRecFrequency] = useState("monthly");
  const [recDayOfMonth, setRecDayOfMonth] = useState("1");
  const [recStartDate, setRecStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [recEndDate, setRecEndDate] = useState("");

  const [saving, setSaving] = useState(false);

  // Build query params
  const queryParams = new URLSearchParams();
  if (filterCategory) queryParams.set("category", filterCategory);
  if (filterYear) {
    queryParams.set("start_date", `${filterYear}-01-01`);
    queryParams.set("end_date", `${filterYear}-12-31`);
  }

  const { data: expenses, error, mutate } = useSWR<Expense[]>(
    `/api/expenses?${queryParams.toString()}`,
    fetcher
  );

  const { data: clientsData } = useSWR<{ clients: Client[] }>("/api/clients", fetcher);
  const clients = clientsData?.clients || [];

  const { data: summary } = useSWR(
    `/api/expenses/summary?year=${filterYear}`,
    fetcher
  );

  const { data: recurringExpenses, mutate: mutateRecurring } = useSWR<RecurringExpense[]>(
    "/api/recurring-expenses",
    fetcher
  );

  // Build categories list: default + custom from existing expenses
  const customCategoriesFromExpenses = (expenses || [])
    .map(e => e.category)
    .filter(c => !DEFAULT_CATEGORY_VALUES.includes(c))
    .filter((c, i, arr) => arr.indexOf(c) === i); // unique

  const customCategoriesFromRecurring = (recurringExpenses || [])
    .map(r => r.category)
    .filter(c => !DEFAULT_CATEGORY_VALUES.includes(c))
    .filter((c, i, arr) => arr.indexOf(c) === i);

  const allCustomCategories = [...new Set([...customCategoriesFromExpenses, ...customCategoriesFromRecurring])].sort();

  const CATEGORIES = [
    ...DEFAULT_CATEGORIES.slice(0, -1), // all except "other"
    ...allCustomCategories.map(c => ({ value: c, label: c })), // custom categories
    { value: "other", label: "Other (enter custom)" }, // "other" at the end for new customs
  ];

  const resetForm = () => {
    setDescription("");
    setAmountDollars("");
    setExpenseDate(new Date().toISOString().split("T")[0]);
    setCategory("software");
    setCustomCategory("");
    setClientId("");
    setIsBillable(false);
    setIsTaxDeductible(true);
    setPaymentMethod("");
    setVendor("");
    setNotes("");
    setEditingExpense(null);
  };

  const openEditForm = (expense: Expense) => {
    setEditingExpense(expense);
    setDescription(expense.description);
    setAmountDollars((expense.amount_cents / 100).toString());
    setExpenseDate(expense.expense_date);
    // If category is a custom one, set it directly; otherwise use the dropdown value
    setCategory(expense.category);
    setCustomCategory("");
    setClientId(expense.client_id || "");
    setIsBillable(expense.is_billable);
    setIsTaxDeductible(expense.is_tax_deductible);
    setPaymentMethod(expense.payment_method || "");
    setVendor(expense.vendor || "");
    setNotes(expense.notes || "");
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amountDollars) {
      showToast("Description and amount are required", "error");
      return;
    }

    // Use custom category if "other" is selected and custom value provided
    const finalCategory = category === "other" && customCategory.trim()
      ? customCategory.trim()
      : category;

    if (category === "other" && !customCategory.trim()) {
      showToast("Please enter a custom category name", "error");
      return;
    }

    setSaving(true);

    const payload = {
      description,
      amount_cents: Math.round(parseFloat(amountDollars) * 100),
      expense_date: expenseDate,
      category: finalCategory,
      client_id: clientId || null,
      is_billable: isBillable,
      is_tax_deductible: isTaxDeductible,
      payment_method: paymentMethod || null,
      vendor: vendor || null,
      notes: notes || null,
    };

    try {
      const url = editingExpense
        ? `/api/expenses/${editingExpense.id}`
        : "/api/expenses";
      const method = editingExpense ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save expense");
      }

      showToast(
        editingExpense ? "Expense updated" : "Expense added",
        "success"
      );
      resetForm();
      setShowForm(false);
      mutate();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error saving expense", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this expense?")) return;

    try {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      showToast("Expense deleted", "success");
      mutate();
    } catch (err) {
      showToast("Error deleting expense", "error");
    }
  };

  const getCategoryLabel = (value: string) => {
    return CATEGORIES.find((c) => c.value === value)?.label || value;
  };

  const getFrequencyLabel = (value: string) => {
    return FREQUENCIES.find((f) => f.value === value)?.label || value;
  };

  // Recurring expense handlers
  const resetRecurringForm = () => {
    setDescription("");
    setAmountDollars("");
    setCategory("software");
    setCustomCategory("");
    setClientId("");
    setIsBillable(false);
    setIsTaxDeductible(true);
    setPaymentMethod("");
    setVendor("");
    setNotes("");
    setRecFrequency("monthly");
    setRecDayOfMonth("1");
    setRecStartDate(new Date().toISOString().split("T")[0]);
    setRecEndDate("");
    setEditingRecurring(null);
  };

  const openEditRecurringForm = (rec: RecurringExpense) => {
    setEditingRecurring(rec);
    setDescription(rec.description);
    setAmountDollars((rec.amount_cents / 100).toString());
    setCategory(rec.category);
    setCustomCategory("");
    setClientId(rec.client_id || "");
    setIsBillable(rec.is_billable);
    setIsTaxDeductible(rec.is_tax_deductible);
    setPaymentMethod(rec.payment_method || "");
    setVendor(rec.vendor || "");
    setNotes(rec.notes || "");
    setRecFrequency(rec.frequency);
    setRecDayOfMonth(rec.day_of_month.toString());
    setRecStartDate(rec.start_date);
    setRecEndDate(rec.end_date || "");
    setShowRecurringForm(true);
  };

  const handleRecurringSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amountDollars) {
      showToast("Description and amount are required", "error");
      return;
    }

    // Use custom category if "other" is selected and custom value provided
    const finalCategory = category === "other" && customCategory.trim()
      ? customCategory.trim()
      : category;

    if (category === "other" && !customCategory.trim()) {
      showToast("Please enter a custom category name", "error");
      return;
    }

    setSaving(true);

    const payload = {
      description,
      amount_cents: Math.round(parseFloat(amountDollars) * 100),
      frequency: recFrequency,
      day_of_month: parseInt(recDayOfMonth),
      start_date: recStartDate,
      end_date: recEndDate || null,
      category: finalCategory,
      client_id: clientId || null,
      is_billable: isBillable,
      is_tax_deductible: isTaxDeductible,
      payment_method: paymentMethod || null,
      vendor: vendor || null,
      notes: notes || null,
    };

    try {
      const url = editingRecurring
        ? `/api/recurring-expenses/${editingRecurring.id}`
        : "/api/recurring-expenses";
      const method = editingRecurring ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save recurring expense");
      }

      showToast(
        editingRecurring ? "Recurring expense updated" : "Recurring expense added",
        "success"
      );
      resetRecurringForm();
      setShowRecurringForm(false);
      mutateRecurring();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error saving", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRecurring = async (id: string) => {
    if (!confirm("Delete this recurring expense?")) return;

    try {
      const res = await fetch(`/api/recurring-expenses/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      showToast("Recurring expense deleted", "success");
      mutateRecurring();
    } catch (err) {
      showToast("Error deleting", "error");
    }
  };

  const toggleRecurringActive = async (rec: RecurringExpense) => {
    try {
      const res = await fetch(`/api/recurring-expenses/${rec.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !rec.is_active }),
      });
      if (!res.ok) throw new Error("Failed to update");
      showToast(rec.is_active ? "Paused" : "Activated", "success");
      mutateRecurring();
    } catch (err) {
      showToast("Error updating", "error");
    }
  };

  // Calculate monthly recurring total
  const monthlyRecurringTotal = (recurringExpenses || [])
    .filter((r) => r.is_active)
    .reduce((sum, r) => {
      if (r.frequency === "monthly") return sum + r.amount_cents;
      if (r.frequency === "quarterly") return sum + r.amount_cents / 3;
      if (r.frequency === "annually") return sum + r.amount_cents / 12;
      return sum;
    }, 0);

  // Generate year options (current year and 4 years back)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <ToastContainer />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="text-gray-600">Track and categorize business expenses</p>
        </div>
        <button
          onClick={() => {
            if (activeTab === "recurring") {
              resetRecurringForm();
              setShowRecurringForm(true);
            } else {
              resetForm();
              setShowForm(true);
            }
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {activeTab === "recurring" ? "+ Add Recurring" : "+ Add Expense"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab("expenses")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "expenses"
              ? "bg-white text-gray-900 shadow"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          One-time Expenses
        </button>
        <button
          onClick={() => setActiveTab("recurring")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "recurring"
              ? "bg-white text-gray-900 shadow"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Recurring ({recurringExpenses?.filter(r => r.is_active).length || 0})
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Total Expenses ({filterYear})</div>
            <div className="text-2xl font-bold text-gray-900">
              {currency(summary.totals?.total_cents || 0)}
            </div>
            <div className="text-xs text-gray-500">
              {summary.totals?.expense_count || 0} expenses
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Monthly Recurring</div>
            <div className="text-2xl font-bold text-purple-600">
              {currency(monthlyRecurringTotal)}
            </div>
            <div className="text-xs text-gray-500">
              {recurringExpenses?.filter(r => r.is_active).length || 0} active
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Tax Deductible</div>
            <div className="text-2xl font-bold text-green-600">
              {currency(summary.totals?.tax_deductible_cents || 0)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Billable</div>
            <div className="text-2xl font-bold text-blue-600">
              {currency(summary.totals?.billable_cents || 0)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Unbilled</div>
            <div className="text-2xl font-bold text-amber-600">
              {currency(summary.totals?.unbilled_cents || 0)}
            </div>
          </div>
        </div>
      )}

      {/* One-time Expenses Tab Content */}
      {activeTab === "expenses" && (
        <>
          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Year
                </label>
                <select
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Categories</option>
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">
                {editingExpense ? "Edit Expense" : "Add Expense"}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description *
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Adobe Creative Cloud subscription"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Amount *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-gray-500">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={amountDollars}
                        onChange={(e) => setAmountDollars(e.target.value)}
                        className="w-full pl-7 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date *
                    </label>
                    <input
                      type="date"
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => {
                        setCategory(e.target.value);
                        if (e.target.value !== "other") setCustomCategory("");
                      }}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    {category === "other" && (
                      <input
                        type="text"
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        className="w-full mt-2 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter custom category name"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Payment Method
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select...</option>
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vendor
                  </label>
                  <input
                    type="text"
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., AWS, Adobe, Office Depot"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Link to Client (optional)
                  </label>
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No client</option>
                    {clients?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.company ? `(${c.company})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isBillable}
                      onChange={(e) => setIsBillable(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm text-gray-700">Billable to client</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isTaxDeductible}
                      onChange={(e) => setIsTaxDeductible(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm text-gray-700">Tax deductible</span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={2}
                    placeholder="Additional details..."
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      resetForm();
                    }}
                    className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : editingExpense ? "Update" : "Add Expense"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Expenses Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Description
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Vendor
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Amount
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Flags
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {error ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-red-600">
                    Error loading expenses
                  </td>
                </tr>
              ) : !expenses ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No expenses found. Click "Add Expense" to get started.
                  </td>
                </tr>
              ) : (
                expenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                      {new Date(expense.expense_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">
                        {expense.description}
                      </div>
                      {expense.clients && (
                        <div className="text-xs text-gray-500">
                          Client: {expense.clients.name}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {getCategoryLabel(expense.category)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {expense.vendor || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                      {currency(expense.amount_cents)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-1">
                        {expense.is_tax_deductible && (
                          <span
                            className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded"
                            title="Tax Deductible"
                          >
                            Tax
                          </span>
                        )}
                        {expense.is_billable && (
                          <span
                            className={`px-1.5 py-0.5 text-xs rounded ${
                              expense.is_billed
                                ? "bg-blue-100 text-blue-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                            title={expense.is_billed ? "Billed" : "Unbilled"}
                          >
                            {expense.is_billed ? "Billed" : "Unbilled"}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEditForm(expense)}
                        className="text-blue-600 hover:text-blue-800 text-sm mr-2"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(expense.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Category Breakdown */}
      {summary?.by_category && summary.by_category.length > 0 && (
        <div className="mt-6 bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold mb-4">Expenses by Category</h3>
          <div className="space-y-2">
            {summary.by_category.map((cat: { category: string; count: number; total_cents: number }) => (
              <div key={cat.category} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">
                    {getCategoryLabel(cat.category)}
                  </span>
                  <span className="text-xs text-gray-500">({cat.count})</span>
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {currency(cat.total_cents)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
        </>
      )}

      {/* Recurring Expenses Tab Content */}
      {activeTab === "recurring" && (
        <>
          {/* Recurring Form Modal */}
          {showRecurringForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <h2 className="text-xl font-bold mb-4">
                    {editingRecurring ? "Edit Recurring Expense" : "Add Recurring Expense"}
                  </h2>
                  <form onSubmit={handleRecurringSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description *
                      </label>
                      <input
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., Claude Code subscription"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Amount *
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-gray-500">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={amountDollars}
                            onChange={(e) => setAmountDollars(e.target.value)}
                            className="w-full pl-7 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            placeholder="0.00"
                            required
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Frequency
                        </label>
                        <select
                          value={recFrequency}
                          onChange={(e) => setRecFrequency(e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          {FREQUENCIES.map((f) => (
                            <option key={f.value} value={f.value}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Day of Month
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="28"
                          value={recDayOfMonth}
                          onChange={(e) => setRecDayOfMonth(e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Category
                        </label>
                        <select
                          value={category}
                          onChange={(e) => {
                            setCategory(e.target.value);
                            if (e.target.value !== "other") setCustomCategory("");
                          }}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c.value} value={c.value}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                        {category === "other" && (
                          <input
                            type="text"
                            value={customCategory}
                            onChange={(e) => setCustomCategory(e.target.value)}
                            className="w-full mt-2 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter custom category name"
                          />
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Start Date
                        </label>
                        <input
                          type="date"
                          value={recStartDate}
                          onChange={(e) => setRecStartDate(e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          End Date (optional)
                        </label>
                        <input
                          type="date"
                          value={recEndDate}
                          onChange={(e) => setRecEndDate(e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Vendor
                      </label>
                      <input
                        type="text"
                        value={vendor}
                        onChange={(e) => setVendor(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., Anthropic, AWS, Adobe"
                      />
                    </div>

                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isTaxDeductible}
                          onChange={(e) => setIsTaxDeductible(e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm text-gray-700">Tax deductible</span>
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Notes
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        rows={2}
                        placeholder="Additional details..."
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setShowRecurringForm(false);
                          resetRecurringForm();
                        }}
                        className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {saving ? "Saving..." : editingRecurring ? "Update" : "Add Recurring"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Recurring Expenses List */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Description
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Category
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Vendor
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Frequency
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {!recurringExpenses ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                        Loading...
                      </td>
                    </tr>
                  ) : recurringExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                        No recurring expenses. Click "+ Add Recurring" to add one.
                      </td>
                    </tr>
                  ) : (
                    recurringExpenses.map((rec) => (
                      <tr key={rec.id} className={`hover:bg-gray-50 ${!rec.is_active ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">
                            {rec.description}
                          </div>
                          <div className="text-xs text-gray-500">
                            Day {rec.day_of_month} • Started {new Date(rec.start_date).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {getCategoryLabel(rec.category)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {rec.vendor || "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 text-center">
                          <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                            {getFrequencyLabel(rec.frequency)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                          {currency(rec.amount_cents)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => toggleRecurringActive(rec)}
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              rec.is_active
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {rec.is_active ? "Active" : "Paused"}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => openEditRecurringForm(rec)}
                            className="text-blue-600 hover:text-blue-800 text-sm mr-2"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteRecurring(rec.id)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Monthly Cost Summary */}
          {recurringExpenses && recurringExpenses.length > 0 && (
            <div className="mt-6 bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-semibold mb-4">Monthly Cost Breakdown</h3>
              <div className="space-y-2">
                {recurringExpenses.filter(r => r.is_active).map((rec) => {
                  let monthlyCost = rec.amount_cents;
                  if (rec.frequency === "quarterly") monthlyCost = rec.amount_cents / 3;
                  if (rec.frequency === "annually") monthlyCost = rec.amount_cents / 12;

                  return (
                    <div key={rec.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700">
                          {rec.description}
                        </span>
                        {rec.frequency !== "monthly" && (
                          <span className="text-xs text-gray-500">
                            ({getFrequencyLabel(rec.frequency)})
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {currency(monthlyCost)}/mo
                      </span>
                    </div>
                  );
                })}
                <div className="border-t pt-2 mt-2 flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-900">Total Monthly</span>
                  <span className="text-lg font-bold text-purple-600">
                    {currency(monthlyRecurringTotal)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
