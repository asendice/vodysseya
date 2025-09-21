import React, { useState, useEffect } from 'react';
import { fetchEmails } from '../services/email'; // Your provided fetchEmails function

export type WidgetContainerProps = {
  title?: string;
  widgetType?: string;
  children?: React.ReactNode;
};

const WidgetContainer: React.FC<WidgetContainerProps> = ({
  title = 'Widget',
  widgetType,
  children,
}) => {
  const [emails, setEmails] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFetchEmails = async () => {
    setLoading(true);
    try {
      const data = await fetchEmails();
      setEmails(data.messages || []);
      setError(null);
    } catch (error) {
      setError(
        "Oops, I couldn't peek at those emails just yet. Signed in? Let me try again for you..."
      );
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch on mount for a seamless glimpse, but with a button for refresh
  useEffect(() => {
    if (widgetType === 'email') {
      handleFetchEmails();
    }
  }, [widgetType]);

  return (
    <div className="h-1/2 w-full border border-gray-500 rounded-lg p-4 my-4 bg-gray-800 shadow-lg transition-all duration-300 ease-in-out hover:shadow-gray-500/50">
      <h3 className="text-gray-300 text-lg font-semibold mb-3">{title}</h3>
      {widgetType === 'email' ? (
        <>
          <button
            onClick={handleFetchEmails}
            disabled={loading}
            className={`bg-gray-500 text-white px-4 py-2 rounded-md mb-4 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 transition duration-200 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {loading ? 'Peeking...' : 'Fetch Emails'}
          </button>
          {error && <p className="text-red-400 mb-3 animate-fade-in">{error}</p>}
          {emails.length > 0 ? (
            <div className="flex flex-col gap-3 max-h-80 p-6 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-gray-700">
              {emails.slice(0, 5).map((email, index) => (
                <div
                  key={email.id}
                  className="bg-gray-900 p-3 rounded-md border border-gray-700 transition duration-300 hover:border-gray-400 hover:scale-105 animate-fade-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <p className="text-white text-sm font-medium">From: {email.from}</p>
                  <p className="text-gray-400 text-xs">Subject: {email.subject}</p>
                  {/* TODO: Expand with sender, subject, snippet from detailed fetch */}
                  <p className="text-gray-500 text-xs mt-1">{email.snippet}</p>
                </div>
              ))}
            </div>
          ) : (
            !loading && (
              <p className="text-gray-400 italic">
                No unread emails yet, darling. Let's keep it that way? 😊
              </p>
            )
          )}
        </>
      ) : (
        children
      )}
    </div>
  );
};

export default WidgetContainer;
