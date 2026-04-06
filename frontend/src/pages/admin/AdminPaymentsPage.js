import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader, Badge } from '../../components/common/UI';

const AdminPaymentsPage = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/reports/revenue')
      .then(res => setPayments(res.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Transaction Monitoring</h1>
      <p className="text-gray-500 text-sm mb-6">Platform payment history and financial oversight.</p>
      {loading ? <Loader /> : (
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-xl">
              <p className="text-2xl font-bold text-blue-600">৳{(payments.totalRevenue || 0).toLocaleString()}</p>
              <p className="text-sm text-gray-500 mt-1">Total Revenue</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-xl">
              <p className="text-2xl font-bold text-green-600">৳{(payments.instructorRevenue || 0).toLocaleString()}</p>
              <p className="text-sm text-gray-500 mt-1">Instructor Earnings</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-xl">
              <p className="text-2xl font-bold text-purple-600">৳{(payments.platformRevenue || 0).toLocaleString()}</p>
              <p className="text-sm text-gray-500 mt-1">Platform Revenue</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPaymentsPage;
