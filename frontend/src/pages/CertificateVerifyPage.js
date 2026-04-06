// ============================================================
// LearnSpace - Certificate Verify Page (Public)
// ============================================================
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { certAPI } from '../services/api';

const CertificateVerifyPage = () => {
  const { hash } = useParams();
  const navigate = useNavigate();
  const [inputHash, setInputHash] = useState(hash !== 'check' ? hash : '');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!inputHash.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await certAPI.verify(inputHash.trim());
      setResult(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Certificate not found or invalid.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-16">
      <div className="text-center mb-8">
        <div className="text-5xl mb-3">🔍</div>
        <h1 className="text-2xl font-bold text-gray-900">Verify Certificate</h1>
        <p className="text-gray-500 text-sm mt-1">Enter a LearnSpace certificate hash to verify its authenticity</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <form onSubmit={handleVerify} className="flex gap-3">
          <input
            type="text"
            value={inputHash}
            onChange={e => setInputHash(e.target.value)}
            placeholder="Enter certificate hash..."
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button type="submit" disabled={loading} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {loading ? '...' : 'Verify'}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-red-700 font-medium">❌ {error}</p>
          </div>
        )}

        {result && (
          <div className="mt-4 p-5 bg-green-50 border border-green-200 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">✅</span>
              <span className="font-semibold text-green-800">Valid Certificate</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex gap-2"><span className="text-gray-500 w-28">Student:</span><span className="text-gray-800 font-medium">{result.student_name}</span></div>
              <div className="flex gap-2"><span className="text-gray-500 w-28">Course:</span><span className="text-gray-800 font-medium">{result.course_title}</span></div>
              <div className="flex gap-2"><span className="text-gray-500 w-28">Certificate #:</span><span className="text-gray-600 font-mono text-xs">{result.certificate_number}</span></div>
              <div className="flex gap-2"><span className="text-gray-500 w-28">Issued:</span><span className="text-gray-800">{new Date(result.issued_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CertificateVerifyPage;
