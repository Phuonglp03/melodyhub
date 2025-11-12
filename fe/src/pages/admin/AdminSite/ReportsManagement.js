import React, { useState } from 'react';
import { Search, AlertCircle, ShieldAlert, UserX } from 'lucide-react';

const ReportsManagement = () => {
  const [activeTab, setActiveTab] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');

  const [reports, setReports] = useState([
    {
      id: 1,
      reportedBy: 'john',
      violationType: 'Copyright Infringement',
      reportedContent: 'Lick: "Summer Jam Remix"',
      uploader: 'user99',
      accountStatus: 'Active',
      isPending: true
    },
    {
      id: 2,
      reportedBy: 'kevin',
      violationType: 'Inappropriate Content',
      reportedContent: 'LiveRoom: "Late Night Chill"',
      host: 'DJ_Baddie',
      accountStatus: 'Active',
      isPending: true
    },
    {
      id: 3,
      reportedBy: 'alex',
      violationType: 'Impersonation',
      reportedContent: 'User Profile: "Mr. Link in Bio"',
      detail: 'Pretending to be a known artist',
      accountStatus: 'Active',
      isPending: true
    }
  ]);

  const handleAction = (id, action) => {
    setReports(reports.map(report => 
      report.id === id ? { ...report, isPending: false, action } : report
    ));
  };

  const getViolationIcon = (type) => {
    switch(type) {
      case 'Copyright Infringement':
        return <AlertCircle className="text-red-400" size={18} />;
      case 'Inappropriate Content':
        return <ShieldAlert className="text-orange-400" size={18} />;
      case 'Impersonation':
        return <UserX className="text-purple-400" size={18} />;
      default:
        return <AlertCircle className="text-gray-400" size={18} />;
    }
  };

  const pendingReports = reports.filter(r => r.isPending);
  const resolvedReports = reports.filter(r => !r.isPending);
  
  const displayReports = activeTab === 'pending' ? pendingReports : resolvedReports;
  
  const filteredReports = displayReports.filter(report => {
    const searchLower = searchTerm.toLowerCase();
    return (
      report.reportedBy.toLowerCase().includes(searchLower) ||
      report.violationType.toLowerCase().includes(searchLower) ||
      report.reportedContent.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
          Reports Management
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 ${
            activeTab === 'pending'
              ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/30'
              : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'
          }`}
        >
          Pending Reports
          {pendingReports.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-xs">
              {pendingReports.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('resolved')}
          className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 ${
            activeTab === 'resolved'
              ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/30'
              : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'
          }`}
        >
          Resolved Reports
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search reports..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-transparent transition-all text-white placeholder-gray-400"
        />
      </div>

      {/* Table */}
      <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-800/50 border-b border-gray-700/50">
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-300">ID</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-300">Reported by</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-300">Violation type</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-300">Reported Content/User</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-300">Account Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map((report) => (
                <tr 
                  key={report.id} 
                  className="border-b border-gray-700/30 hover:bg-gray-800/30 transition-colors"
                >
                  <td className="py-4 px-6 text-gray-300">{report.id}</td>
                  <td className="py-4 px-6">
                    <span className="font-medium text-white">{report.reportedBy}</span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      {getViolationIcon(report.violationType)}
                      <span className="text-gray-300">{report.violationType}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="text-gray-300">
                      <div className="font-medium text-white mb-1">{report.reportedContent}</div>
                      {report.uploader && (
                        <div className="text-sm text-gray-400">Uploader: {report.uploader}</div>
                      )}
                      {report.host && (
                        <div className="text-sm text-gray-400">Host: {report.host}</div>
                      )}
                      {report.detail && (
                        <div className="text-sm text-gray-400">({report.detail})</div>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    {activeTab === 'pending' ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAction(report.id, 'delete')}
                          className="px-4 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm font-medium transition-all border border-red-500/30"
                        >
                          Delete Content
                        </button>
                        <button
                          onClick={() => handleAction(report.id, 'warning')}
                          className="px-4 py-1.5 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 rounded-lg text-sm font-medium transition-all border border-yellow-500/30"
                        >
                          Send Warning
                        </button>
                        <button
                          onClick={() => handleAction(report.id, 'ban')}
                          className="px-4 py-1.5 bg-gray-700/50 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium transition-all border border-gray-600/30"
                        >
                          Delete Account
                        </button>
                      </div>
                    ) : (
                      <span className="px-4 py-1.5 bg-green-600/20 text-green-400 rounded-lg text-sm font-medium border border-green-500/30 inline-block">
                        Resolved
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredReports.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <AlertCircle className="mx-auto mb-3 opacity-50" size={48} />
              <p className="text-lg">No reports found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportsManagement;