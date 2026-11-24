import { Link } from 'react-router-dom';
import { ShieldAlert, LayoutDashboard, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[75vh] flex flex-col items-center justify-center p-6 text-center">
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6 text-indigo-600 shadow-xl"
        style={{
          background: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)',
          border: '1px solid #C7D2FE'
        }}
      >
        <ShieldAlert size={40} />
      </div>

      <div className="text-xs font-mono font-bold tracking-widest uppercase text-indigo-600 mb-2">
        Error 404 • Resource Not Found
      </div>

      <h1 className="text-4xl font-extrabold text-gray-900 mb-3" style={{ fontFamily: 'Outfit, sans-serif' }}>
        Route Guard Blocked
      </h1>

      <p className="text-base text-gray-600 max-w-md mb-8 leading-relaxed font-serif italic" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
        The policy guard evaluated your navigational route and found no matching endpoint.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/dashboard"
          className="flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold text-white shadow-md hover:opacity-90 transition-all"
          style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' }}
        >
          <LayoutDashboard size={14} /> Return to Dashboard
        </Link>
        <Link
          to="/"
          className="flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-all shadow-xs"
        >
          <Home size={14} /> Landing Page
        </Link>
      </div>
    </div>
  );
}
