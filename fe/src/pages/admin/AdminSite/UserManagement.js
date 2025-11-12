// src/pages/admin/AdminSite/UserManagement.js 

import React, { useState } from 'react';
import { Lock, Unlock, Search } from 'lucide-react';

const UserManagement = () => {
  const [users, setUsers] = useState([
    {
      id: 1,
      username: 'thang',
      email: 'thang@gmail.com',
      status: 'Active',
      accountStatus: 'Active',
      isLocked: false
    },
    {
      id: 2,
      username: 'quy',
      email: 'quy@gmail.com',
      status: 'Active',
      accountStatus: 'Active',
      isLocked: false
    },
    {
      id: 3,
      username: 'phuong',
      email: 'phuong@gmail.com',
      status: 'Locked',
      accountStatus: 'Active',
      isLocked: true
    }
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortBy, setSortBy] = useState('Username');

  const toggleLock = (id) => {
    setUsers(users.map(user => 
      user.id === id 
        ? { ...user, isLocked: !user.isLocked, status: user.isLocked ? 'Active' : 'Locked' }
        : user
    ));
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || user.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (sortBy === 'Username') {
      return a.username.localeCompare(b.username);
    }
    return a.email.localeCompare(b.email);
  });

  // CHỈ GIỮ LẠI PHẦN NỘI DUNG CHÍNH CỦA TRANG
  return (
    <div className="p-8">
      <div className="mb-6 flex gap-4">
        <select 
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option>All</option>
          <option>Active</option>
          <option>Locked</option>
        </select>
        
        <select className="px-4 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option>Filter</option>
        </select>
        
        <select 
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-4 py-2 bg-teal-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 ml-auto"
        >
          <option>Username</option>
          <option>Email</option>
        </select>
      </div>

      <div className="bg-gray-800 bg-opacity-40 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-6">User Management</h2>
        
        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700">
                <th className="pb-4 px-4">ID</th>
                <th className="pb-4 px-4">Username</th>
                <th className="pb-4 px-4">Email</th>
                <th className="pb-4 px-4">Status</th>
                <th className="pb-4 px-4">Account Status</th>
                <th className="pb-4 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map((user) => (
                <tr key={user.id} className="border-b border-gray-700 hover:bg-gray-700 hover:bg-opacity-30 transition">
                  <td className="py-4 px-4">{user.id}</td>
                  <td className="py-4 px-4">{user.username}</td>
                  <td className="py-4 px-4">
                    <a href={`mailto:${user.email}`} className="text-blue-400 hover:underline">
                      {user.email}
                    </a>
                  </td>
                  <td className="py-4 px-4">
                    <span className={`px-4 py-1 rounded-full text-sm ${
                      user.status === 'Active' 
                        ? 'bg-green-600 text-white' 
                        : 'bg-red-600 text-white'
                    }`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <span className="px-4 py-1 rounded-full text-sm bg-green-600 text-white">
                      {user.accountStatus}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <button
                      onClick={() => toggleLock(user.id)}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition ${
                        user.isLocked
                          ? 'bg-gray-600 hover:bg-gray-500'
                          : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                    >
                      {user.isLocked ? (
                        <>
                          <Unlock size={16} />
                          <span>Unlock</span>
                        </>
                      ) : (
                        <>
                          <Lock size={16} />
                          <span>Lock</span>
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;