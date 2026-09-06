"use client";

import React, { useState, useEffect } from "react";
import { Plus, Shield, ShieldOff, MoreVertical, Search, CheckCircle2, User, KeySquare } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface FreelancerProfile {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: string;
  created_at: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<FreelancerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [createRole, setCreateRole] = useState("freelancer");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      if (!res.ok) {
        if (res.status === 403) throw new Error("Unauthorized. Only Super Admins can access this page.");
        throw new Error("Failed to load users");
      }
      const data = await res.json();
      setUsers(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail,
          name: newName,
          password: newPassword,
          role: createRole
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create user");
      
      setShowCreate(false);
      setNewEmail("");
      setNewName("");
      setNewPassword("");
      await loadUsers();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function toggleStatus(id: string, currentStatus: string) {
    const newStatus = currentStatus === "active" ? "disabled" : "active";
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      setUsers(users.map(u => u.id === id ? { ...u, status: newStatus } : u));
    } catch (e: any) {
      alert(e.message);
    }
  }

  if (error && error.includes("Unauthorized")) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center p-5 text-center">
        <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-rose-50 text-rose-500">
          <ShieldOff size={32} />
        </div>
        <h2 className="text-xl font-semibold">Access Denied</h2>
        <p className="mt-2 text-sm text-neutral-500 max-w-sm">
          This area is restricted to Super Admins. If you believe you should have access, contact your administrator.
        </p>
      </div>
    );
  }

  const filtered = users.filter(u => 
    u.email.toLowerCase().includes(search.toLowerCase()) || 
    (u.name && u.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <main className="p-8">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Users & Freelancers</h1>
          <p className="text-sm text-neutral-500">Manage platform access and freelancer accounts.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800"
        >
          <Plus size={16} /> New Account
        </button>
      </div>

      {showCreate && (
        <div className="mb-8 rounded-2xl border border-line bg-white p-6 shadow-sm">
          <div className="mb-6 border-b border-line pb-4">
            <h2 className="text-lg font-medium text-neutral-900">Create Freelancer Account</h2>
            <p className="text-sm text-neutral-500">The user will be able to log in immediately with these credentials.</p>
          </div>
          
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-neutral-700">Full Name</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Jane Doe"
                  className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-neutral-700">Email</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="jane@example.com"
                  className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-neutral-700">Temporary Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-neutral-700">Role</label>
                <select
                  value={createRole}
                  onChange={(e) => setCreateRole(e.target.value)}
                  className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500"
                >
                  <option value="freelancer">Freelancer</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
            </div>
            
            {error && <p className="text-sm text-rose-600">{error}</p>}
            
            <div className="flex items-center gap-3 pt-4">
              <button
                type="submit"
                disabled={creating}
                className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Account"}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="mb-6 relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users..."
          className="w-full rounded-xl border border-line py-2.5 pl-9 pr-4 text-sm outline-none transition focus:border-indigo-500 bg-white shadow-sm"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        <table className="w-full text-left text-sm text-neutral-600">
          <thead className="border-b border-line bg-neutral-50/50 text-xs font-semibold uppercase tracking-wider text-neutral-900">
            <tr>
              <th className="px-6 py-4">User</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Joined</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center text-neutral-500">Loading accounts...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-neutral-500">No freelancer accounts found.</td></tr>
            ) : (
              filtered.map((user) => (
                <tr key={user.id} className="transition hover:bg-neutral-50/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-neutral-100 text-neutral-600">
                        <User size={14} />
                      </div>
                      <div>
                        <p className="font-medium text-neutral-900">{user.name || "Unnamed"}</p>
                        <p className="text-xs text-neutral-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700">
                      {user.role === 'super_admin' ? <Shield size={12} className="text-indigo-600" /> : <User size={12} />}
                      {user.role === 'super_admin' ? "Super Admin" : "Freelancer"}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                      user.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${user.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      {user.status === 'active' ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-neutral-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => toggleStatus(user.id, user.status)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      {user.status === 'active' ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
